import type { ColumnDef, Row } from "@/lib/types";
import { getTableSchema, getTableData } from "@/lib/sample-data";
import { prisma } from "@/lib/prisma";

export interface StoredTable {
  columns: ColumnDef[];
  rows: Row[];
  defaultSort: { key: string; dir: "asc" | "desc" } | null;
}

export async function readTable(id: string): Promise<StoredTable> {
  try {
    const table = await prisma.table.findUnique({
      where: { id },
      select: { activeBranch: true },
    });

    const latest = await prisma.tableVersion.findFirst({
      where: {
        tableId: id,
        status: "PUBLISHED",
        ...(table && { branch: table.activeBranch }),
      },
      orderBy: { version: "desc" },
      select: { schema: true, data: true },
    });

    if (latest) {
      const schema = latest.schema as unknown as { columns: ColumnDef[]; defaultSort: StoredTable["defaultSort"] };
      const data = latest.data as unknown as { rows: Row[] } | null;
      return {
        columns: schema.columns,
        rows: data?.rows ?? [],
        defaultSort: schema.defaultSort ?? null,
      };
    }
  } catch (err) {
    console.error("[readTable] DB query failed:", err);
  }

  // No DB record or query failed — fall back to in-memory sample data
  const schema = getTableSchema(id);
  const data = getTableData(id);
  return { columns: schema.columns, rows: data.rows, defaultSort: null };
}

// Data is persisted via Prisma TableVersion in the API routes.
// This is intentionally a no-op for Vercel compatibility (read-only filesystem).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function writeTable(_id: string, _table: StoredTable): Promise<void> {}
