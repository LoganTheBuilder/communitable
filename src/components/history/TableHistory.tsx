"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef, Row } from "@/lib/types";
import DiffView from "./DiffView";

interface VersionAuthor {
  id: string;
  displayName: string | null;
  userId: string;
}

interface DefaultSort {
  key: string;
  dir: "asc" | "desc";
}

export interface VersionEntry {
  id: string;
  version: number;
  branch: string;
  status: string;
  schema: { columns: ColumnDef[]; defaultSort?: DefaultSort | null };
  data: { rows: Row[] } | null;
  message: string | null;
  createdAt: string;
  author: VersionAuthor;
}

interface Props {
  versions: VersionEntry[];
  tableName: string;
  tableId: string;
  isOwner: boolean;
  activeBranch: string;
  bannedProfileIds: string[];
  ownerProfileId: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function authorName(author: VersionAuthor): string {
  return author.displayName || "Anonymous";
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function VersionPreview({ version, baseVersion }: { version: VersionEntry; baseVersion?: VersionEntry | null }) {
  const cols = version.schema.columns;
  const rows = version.data?.rows ?? [];
  const maxRows = 50;

  // Compute diff-aware data when comparing a pending version against its base
  const isPending = version.status === "PENDING_APPROVAL" && baseVersion;
  const baseCols = baseVersion?.schema.columns ?? [];
  const baseRows = baseVersion?.data?.rows ?? [];

  // Columns present in base but removed in pending
  const pendingKeys = new Set(cols.map((c) => c.key));
  const removedCols = isPending ? baseCols.filter((c) => !pendingKeys.has(c.key)) : [];
  const allCols = [...cols, ...removedCols];

  // Pair pending vs base rows: exact match → unchanged; first-column key match → modified;
  // otherwise → added (in pending) or removed (in base). Mirrors TableGrid's logic.
  let removedRows: Row[] = [];
  const modifiedByPendingRow = new Map<Row, Row>(); // pendingRow -> baseRow
  if (isPending) {
    const keys = allCols.map((c) => c.key);
    const fp = (row: Row) => keys.map((k) => String(row[k] ?? "")).join("\x00");
    const firstKey = allCols.length > 0 ? allCols[0].key : null;

    const pendingCounts = new Map<string, number>();
    for (const row of rows) {
      const f = fp(row);
      pendingCounts.set(f, (pendingCounts.get(f) ?? 0) + 1);
    }
    const unmatchedBase: Row[] = [];
    for (const row of baseRows) {
      const f = fp(row);
      const count = pendingCounts.get(f) ?? 0;
      if (count > 0) pendingCounts.set(f, count - 1);
      else unmatchedBase.push(row);
    }

    const baseCounts = new Map<string, number>();
    for (const row of baseRows) {
      const f = fp(row);
      baseCounts.set(f, (baseCounts.get(f) ?? 0) + 1);
    }
    const unmatchedPending: Row[] = [];
    for (const row of rows) {
      const f = fp(row);
      const count = baseCounts.get(f) ?? 0;
      if (count > 0) baseCounts.set(f, count - 1);
      else unmatchedPending.push(row);
    }

    if (firstKey) {
      const pendingByFirst = new Map<string, Row[]>();
      for (const row of unmatchedPending) {
        const k = String(row[firstKey] ?? "");
        const arr = pendingByFirst.get(k) ?? [];
        arr.push(row);
        pendingByFirst.set(k, arr);
      }
      for (const baseRow of unmatchedBase) {
        const k = String(baseRow[firstKey] ?? "");
        const candidates = pendingByFirst.get(k);
        if (candidates && candidates.length > 0) {
          const pendingRow = candidates.shift()!;
          modifiedByPendingRow.set(pendingRow, baseRow);
        } else {
          removedRows.push(baseRow);
        }
      }
    } else {
      removedRows = unmatchedBase;
    }
  }

  const displayRows = rows.slice(0, maxRows);
  const truncated = rows.length > maxRows;
  const removedColKeys = new Set(removedCols.map((c) => c.key));
  const modifiedCount = modifiedByPendingRow.size;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {version.status === "PUBLISHED" ? `v${version.version}` : "Pending change"}
          {version.branch !== "main" && (
            <span className="ml-2 text-sm font-normal text-zinc-500">({version.branch})</span>
          )}
        </h2>
        {version.message && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">— {version.message}</span>
        )}
        {version.status === "PENDING_APPROVAL" && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            pending approval
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
        {authorName(version.author)} &middot; {formatDate(version.createdAt)} &middot; {cols.length} col{cols.length !== 1 ? "s" : ""}, {rows.length} row{rows.length !== 1 ? "s" : ""}
        {isPending && (removedRows.length > 0 || removedCols.length > 0 || modifiedCount > 0) && (
          <span className="ml-2 text-amber-600 dark:text-amber-400">
            {modifiedCount > 0 && <>{modifiedCount} row{modifiedCount !== 1 ? "s" : ""} modified</>}
            {modifiedCount > 0 && (removedRows.length > 0 || removedCols.length > 0) && ", "}
            {removedRows.length > 0 && <>{removedRows.length} row{removedRows.length !== 1 ? "s" : ""} removed</>}
            {removedRows.length > 0 && removedCols.length > 0 && ", "}
            {removedCols.length > 0 && <>{removedCols.length} col{removedCols.length !== 1 ? "s" : ""} removed</>}
          </span>
        )}
        <span className="ml-3 text-zinc-400 dark:text-zinc-600 italic">Select a second version to compare</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
              {allCols.map((col) => {
                const isRemoved = removedColKeys.has(col.key);
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-left font-medium whitespace-nowrap text-xs ${
                      isRemoved
                        ? "bg-red-50 dark:bg-red-900/10 text-red-400 dark:text-red-400/60"
                        : "text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <span className={isRemoved ? "line-through" : ""}>{col.label}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => {
              const baseRow = modifiedByPendingRow.get(row);
              const isModified = !!baseRow;
              return (
                <tr
                  key={i}
                  className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${
                    isModified ? "bg-amber-50/40 dark:bg-amber-900/10" : ""
                  }`}
                >
                  {allCols.map((col) => {
                    const isRemoved = removedColKeys.has(col.key);
                    const newVal = formatCellValue(row[col.key] ?? null);
                    const oldVal = baseRow ? formatCellValue(baseRow[col.key] ?? null) : newVal;
                    const isCellChanged = isModified && !isRemoved && oldVal !== newVal;
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-1.5 whitespace-nowrap text-xs ${
                          isRemoved
                            ? "text-red-400 dark:text-red-400/60"
                            : isCellChanged
                            ? "text-amber-800 dark:text-amber-300"
                            : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {isCellChanged ? (
                          <>
                            <span className="line-through text-zinc-400 dark:text-zinc-500 mr-1.5">{oldVal}</span>
                            <span className="font-medium">{newVal}</span>
                          </>
                        ) : (
                          <span className={isRemoved ? "line-through" : ""}>{newVal}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Removed rows shown with strikethrough */}
            {removedRows.map((row, i) => (
              <tr key={`rm-${i}`} className="border-b border-zinc-100 dark:border-zinc-800 bg-red-50/30 dark:bg-red-900/10">
                {allCols.map((col) => (
                  <td key={col.key} className="px-3 py-1.5 text-red-400 dark:text-red-400/60 whitespace-nowrap text-xs">
                    <span className="line-through">{formatCellValue(row[col.key] ?? null)}</span>
                  </td>
                ))}
              </tr>
            ))}
            {truncated && (
              <tr>
                <td colSpan={allCols.length} className="px-3 py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  &hellip; {rows.length - maxRows} more row{rows.length - maxRows !== 1 ? "s" : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const HISTORY_PAGE_SIZE = 20;

export default function TableHistory({ versions, tableName, tableId, isOwner, activeBranch, bannedProfileIds, ownerProfileId }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<[string | null, string | null]>([null, null]);
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set(bannedProfileIds));
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<{ previousVersionId: string; version: number } | null>(null);
  const [authorQuery, setAuthorQuery] = useState("");
  const [dateDir, setDateDir] = useState<"newest" | "oldest">("newest");
  const [historyPage, setHistoryPage] = useState(0);

  const branches = useMemo(() => [...new Set(versions.map((v) => v.branch))].sort(), [versions]);

  const sortedVersions = useMemo(() => {
    let filtered = branchFilter ? versions.filter((v) => v.branch === branchFilter) : versions;

    // Author search
    const q = authorQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((v) => authorName(v.author).toLowerCase().includes(q));
    }

    return [...filtered].sort((a, b) => {
      if (a.branch === activeBranch && b.branch !== activeBranch) return -1;
      if (b.branch === activeBranch && a.branch !== activeBranch) return 1;
      if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return dateDir === "newest" ? bt - at : at - bt;
    });
  }, [versions, branchFilter, activeBranch, authorQuery, dateDir]);

  // Reset page when filters change
  useEffect(() => { setHistoryPage(0); }, [authorQuery, branchFilter, dateDir, sortedVersions.length]);

  const totalHistoryPages = Math.max(1, Math.ceil(sortedVersions.length / HISTORY_PAGE_SIZE));
  const clampedHistoryPage = Math.min(historyPage, totalHistoryPages - 1);
  const pagedVersions = sortedVersions.slice(clampedHistoryPage * HISTORY_PAGE_SIZE, (clampedHistoryPage + 1) * HISTORY_PAGE_SIZE);

  function toggleSelect(id: string) {
    setSelected(([a, b]) => {
      if (a === id) return [b, null];
      if (b === id) return [a, null];
      if (!a) return [id, null];
      if (!b) return [a, id];
      return [a, id];
    });
  }

  async function handleBan(profileId: string) {
    setActionLoading(`ban-${profileId}`);
    try {
      const res = await fetch(`/api/tables/${tableId}/bans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (res.ok) setBannedIds((prev) => new Set(prev).add(profileId));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnban(profileId: string) {
    setActionLoading(`unban-${profileId}`);
    try {
      const res = await fetch(`/api/tables/${tableId}/bans`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (res.ok) {
        setBannedIds((prev) => {
          const next = new Set(prev);
          next.delete(profileId);
          return next;
        });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function executeRevert(versionId: string) {
    setConfirmRevertId(null);
    setActionLoading(`revert-${versionId}`);
    try {
      const res = await fetch(`/api/tables/${tableId}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (data.ok && data.previousVersionId) {
        const v = versions.find((v) => v.id === versionId);
        setUndoState({ previousVersionId: data.previousVersionId, version: v?.version ?? 0 });
      }
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  // Auto-dismiss undo toast after 8 seconds
  useEffect(() => {
    if (!undoState) return;
    const timer = setTimeout(() => setUndoState(null), 8000);
    return () => clearTimeout(timer);
  }, [undoState]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;
    const { previousVersionId } = undoState;
    setUndoState(null);
    setActionLoading("undo");
    try {
      await fetch(`/api/tables/${tableId}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: previousVersionId }),
      });
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }, [undoState, tableId, router]);

  async function handleApproval(versionId: string, action: "approve" | "reject") {
    setActionLoading(`${action}-${versionId}`);
    try {
      await fetch(`/api/tables/${tableId}/versions/${versionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  // Latest published version on the active branch — no point reverting to this
  const currentVersionId = useMemo(
    () => versions.find((v) => v.branch === activeBranch && v.status === "PUBLISHED")?.id ?? null,
    [versions, activeBranch],
  );

  const currentVersion = currentVersionId ? versions.find((v) => v.id === currentVersionId) ?? null : null;

  const leftVersion = sortedVersions.find((v) => v.id === selected[0]) ?? null;
  const rightVersion = sortedVersions.find((v) => v.id === selected[1]) ?? null;

  const [older, newer] =
    leftVersion && rightVersion && leftVersion.version > rightVersion.version
      ? [rightVersion, leftVersion]
      : [leftVersion, rightVersion];

  const showDiff = older && newer;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {sortedVersions.length === versions.length
              ? `${versions.length} version${versions.length !== 1 ? "s" : ""}`
              : `${sortedVersions.length} of ${versions.length} versions`}
          </h2>
          <div className="flex items-center gap-3">
            {/* Author search */}
            <div className="relative">
              <input
                type="text"
                value={authorQuery}
                onChange={(e) => setAuthorQuery(e.target.value)}
                placeholder="Search author…"
                className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded pl-2 pr-6 py-1 text-zinc-600 dark:text-zinc-400 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-32"
              />
              {authorQuery && (
                <button
                  onClick={() => setAuthorQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            {/* Date sort */}
            <button
              onClick={() => setDateDir((d) => d === "newest" ? "oldest" : "newest")}
              className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              title={`Currently: ${dateDir} first`}
            >
              {dateDir === "newest" ? "Newest first" : "Oldest first"}
            </button>
            {/* Branch filter */}
            {branches.length > 1 && (
              <select
                value={branchFilter ?? ""}
                onChange={(e) => setBranchFilter(e.target.value || null)}
                className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-600 dark:text-zinc-400"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}{b === activeBranch ? " (active)" : ""}
                  </option>
                ))}
              </select>
            )}
            {selected[0] || selected[1] ? (
              <button
                onClick={() => setSelected([null, null])}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                Clear selection
              </button>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Select two versions to compare</p>
            )}
          </div>
        </div>

        {sortedVersions.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">
            {authorQuery ? "No versions match that author." : "No versions saved yet."}
          </p>
        ) : (
          <div className="space-y-1">
            {pagedVersions.map((v) => {
              const isSelected = selected[0] === v.id || selected[1] === v.id;
              const selIndex = selected[0] === v.id ? 0 : selected[1] === v.id ? 1 : -1;
              const isBanned = bannedIds.has(v.author.id);
              const isPending = v.status === "PENDING_APPROVAL";
              const isRejected = v.status === "REJECTED";
              return (
                <div
                  key={v.id}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    isSelected
                      ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800 ring-1 ring-zinc-900 dark:ring-zinc-100"
                      : isPending
                      ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10"
                      : isRejected
                      ? "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10 opacity-60"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      onClick={() => toggleSelect(v.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs flex items-center justify-center font-medium">
                            {selIndex === 0 ? "A" : "B"}
                          </span>
                        )}
                        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {v.status === "PUBLISHED" ? `v${v.version}` : isPending ? "Pending" : "Rejected"}
                        </span>
                        {v.branch !== "main" && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                            {v.branch}
                          </span>
                        )}
                        {v.id === currentVersionId && branches.length > 1 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            active
                          </span>
                        )}
                        {isPending && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            pending approval
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            rejected
                          </span>
                        )}
                        {v.message && (
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                            — {v.message}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                            {authorName(v.author).charAt(0).toUpperCase()}
                          </span>
                          {authorName(v.author)}
                          {isBanned && (
                            <span className="text-red-500 dark:text-red-400 text-[10px]">(banned)</span>
                          )}
                        </span>
                        <span>{formatDate(v.createdAt)}</span>
                        <span>
                          {v.schema.columns.length} col{v.schema.columns.length !== 1 ? "s" : ""}
                          {v.data ? `, ${v.data.rows.length} row${v.data.rows.length !== 1 ? "s" : ""}` : ""}
                        </span>
                        {v.schema.defaultSort && (
                          <span className="text-zinc-500 dark:text-zinc-500">
                            sorted by {v.schema.columns.find((c) => c.key === v.schema.defaultSort!.key)?.label ?? v.schema.defaultSort.key} ({v.schema.defaultSort.dir})
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Owner actions */}
                    {isOwner && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Approve/Reject for pending versions */}
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleApproval(v.id, "approve")}
                              disabled={actionLoading === `approve-${v.id}`}
                              className="px-2 py-1 text-[11px] rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproval(v.id, "reject")}
                              disabled={actionLoading === `reject-${v.id}`}
                              className="px-2 py-1 text-[11px] rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {/* Revert button with inline confirm */}
                        {v.status === "PUBLISHED" && v.id !== currentVersionId && (
                          confirmRevertId === v.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Revert?</span>
                              <button
                                onClick={() => { void executeRevert(v.id); }}
                                disabled={!!actionLoading}
                                className="px-2 py-1 text-[11px] rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === `revert-${v.id}` ? "Reverting..." : "Confirm"}
                              </button>
                              <button
                                onClick={() => setConfirmRevertId(null)}
                                className="px-2 py-1 text-[11px] rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmRevertId(v.id)}
                              disabled={!!actionLoading}
                              className="px-2 py-1 text-[11px] rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                              title="Revert to this version"
                            >
                              Revert
                            </button>
                          )
                        )}
                        {/* Ban/unban (only for non-owner authors) */}
                        {v.author.id && v.author.id !== ownerProfileId && (
                          isBanned ? (
                            <button
                              onClick={() => handleUnban(v.author.id)}
                              disabled={!!actionLoading}
                              className="px-2 py-1 text-[11px] rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === `unban-${v.author.id}` ? "..." : "Unban"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBan(v.author.id)}
                              disabled={!!actionLoading}
                              className="px-2 py-1 text-[11px] rounded border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-500 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-700 disabled:opacity-50 transition-colors"
                              title="Ban this user from editing"
                            >
                              {actionLoading === `ban-${v.author.id}` ? "..." : "Ban"}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalHistoryPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums">
              {clampedHistoryPage * HISTORY_PAGE_SIZE + 1}–{Math.min((clampedHistoryPage + 1) * HISTORY_PAGE_SIZE, sortedVersions.length)} of {sortedVersions.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setHistoryPage(0)}
                disabled={clampedHistoryPage === 0}
                className="w-7 h-7 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                «
              </button>
              <button
                onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                disabled={clampedHistoryPage === 0}
                className="w-7 h-7 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ‹
              </button>
              <span className="px-2 tabular-nums">{clampedHistoryPage + 1} / {totalHistoryPages}</span>
              <button
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages - 1, p + 1))}
                disabled={clampedHistoryPage >= totalHistoryPages - 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ›
              </button>
              <button
                onClick={() => setHistoryPage(totalHistoryPages - 1)}
                disabled={clampedHistoryPage >= totalHistoryPages - 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {showDiff ? (() => {
        const olderLabel = older.status === "PUBLISHED" ? `v${older.version}` : older.status === "REJECTED" ? "Rejected" : "Pending";
        const newerLabel = newer.status === "PUBLISHED" ? `v${newer.version}` : newer.status === "REJECTED" ? "Rejected" : "Pending";
        return (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Comparing {olderLabel} → {newerLabel}
          </h2>
          <DiffView
            left={{ schema: older.schema, data: older.data }}
            right={{ schema: newer.schema, data: newer.data }}
            leftLabel={`${olderLabel}${older.branch !== "main" ? ` (${older.branch})` : ""}${older.message ? ` — ${older.message}` : ""}`}
            rightLabel={`${newerLabel}${newer.branch !== "main" ? ` (${newer.branch})` : ""}${newer.message ? ` — ${newer.message}` : ""}`}
          />
        </div>
        );
      })() : leftVersion && !rightVersion ? (
        <VersionPreview version={leftVersion} baseVersion={currentVersion} />
      ) : null}

      {/* Undo toast */}
      {undoState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg shadow-lg text-sm">
          <span>Reverted to v{undoState.version}</span>
          <button
            onClick={() => { void handleUndo(); }}
            disabled={actionLoading === "undo"}
            className="px-3 py-1 rounded bg-white/20 dark:bg-zinc-900/20 hover:bg-white/30 dark:hover:bg-zinc-900/30 font-medium transition-colors disabled:opacity-50"
          >
            {actionLoading === "undo" ? "Undoing..." : "Undo"}
          </button>
          <button
            onClick={() => setUndoState(null)}
            className="text-white/60 dark:text-zinc-900/60 hover:text-white dark:hover:text-zinc-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
