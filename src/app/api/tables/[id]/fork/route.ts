import { NextRequest } from "next/server";
import { readTable, writeTable } from "@/lib/table-store";
import { prisma } from "@/lib/prisma";
import { getTableMeta } from "@/lib/sample-data";

interface Params {
  params: Promise<{ id: string }>;
}

interface ForkBody {
  name: string;
  description?: string;
}

const SYSTEM_USER_EMAIL = "system@allyourbase.local";

export async function POST(req: NextRequest, { params }: Params) {
  const { id: sourceId } = await params;
  const body = (await req.json()) as ForkBody;

  if (!body.name?.trim()) {
    return Response.json({ error: "Table name is required" }, { status: 400 });
  }

  // Read source table data
  const sourceData = await readTable(sourceId);

  // Ensure system user
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: { email: SYSTEM_USER_EMAIL, name: "System" },
  });

  // Ensure the source table has a DB record (sample tables may not yet)
  const sourceMeta = getTableMeta(sourceId);
  await prisma.table.upsert({
    where: { id: sourceId },
    update: {},
    create: {
      id: sourceId,
      name: sourceMeta?.name ?? `Table ${sourceId}`,
      description: sourceMeta?.description ?? null,
      published: true,
      ownerId: user.id,
    },
  });

  // Create the forked table record
  const forkedTable = await prisma.table.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      published: false,
      ownerId: user.id,
      forkedFromId: sourceId,
    },
  });

  // Copy data to file store
  await writeTable(forkedTable.id, sourceData);

  // Create initial version
  await prisma.tableVersion.create({
    data: {
      tableId: forkedTable.id,
      version: 1,
      schema: JSON.parse(JSON.stringify({ columns: sourceData.columns, defaultSort: sourceData.defaultSort ?? null })),
      data: JSON.parse(JSON.stringify({ rows: sourceData.rows })),
      message: "Forked from original",
      authorId: user.id,
    },
  });

  return Response.json({ id: forkedTable.id });
}
