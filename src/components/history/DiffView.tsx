"use client";

import type { ColumnDef, Row, CellValue } from "@/lib/types";

interface DefaultSort {
  key: string;
  dir: "asc" | "desc";
}

interface VersionSnapshot {
  schema: { columns: ColumnDef[]; defaultSort?: DefaultSort | null };
  data: { rows: Row[] } | null;
}

interface Props {
  left: VersionSnapshot;
  right: VersionSnapshot;
  leftLabel: string;
  rightLabel: string;
}

type CellStatus = "unchanged" | "added" | "removed" | "changed";

const STATUS_BG: Record<CellStatus, string> = {
  unchanged: "",
  added: "bg-green-100 text-green-900",
  removed: "bg-red-100 text-red-900",
  changed: "bg-yellow-100 text-yellow-900",
};

const ROW_BG: Record<"added" | "removed", string> = {
  added: "bg-green-50",
  removed: "bg-red-50",
};

function formatCell(value: CellValue): string {
  if (value === null || value === undefined) return "\u2014";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/**
 * Build a merged column list from both versions.
 * Tracks which columns exist in left, right, or both.
 */
function mergeColumns(leftCols: ColumnDef[], rightCols: ColumnDef[]) {
  const leftKeys = new Set(leftCols.map((c) => c.key));
  const rightKeys = new Set(rightCols.map((c) => c.key));
  const allKeys: string[] = [];
  const colLabels = new Map<string, string>();
  const colStatus = new Map<string, CellStatus>();

  // Preserve left ordering first, then append right-only
  for (const col of leftCols) {
    allKeys.push(col.key);
    colLabels.set(col.key, col.label);
    if (!rightKeys.has(col.key)) {
      colStatus.set(col.key, "removed");
    } else {
      const rightCol = rightCols.find((c) => c.key === col.key)!;
      colStatus.set(
        col.key,
        rightCol.label !== col.label || rightCol.type !== col.type
          ? "changed"
          : "unchanged"
      );
    }
  }
  for (const col of rightCols) {
    if (!leftKeys.has(col.key)) {
      allKeys.push(col.key);
      colLabels.set(col.key, col.label);
      colStatus.set(col.key, "added");
    }
  }

  return { allKeys, colLabels, colStatus };
}

/**
 * Build a row key for matching rows across versions.
 * Uses first column value as a simple identity heuristic.
 * Falls back to row index if no good key.
 */
function buildRowKey(row: Row, columns: ColumnDef[]): string {
  if (columns.length === 0) return "";
  const firstCol = columns[0].key;
  return String(row[firstCol] ?? "");
}

interface DiffRow {
  leftRow: Row | null;
  rightRow: Row | null;
  status: "unchanged" | "added" | "removed" | "modified";
}

function diffRows(
  leftRows: Row[],
  rightRows: Row[],
  leftCols: ColumnDef[],
  rightCols: ColumnDef[],
  allKeys: string[]
): DiffRow[] {
  // Build maps keyed by first-column value
  const leftMap = new Map<string, Row[]>();
  for (const row of leftRows) {
    const key = buildRowKey(row, leftCols);
    if (!leftMap.has(key)) leftMap.set(key, []);
    leftMap.get(key)!.push(row);
  }

  const rightMap = new Map<string, Row[]>();
  for (const row of rightRows) {
    const key = buildRowKey(row, rightCols);
    if (!rightMap.has(key)) rightMap.set(key, []);
    rightMap.get(key)!.push(row);
  }

  const result: DiffRow[] = [];
  const visitedRight = new Set<string>();

  // Walk left rows in order
  for (const row of leftRows) {
    const key = buildRowKey(row, leftCols);
    const rightCandidates = rightMap.get(key);
    if (!rightCandidates || rightCandidates.length === 0) {
      result.push({ leftRow: row, rightRow: null, status: "removed" });
    } else {
      const rightRow = rightCandidates.shift()!;
      visitedRight.add(key);
      const hasChanges = allKeys.some(
        (k) => formatCell(row[k] ?? null) !== formatCell(rightRow[k] ?? null)
      );
      result.push({
        leftRow: row,
        rightRow: rightRow,
        status: hasChanges ? "modified" : "unchanged",
      });
    }
  }

  // Remaining right-only rows
  for (const row of rightRows) {
    const key = buildRowKey(row, rightCols);
    // If there are still unmatched entries in rightMap for this key
    const remaining = rightMap.get(key);
    if (remaining && remaining.length > 0) {
      // This row wasn't consumed above
      if (remaining.includes(row)) {
        remaining.splice(remaining.indexOf(row), 1);
        result.push({ leftRow: null, rightRow: row, status: "added" });
      }
    }
  }

  return result;
}

function formatSort(sort: DefaultSort | null | undefined, columns: ColumnDef[]): string {
  if (!sort) return "None";
  const col = columns.find((c) => c.key === sort.key);
  return `${col?.label ?? sort.key} (${sort.dir})`;
}

export default function DiffView({ left, right, leftLabel, rightLabel }: Props) {
  const leftCols = left.schema.columns;
  const rightCols = right.schema.columns;
  const leftRows = left.data?.rows ?? [];
  const rightRows = right.data?.rows ?? [];

  const { allKeys, colLabels, colStatus } = mergeColumns(leftCols, rightCols);
  const rows = diffRows(leftRows, rightRows, leftCols, rightCols, allKeys);

  // Stats
  const added = rows.filter((r) => r.status === "added").length;
  const removed = rows.filter((r) => r.status === "removed").length;
  const modified = rows.filter((r) => r.status === "modified").length;

  // Default sort diff
  const leftSort = left.schema.defaultSort;
  const rightSort = right.schema.defaultSort;
  const sortChanged =
    JSON.stringify(leftSort ?? null) !== JSON.stringify(rightSort ?? null);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="text-green-700 font-medium">+{added} added</span>
        <span className="text-red-700 font-medium">-{removed} removed</span>
        <span className="text-yellow-700 font-medium">~{modified} changed</span>
        <span>{rows.filter((r) => r.status === "unchanged").length} unchanged</span>
      </div>

      {/* Default sort change */}
      {sortChanged && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-xs">
          <span className="font-medium text-yellow-800">Default sort changed:</span>
          <span className="text-yellow-700">
            {formatSort(leftSort, leftCols)}
          </span>
          <span className="text-yellow-600">&rarr;</span>
          <span className="text-yellow-700">
            {formatSort(rightSort, rightCols)}
          </span>
        </div>
      )}

      {/* Side-by-side tables */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left (older) */}
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500 px-1">{leftLabel}</div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  {allKeys.map((key) => {
                    const status = colStatus.get(key)!;
                    return (
                      <th
                        key={key}
                        className={`px-3 py-2 text-left font-medium text-zinc-600 whitespace-nowrap text-xs ${
                          status === "removed"
                            ? "bg-red-100 text-red-800"
                            : status === "added"
                            ? "bg-green-50 text-zinc-400"
                            : status === "changed"
                            ? "bg-yellow-100 text-yellow-800"
                            : ""
                        }`}
                      >
                        {colLabels.get(key)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((diff, i) => {
                  const row = diff.leftRow;
                  if (!row) {
                    // Added row — show empty placeholder
                    return (
                      <tr key={i} className="border-b border-zinc-100 bg-green-50/30">
                        {allKeys.map((key) => (
                          <td key={key} className="px-3 py-1.5 text-zinc-300 text-xs">&nbsp;</td>
                        ))}
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={i}
                      className={`border-b border-zinc-100 ${
                        diff.status === "removed" ? ROW_BG.removed : ""
                      }`}
                    >
                      {allKeys.map((key) => {
                        let cellCls = "";
                        if (diff.status === "removed") {
                          cellCls = STATUS_BG.removed;
                        } else if (diff.status === "modified" && diff.rightRow) {
                          const lv = formatCell(row[key] ?? null);
                          const rv = formatCell(diff.rightRow[key] ?? null);
                          if (lv !== rv) cellCls = STATUS_BG.changed;
                        }
                        return (
                          <td key={key} className={`px-3 py-1.5 text-zinc-700 whitespace-nowrap text-xs ${cellCls}`}>
                            {formatCell(row[key] ?? null)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right (newer) */}
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500 px-1">{rightLabel}</div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  {allKeys.map((key) => {
                    const status = colStatus.get(key)!;
                    return (
                      <th
                        key={key}
                        className={`px-3 py-2 text-left font-medium text-zinc-600 whitespace-nowrap text-xs ${
                          status === "added"
                            ? "bg-green-100 text-green-800"
                            : status === "removed"
                            ? "bg-red-50 text-zinc-400"
                            : status === "changed"
                            ? "bg-yellow-100 text-yellow-800"
                            : ""
                        }`}
                      >
                        {status === "removed"
                          ? colLabels.get(key)
                          : (right.schema.columns.find((c) => c.key === key)?.label ??
                            colLabels.get(key))}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((diff, i) => {
                  const row = diff.rightRow;
                  if (!row) {
                    // Removed row — show empty placeholder
                    return (
                      <tr key={i} className="border-b border-zinc-100 bg-red-50/30">
                        {allKeys.map((key) => (
                          <td key={key} className="px-3 py-1.5 text-zinc-300 text-xs">&nbsp;</td>
                        ))}
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={i}
                      className={`border-b border-zinc-100 ${
                        diff.status === "added" ? ROW_BG.added : ""
                      }`}
                    >
                      {allKeys.map((key) => {
                        let cellCls = "";
                        if (diff.status === "added") {
                          cellCls = STATUS_BG.added;
                        } else if (diff.status === "modified" && diff.leftRow) {
                          const lv = formatCell(diff.leftRow[key] ?? null);
                          const rv = formatCell(row[key] ?? null);
                          if (lv !== rv) cellCls = STATUS_BG.changed;
                        }
                        return (
                          <td key={key} className={`px-3 py-1.5 text-zinc-700 whitespace-nowrap text-xs ${cellCls}`}>
                            {formatCell(row[key] ?? null)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
