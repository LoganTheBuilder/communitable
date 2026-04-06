export type ColumnType = "string" | "number" | "date";

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
}

export type CellValue = string | number | null;
export type Row = Record<string, CellValue>;

export interface TableSchema {
  columns: ColumnDef[];
}

export interface TableData {
  rows: Row[];
}

export interface TableMeta {
  id: string;
  name: string;
  description: string | null;
  author: string;
  rowCount: number;
  updatedAt: string;
}
