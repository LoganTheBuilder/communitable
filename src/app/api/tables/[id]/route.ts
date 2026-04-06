import { NextRequest } from "next/server";
import { readTable, writeTable } from "@/lib/table-store";
import type { StoredTable } from "@/lib/table-store";
import { prisma } from "@/lib/prisma";
import { getTableMeta } from "@/lib/sample-data";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const table = await readTable(id);
  return Response.json(table);
}

const SYSTEM_USER_EMAIL = "system@allyourbase.local";

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as StoredTable & { publish?: boolean };

  // Persist to file store
  await writeTable(id, { columns: body.columns, rows: body.rows, defaultSort: body.defaultSort });

  // Persist a version to the database
  try {
    // Ensure a system user exists (until auth is wired up)
    const user = await prisma.user.upsert({
      where: { email: SYSTEM_USER_EMAIL },
      update: {},
      create: { email: SYSTEM_USER_EMAIL, name: "System" },
    });

    // Ensure the table record exists
    const meta = getTableMeta(id);
    await prisma.table.upsert({
      where: { id },
      update: {
        updatedAt: new Date(),
        ...(body.publish && { published: true }),
      },
      create: {
        id,
        name: meta?.name ?? `Table ${id}`,
        description: meta?.description ?? null,
        ownerId: user.id,
      },
    });

    // Get latest version (number + content) to check for changes
    const latest = await prisma.tableVersion.findFirst({
      where: { tableId: id },
      orderBy: { version: "desc" },
      select: { version: true, schema: true, data: true },
    });

    const newSchema = JSON.parse(JSON.stringify({ columns: body.columns, defaultSort: body.defaultSort ?? null }));
    const newData = JSON.parse(JSON.stringify({ rows: body.rows }));

    // Only create a new version if content actually changed
    const schemaChanged = JSON.stringify(latest?.schema) !== JSON.stringify(newSchema);
    const dataChanged = JSON.stringify(latest?.data) !== JSON.stringify(newData);

    if (schemaChanged || dataChanged || !latest) {
      const nextVersion = (latest?.version ?? 0) + 1;
      await prisma.tableVersion.create({
        data: {
          tableId: id,
          version: nextVersion,
          schema: newSchema,
          data: newData,
          authorId: user.id,
        },
      });
    }
  } catch (err) {
    console.error("[version save error]", err);
  }

  return Response.json({ ok: true, published: body.publish ? true : undefined });
}
