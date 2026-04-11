import { NextRequest } from "next/server";
import { readTable, writeTable } from "@/lib/table-store";
import type { StoredTable } from "@/lib/table-store";
import { prisma } from "@/lib/prisma";
import { getTableMeta } from "@/lib/sample-data";
import { auth } from "@/lib/auth";
import { ensureProfile } from "@/lib/auth/profile";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const table = await readTable(id);
  return Response.json(table);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as StoredTable & {
    publish?: boolean;
    name?: string;
    description?: string | null;
    unpublish?: boolean;
  };

  // Persist to file store
  await writeTable(id, { columns: body.columns, rows: body.rows, defaultSort: body.defaultSort });

  // Persist a version to the database
  try {
    // Get authenticated user or fall back to system profile
    let profileId: string;
    const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);

    if (session?.user) {
      const profile = await ensureProfile(session.user.id, session.user.name);
      profileId = profile.id;
    } else {
      const SYSTEM_USER_ID = "system";
      const profile = await ensureProfile(SYSTEM_USER_ID, "System");
      profileId = profile.id;
    }

    // Fetch previous table state + latest version in parallel (before upsert overwrites name/description)
    const meta = getTableMeta(id);
    const [prevTable, latest] = await Promise.all([
      prisma.table.findUnique({
        where: { id },
        select: { name: true, description: true },
      }),
      prisma.tableVersion.findFirst({
        where: { tableId: id },
        orderBy: { version: "desc" },
        select: { version: true, schema: true, data: true },
      }),
    ]);

    // Ensure the table record exists
    await prisma.table.upsert({
      where: { id },
      update: {
        updatedAt: new Date(),
        ...(body.publish && { published: true }),
        ...(body.unpublish && { published: false }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
      },
      create: {
        id,
        name: body.name ?? meta?.name ?? `Table ${id}`,
        description: body.description ?? meta?.description ?? null,
        ownerId: profileId,
      },
    });

    const newSchema = JSON.parse(JSON.stringify({ columns: body.columns, defaultSort: body.defaultSort ?? null }));
    const newData = JSON.parse(JSON.stringify({ rows: body.rows }));

    // Only create a new version if content actually changed
    const schemaChanged = JSON.stringify(latest?.schema) !== JSON.stringify(newSchema);
    const dataChanged = JSON.stringify(latest?.data) !== JSON.stringify(newData);

    // Build version message for metadata changes
    const metaChanges: string[] = [];
    if (body.name !== undefined && prevTable && body.name !== prevTable.name) {
      metaChanges.push("Name");
    }
    if (body.description !== undefined && prevTable && body.description !== prevTable.description) {
      metaChanges.push("Description");
    }
    const message = metaChanges.length > 0 ? `${metaChanges.join("/")} updated` : null;

    if (schemaChanged || dataChanged || metaChanges.length > 0 || !latest) {
      const nextVersion = (latest?.version ?? 0) + 1;
      await prisma.tableVersion.create({
        data: {
          tableId: id,
          version: nextVersion,
          schema: newSchema,
          data: newData,
          authorId: profileId,
          ...(message && { message }),
        },
      });
    }
  } catch (err) {
    console.error("[version save error]", err);
  }

  return Response.json({
    ok: true,
    published: body.unpublish ? false : body.publish ? true : undefined,
    name: body.name,
    description: body.description,
  });
}
