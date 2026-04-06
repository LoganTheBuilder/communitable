import fs from "fs/promises";
import path from "path";
import type { ColumnDef, Row } from "@/lib/types";
import { getTableSchema, getTableData } from "@/lib/sample-data";

export interface StoredTable {
  columns: ColumnDef[];
  rows: Row[];
  defaultSort: { key: string; dir: "asc" | "desc" } | null;
}

const DATA_DIR = path.join(process.cwd(), "data", "tables");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readTable(id: string): Promise<StoredTable> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as StoredTable;
  } catch {
    // No saved file yet — seed from sample data
    const schema = getTableSchema(id);
    const data = getTableData(id);
    return { columns: schema.columns, rows: data.rows, defaultSort: null };
  }
}

export async function writeTable(id: string, table: StoredTable): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, `${id}.json`),
    JSON.stringify(table, null, 2),
    "utf-8"
  );
}
