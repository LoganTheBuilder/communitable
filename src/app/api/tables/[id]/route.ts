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
    editability?: "LOCKED" | "APPROVALS" | "OPEN";
  };

  let isPendingApproval = false;

  try {
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

    const meta = getTableMeta(id);
    const tableRecord = await prisma.table.findUnique({
      where: { id },
      select: { name: true, description: true, ownerId: true, editability: true, activeBranch: true },
    });

    const [latest, ban] = await Promise.all([
      prisma.tableVersion.findFirst({
        where: { tableId: id, branch: tableRecord?.activeBranch ?? "main" },
        orderBy: { version: "desc" },
        select: { version: true, schema: true, data: true },
      }),
      prisma.tableBan.findUnique({
        where: { tableId_profileId: { tableId: id, profileId } },
      }).catch(() => null),
    ]);

    const isTableOwner = tableRecord?.ownerId === profileId;

    if (ban) {
      return Response.json({ error: "You are banned from editing this table." }, { status: 403 });
    }

    if (tableRecord && !isTableOwner) {
      if (tableRecord.editability === "LOCKED") {
        return Response.json({ error: "This table is locked. Only the owner can edit." }, { status: 403 });
      }
      if (tableRecord.editability === "APPROVALS") {
        isPendingApproval = true;
      }
    }

    if (!isPendingApproval) {
      await writeTable(id, { columns: body.columns, rows: body.rows, defaultSort: body.defaultSort });
    }

    await prisma.table.upsert({
      where: { id },
      update: {
        updatedAt: new Date(),
        ...(body.publish && { published: true }),
        ...(body.unpublish && { published: false }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.editability && { editability: body.editability }),
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

    const schemaChanged = JSON.stringify(latest?.schema) !== JSON.stringify(newSchema);
    const dataChanged = JSON.stringify(latest?.data) !== JSON.stringify(newData);

    const metaChanges: string[] = [];
    if (body.name !== undefined && tableRecord && body.name !== tableRecord.name) {
      metaChanges.push("Name");
    }
    if (body.description !== undefined && tableRecord && body.description !== tableRecord.description) {
      metaChanges.push("Description");
    }
    const message = metaChanges.length > 0 ? `${metaChanges.join("/")} updated` : null;

    if (schemaChanged || dataChanged || metaChanges.length > 0 || !latest) {
      const nextVersion = (latest?.version ?? 0) + 1;
      const branch = tableRecord?.activeBranch ?? "main";
      await prisma.tableVersion.create({
        data: {
          tableId: id,
          version: nextVersion,
          branch,
          schema: newSchema,
          data: newData,
          authorId: profileId,
          ...(message && { message }),
          ...(isPendingApproval && { status: "PENDING_APPROVAL" }),
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
    pendingApproval: isPendingApproval || undefined,
  });
}
