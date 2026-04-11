"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import type { ColumnDef, Row, CellValue } from "@/lib/types";
import { useColumnResize } from "./useColumnResize";

type SortDir = "asc" | "desc";

interface SortState {
  key: string;
  dir: SortDir;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function formatCell(value: CellValue, type: ColumnDef["type"]): string {
  if (value === null || value === undefined) return "—";
  if (type === "number" && typeof value === "number") {
    return value.toLocaleString();
  }
  return String(value);
}

function compareValues(a: CellValue, b: CellValue, type: ColumnDef["type"]): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (type === "number") return (a as number) - (b as number);
  return String(a).localeCompare(String(b));
}

interface Props {
  columns: ColumnDef[];
  rows: Row[];
  initialSort?: SortState;
  toolbarExtra?: ReactNode;
  pendingRows?: Row[];
  pendingColumns?: ColumnDef[];
}

export default function TableGrid({ columns, rows, initialSort, toolbarExtra, pendingRows, pendingColumns }: Props) {
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [query, setQuery] = useState("");
  const [filterCol, setFilterCol] = useState<string>("__all__");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const { getWidth, onMouseDown } = useColumnResize(150);

  // Pending change detection: split into modified vs removed
  const { pendingModifiedSet, pendingRemovedSet, pendingRemovedCols } = useMemo(() => {
    if (!pendingRows) return { pendingModifiedSet: null, pendingRemovedSet: null, pendingRemovedCols: new Set<string>() };

    const keys = columns.map((c) => c.key);
    const fingerprint = (row: Row) => keys.map((k) => String(row[k] ?? "")).join("\x00");

    // Build fingerprint counts for the pending version
    const pendingCounts = new Map<string, number>();
    for (const row of pendingRows) {
      const fp = fingerprint(row);
      pendingCounts.set(fp, (pendingCounts.get(fp) ?? 0) + 1);
    }

    // Identify published rows that don't have an exact match in pending
    const unmatched: Row[] = [];
    for (const row of rows) {
      const fp = fingerprint(row);
      const count = pendingCounts.get(fp) ?? 0;
      if (count > 0) {
        pendingCounts.set(fp, count - 1);
      } else {
        unmatched.push(row);
      }
    }

    // Among unmatched: try first-column matching to distinguish modified vs removed
    const modified = new Set<Row>();
    const removed = new Set<Row>();
    const firstKey = columns.length > 0 ? columns[0].key : null;

    if (firstKey) {
      // Build first-col counts from pending rows
      const pendingFirstCounts = new Map<string, number>();
      for (const row of pendingRows) {
        const k = String(row[firstKey] ?? "");
        pendingFirstCounts.set(k, (pendingFirstCounts.get(k) ?? 0) + 1);
      }
      // Consume exact-matched rows' first-col values
      const exactCounts = new Map<string, number>();
      for (const row of rows) {
        if (!unmatched.includes(row)) {
          const k = String(row[firstKey] ?? "");
          exactCounts.set(k, (exactCounts.get(k) ?? 0) + 1);
        }
      }
      // Remaining first-col budget = pending first-col counts minus exact matches
      const remainingFirstCounts = new Map<string, number>();
      for (const [k, v] of pendingFirstCounts) {
        const used = exactCounts.get(k) ?? 0;
        if (v - used > 0) remainingFirstCounts.set(k, v - used);
      }

      for (const row of unmatched) {
        const k = String(row[firstKey] ?? "");
        const budget = remainingFirstCounts.get(k) ?? 0;
        if (budget > 0) {
          modified.add(row);
          remainingFirstCounts.set(k, budget - 1);
        } else {
          removed.add(row);
        }
      }
    } else {
      for (const row of unmatched) removed.add(row);
    }

    // Columns removed in pending version
    const removedCols = new Set<string>();
    if (pendingColumns) {
      const pendingColKeys = new Set(pendingColumns.map((c) => c.key));
      for (const col of columns) {
        if (!pendingColKeys.has(col.key)) removedCols.add(col.key);
      }
    }

    return {
      pendingModifiedSet: modified.size > 0 ? modified : null,
      pendingRemovedSet: removed.size > 0 ? removed : null,
      pendingRemovedCols: removedCols,
    };
  }, [rows, pendingRows, columns, pendingColumns]);

  const hasPendingChanges = !!(pendingModifiedSet || pendingRemovedSet || pendingRemovedCols.size > 0);

  function handleHeaderClick(key: string) {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === "asc"
          ? { key, dir: "desc" }
          : initialSort?.key !== key ? (initialSort ?? null) : null;
      }
      return { key, dir: "asc" };
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const keys = filterCol === "__all__" ? columns.map((c) => c.key) : [filterCol];
      return keys.some((k) => String(row[k] ?? "").toLowerCase().includes(q));
    });
  }, [rows, columns, query, filterCol]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = compareValues(a[col.key], b[col.key], col.type);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, columns, sort]);

  useEffect(() => { setPage(0); }, [query, filterCol, sorted.length]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize);
  const firstRow = sorted.length === 0 ? 0 : clampedPage * pageSize + 1;
  const lastRow = Math.min((clampedPage + 1) * pageSize, sorted.length);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={filterCol}
          onChange={(e) => setFilterCol(e.target.value)}
          className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
        >
          <option value="__all__">All columns</option>
          {columns.map((col) => (
            <option key={col.key} value={col.key}>{col.label}</option>
          ))}
        </select>
        {query && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
            {sorted.length} match{sorted.length !== 1 ? "es" : ""}
          </span>
        )}
        {toolbarExtra && <div className="ml-auto flex items-center">{toolbarExtra}</div>}
      </div>

      {/* Pending changes notice */}
      {hasPendingChanges && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Pending edit awaiting approval
            {pendingModifiedSet && <>{" "}&middot; {pendingModifiedSet.size} row{pendingModifiedSet.size !== 1 ? "s" : ""} modified</>}
            {pendingRemovedSet && <>{" "}&middot; {pendingRemovedSet.size} row{pendingRemovedSet.size !== 1 ? "s" : ""} removed</>}
            {pendingRemovedCols.size > 0 && <>{" "}&middot; {pendingRemovedCols.size} column{pendingRemovedCols.size !== 1 ? "s" : ""} removed</>}
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm border-collapse" style={{ minWidth: columns.reduce((sum, col) => sum + getWidth(col.key), 0), tableLayout: "fixed" }}>
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: getWidth(col.key) }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const isColRemoved = pendingRemovedCols.has(col.key);
                return (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col.key)}
                    className={[
                      "px-4 py-2.5 text-left font-medium relative",
                      "cursor-pointer select-none transition-colors",
                      isColRemoved
                        ? "bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-400"
                        : [
                            "text-zinc-600 dark:text-zinc-400",
                            "hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700",
                            active ? "text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-700" : "",
                          ].join(" "),
                    ].join(" ")}
                    style={{ width: getWidth(col.key) }}
                  >
                    <span className={`inline-flex items-center gap-1.5 truncate max-w-full ${isColRemoved ? "line-through" : ""}`}>
                      {col.label}
                      {!isColRemoved && <SortIcon active={active} dir={sort?.dir ?? "asc"} />}
                    </span>
                    <span
                      onMouseDown={(e) => onMouseDown(col.key, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/40 transition-colors"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  No rows match &ldquo;{query}&rdquo;
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => {
                const isModified = pendingModifiedSet?.has(row) ?? false;
                const isRemoved = pendingRemovedSet?.has(row) ?? false;
                const isPending = isModified || isRemoved;
                return (
                  <tr
                    key={i}
                    className={[
                      "border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors",
                      isPending
                        ? "bg-amber-50 dark:bg-amber-900/15"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800",
                    ].join(" ")}
                  >
                    {columns.map((col, ci) => {
                      const isColRemoved = pendingRemovedCols.has(col.key);
                      const useStrike = isRemoved || isColRemoved;
                      return (
                        <td
                          key={col.key}
                          className={[
                            "px-4 py-2 truncate",
                            isPending || isColRemoved
                              ? "text-amber-800 dark:text-amber-300"
                              : "text-zinc-700 dark:text-zinc-300",
                            col.type === "number" ? "tabular-nums text-right" : "",
                          ].join(" ")}
                        >
                          <span className={useStrike ? "line-through" : ""}>
                            {formatCell(row[col.key] ?? null, col.type)}
                          </span>
                          {isPending && ci === 0 && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                              {isRemoved ? "pending removal" : "pending"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <span className="text-xs">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-1 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-xs tabular-nums">
            {sorted.length === 0 ? "0 rows" : `${firstRow}–${lastRow} of ${sorted.length.toLocaleString()}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <NavButton onClick={() => setPage(0)} disabled={clampedPage === 0} title="First page">«</NavButton>
          <NavButton onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} title="Previous page">‹</NavButton>
          <span className="px-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {clampedPage + 1} / {totalPages}
          </span>
          <NavButton onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={clampedPage >= totalPages - 1} title="Next page">›</NavButton>
          <NavButton onClick={() => setPage(totalPages - 1)} disabled={clampedPage >= totalPages - 1} title="Last page">»</NavButton>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  onClick, disabled, title, children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base leading-none"
    >
      {children}
    </button>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="w-3 h-3 text-zinc-300 dark:text-zinc-600" viewBox="0 0 8 12" fill="currentColor">
        <path d="M4 0L7 4H1L4 0ZM4 12L1 8H7L4 12Z" />
      </svg>
    );
  }
  return (
    <svg className="w-3 h-3 text-zinc-600 dark:text-zinc-400" viewBox="0 0 8 8" fill="currentColor">
      {dir === "asc"
        ? <path d="M4 0L8 6H0L4 0Z" />
        : <path d="M4 8L0 2H8L4 8Z" />}
    </svg>
  );
}
