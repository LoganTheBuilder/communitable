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
  added: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300",
  removed: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-300",
  changed: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-300",
};

const ROW_BG: Record<"added" | "removed", string> = {
  added: "bg-green-50 dark:bg-green-900/20",
  removed: "bg-red-50 dark:bg-red-900/20",
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
 * Build a full-row fingerprint for exact matching across versions.
 */
function fingerprint(row: Row, keys: string[]): string {
  return keys.map((k) => String(row[k] ?? "")).join("\x00");
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
  _rightCols: ColumnDef[],
  allKeys: string[]
): DiffRow[] {
  // Pass 1: Match identical rows using full-row fingerprints (count-based)
  const rightFpCounts = new Map<string, number>();
  for (const row of rightRows) {
    const fp = fingerprint(row, allKeys);
    rightFpCounts.set(fp, (rightFpCounts.get(fp) ?? 0) + 1);
  }

  const leftMatched = new Array<boolean>(leftRows.length).fill(false);
  for (let i = 0; i < leftRows.length; i++) {
    const fp = fingerprint(leftRows[i], allKeys);
    const count = rightFpCounts.get(fp) ?? 0;
    if (count > 0) {
      leftMatched[i] = true;
      rightFpCounts.set(fp, count - 1);
    }
  }

  // Remaining right rows (not exactly matched) — track by index
  const rightExactMatched = new Array<boolean>(rightRows.length).fill(false);
  const rightFpCounts2 = new Map<string, number>();
  for (const row of rightRows) {
    const fp = fingerprint(row, allKeys);
    rightFpCounts2.set(fp, (rightFpCounts2.get(fp) ?? 0) + 1);
  }
  // Consume the same way to mark which right rows were matched
  for (let i = 0; i < leftRows.length; i++) {
    if (!leftMatched[i]) continue;
    const fp = fingerprint(leftRows[i], allKeys);
    // Find first unmatched right row with this fingerprint
    for (let j = 0; j < rightRows.length; j++) {
      if (rightExactMatched[j]) continue;
      if (fingerprint(rightRows[j], allKeys) === fp) {
        rightExactMatched[j] = true;
        break;
      }
    }
  }

  // Pass 2: For unmatched rows, try first-column matching for "modified" detection
  const firstKey = leftCols.length > 0 ? leftCols[0].key : null;

  const unmatchedLeft: { idx: number; row: Row }[] = [];
  for (let i = 0; i < leftRows.length; i++) {
    if (!leftMatched[i]) unmatchedLeft.push({ idx: i, row: leftRows[i] });
  }

  const unmatchedRight: { idx: number; row: Row }[] = [];
  for (let j = 0; j < rightRows.length; j++) {
    if (!rightExactMatched[j]) unmatchedRight.push({ idx: j, row: rightRows[j] });
  }

  // Try to pair unmatched rows by first-column value
  const modifiedPairs: { leftIdx: number; rightIdx: number }[] = [];
  if (firstKey) {
    const rightByFirstCol = new Map<string, { idx: number; row: Row }[]>();
    for (const entry of unmatchedRight) {
      const k = String(entry.row[firstKey] ?? "");
      if (!rightByFirstCol.has(k)) rightByFirstCol.set(k, []);
      rightByFirstCol.get(k)!.push(entry);
    }

    const pairedRightIndices = new Set<number>();
    for (const entry of unmatchedLeft) {
      const k = String(entry.row[firstKey] ?? "");
      const candidates = rightByFirstCol.get(k);
      if (candidates && candidates.length > 0) {
        const match = candidates.shift()!;
        modifiedPairs.push({ leftIdx: entry.idx, rightIdx: match.idx });
        pairedRightIndices.add(match.idx);
      }
    }

    // Remove paired entries from unmatched lists
    const pairedLeftIndices = new Set(modifiedPairs.map((p) => p.leftIdx));
    unmatchedLeft.length = 0;
    for (let i = 0; i < leftRows.length; i++) {
      if (!leftMatched[i] && !pairedLeftIndices.has(i)) unmatchedLeft.push({ idx: i, row: leftRows[i] });
    }
    unmatchedRight.length = 0;
    for (let j = 0; j < rightRows.length; j++) {
      if (!rightExactMatched[j] && !pairedRightIndices.has(j)) unmatchedRight.push({ idx: j, row: rightRows[j] });
    }
  }

  // Build result in left-row order, appending added rows at end
  const result: DiffRow[] = [];
  const modifiedByLeft = new Map(modifiedPairs.map((p) => [p.leftIdx, p.rightIdx]));

  for (let i = 0; i < leftRows.length; i++) {
    if (leftMatched[i]) {
      result.push({ leftRow: leftRows[i], rightRow: leftRows[i], status: "unchanged" });
    } else if (modifiedByLeft.has(i)) {
      result.push({ leftRow: leftRows[i], rightRow: rightRows[modifiedByLeft.get(i)!], status: "modified" });
    } else {
      result.push({ leftRow: leftRows[i], rightRow: null, status: "removed" });
    }
  }

  for (const entry of unmatchedRight) {
    result.push({ leftRow: null, rightRow: entry.row, status: "added" });
  }

  return result;
}

function formatSort(sort: DefaultSort | null | undefined, columns: ColumnDef[]): string {
  if (!sort) return "None";
  const col = columns.find((c) => c.key === sort.key);
  return `${col?.label ?? sort.key} (${sort.dir})`;
}

type DisplayRow = {
  type: "diff";
  diff: DiffRow;
} | {
  type: "ellipsis";
}

interface DiffStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

function buildDisplayRows(rows: DiffRow[]): { display: DisplayRow[]; stats: DiffStats } {
  const stats: DiffStats = { added: 0, removed: 0, modified: 0, unchanged: 0 };
  const changedIndices: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const s = rows[i].status;
    if (s === "unchanged") stats.unchanged++;
    else {
      if (s === "added") stats.added++;
      else if (s === "removed") stats.removed++;
      else stats.modified++;
      changedIndices.push(i);
    }
  }

  if (changedIndices.length === 0) return { display: [], stats };
  if (changedIndices.length === rows.length) {
    return { display: rows.map((diff) => ({ type: "diff" as const, diff })), stats };
  }

  const display: DisplayRow[] = [];
  let lastShown = -1;

  for (const idx of changedIndices) {
    if (idx > lastShown + 1) {
      display.push({ type: "ellipsis" });
    }
    display.push({ type: "diff", diff: rows[idx] });
    lastShown = idx;
  }

  if (lastShown < rows.length - 1) {
    display.push({ type: "ellipsis" });
  }

  return { display, stats };
}

function EllipsisRow({ colSpan }: { colSpan: number }) {
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td colSpan={colSpan} className="px-3 py-1 text-center text-xs text-zinc-400 dark:text-zinc-500">…</td>
    </tr>
  );
}

export default function DiffView({ left, right, leftLabel, rightLabel }: Props) {
  const leftCols = left.schema.columns;
  const rightCols = right.schema.columns;
  const leftRows = left.data?.rows ?? [];
  const rightRows = right.data?.rows ?? [];

  const { allKeys, colLabels, colStatus } = mergeColumns(leftCols, rightCols);
  const rows = diffRows(leftRows, rightRows, leftCols, rightCols, allKeys);
  const { display: displayRows, stats } = buildDisplayRows(rows);
  const { added, removed, modified } = stats;

  const rightColLabels = new Map(rightCols.map((c) => [c.key, c.label]));

  // Default sort diff
  const leftSort = left.schema.defaultSort;
  const rightSort = right.schema.defaultSort;
  const sortChanged =
    JSON.stringify(leftSort ?? null) !== JSON.stringify(rightSort ?? null);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="text-green-700 dark:text-green-400 font-medium">+{added} added</span>
        <span className="text-red-700 dark:text-red-400 font-medium">-{removed} removed</span>
        <span className="text-yellow-700 dark:text-yellow-400 font-medium">~{modified} changed</span>
        <span>{stats.unchanged} unchanged</span>
      </div>

      {/* Default sort change */}
      {sortChanged && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-xs">
          <span className="font-medium text-yellow-800 dark:text-yellow-300">Default sort changed:</span>
          <span className="text-yellow-700 dark:text-yellow-400">
            {formatSort(leftSort, leftCols)}
          </span>
          <span className="text-yellow-600 dark:text-yellow-500">&rarr;</span>
          <span className="text-yellow-700 dark:text-yellow-400">
            {formatSort(rightSort, rightCols)}
          </span>
        </div>
      )}

      {/* Side-by-side tables */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left (older) */}
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 px-1">{leftLabel}</div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                  {allKeys.map((key) => {
                    const status = colStatus.get(key)!;
                    return (
                      <th
                        key={key}
                        className={`px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap text-xs ${
                          status === "removed"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : status === "added"
                            ? "bg-green-50 text-zinc-400 dark:bg-green-900/10 dark:text-zinc-500"
                            : status === "changed"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : ""
                        }`}
                      >
                        <span className={status === "removed" ? "line-through" : ""}>{colLabels.get(key)}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((entry, i) => {
                  if (entry.type === "ellipsis") {
                    return <EllipsisRow key={`e${i}`} colSpan={allKeys.length} />;
                  }
                  const diff = entry.diff;
                  const row = diff.leftRow;
                  if (!row) {
                    return (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 bg-green-50/30 dark:bg-green-900/10">
                        {allKeys.map((key) => (
                          <td key={key} className="px-3 py-1.5 text-zinc-300 dark:text-zinc-600 text-xs">&nbsp;</td>
                        ))}
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={i}
                      className={`border-b border-zinc-100 dark:border-zinc-800 ${
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
                        const isRemoval = diff.status === "removed" || colStatus.get(key) === "removed";
                        return (
                          <td key={key} className={`px-3 py-1.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap text-xs ${cellCls}`}>
                            <span className={isRemoval ? "line-through" : ""}>{formatCell(row[key] ?? null)}</span>
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
          <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 px-1">{rightLabel}</div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                  {allKeys.map((key) => {
                    const status = colStatus.get(key)!;
                    return (
                      <th
                        key={key}
                        className={`px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap text-xs ${
                          status === "added"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : status === "removed"
                            ? "bg-red-50 text-red-400 dark:bg-red-900/10 dark:text-red-400/60"
                            : status === "changed"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : ""
                        }`}
                      >
                        <span className={status === "removed" ? "line-through" : ""}>
                          {status === "removed"
                            ? colLabels.get(key)
                            : (rightColLabels.get(key) ?? colLabels.get(key))}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((entry, i) => {
                  if (entry.type === "ellipsis") {
                    return <EllipsisRow key={`e${i}`} colSpan={allKeys.length} />;
                  }
                  const diff = entry.diff;
                  const row = diff.rightRow;
                  // Removed row — show left row's content with strikethrough
                  if (!row && diff.leftRow) {
                    return (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 bg-red-50/30 dark:bg-red-900/10">
                        {allKeys.map((key) => (
                          <td key={key} className="px-3 py-1.5 text-red-400 dark:text-red-400/60 whitespace-nowrap text-xs">
                            <span className="line-through">{formatCell(diff.leftRow![key] ?? null)}</span>
                          </td>
                        ))}
                      </tr>
                    );
                  }
                  if (!row) {
                    return (
                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 bg-red-50/30 dark:bg-red-900/10">
                        {allKeys.map((key) => (
                          <td key={key} className="px-3 py-1.5 text-zinc-300 dark:text-zinc-600 text-xs">&nbsp;</td>
                        ))}
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={i}
                      className={`border-b border-zinc-100 dark:border-zinc-800 ${
                        diff.status === "added" ? ROW_BG.added : ""
                      }`}
                    >
                      {allKeys.map((key) => {
                        let cellCls = "";
                        const isRemovedCol = colStatus.get(key) === "removed";
                        if (diff.status === "added") {
                          cellCls = STATUS_BG.added;
                        } else if (isRemovedCol) {
                          cellCls = "text-red-400 dark:text-red-400/60";
                        } else if (diff.status === "modified" && diff.leftRow) {
                          const lv = formatCell(diff.leftRow[key] ?? null);
                          const rv = formatCell(row[key] ?? null);
                          if (lv !== rv) cellCls = STATUS_BG.changed;
                        }
                        return (
                          <td key={key} className={`px-3 py-1.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap text-xs ${cellCls}`}>
                            <span className={isRemovedCol ? "line-through" : ""}>{formatCell(row[key] ?? null)}</span>
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
