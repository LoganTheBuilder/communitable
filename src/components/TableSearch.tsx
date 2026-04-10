"use client";

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DirectoryEntry {
  id: string;
  name: string;
  description: string | null;
  author: string;
  rowCount?: number;
  collaboratorCount?: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
  published?: boolean;
  notification?: "new-collaborator" | "updated-recently" | null;
}

const HOT_THRESHOLD = 25;
const CROWDED_THRESHOLD = 3;
const NEW_THRESHOLD_MS = 86_400_000; // 24 hours

interface Props {
  tables: DirectoryEntry[];
  /** Rendered to the left of the sort chips (e.g. New Table button) */
  actions?: ReactNode;
}

type SortMode = "default" | "popular" | "crowded" | "updated";
type DatePreset = "any" | "today" | "week" | "month" | "year" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "any",    label: "Any time" },
  { value: "today",  label: "Today" },
  { value: "week",   label: "Past week" },
  { value: "month",  label: "Past month" },
  { value: "year",   label: "Past year" },
  { value: "custom", label: "Custom range…" },
];

const SORT_CHIPS: { value: SortMode; label: string; title: string }[] = [
  { value: "popular", label: "Popular",  title: "Sort by most views" },
  { value: "crowded", label: "Crowded",  title: "Sort by most collaborators" },
  { value: "updated", label: "Updated",  title: "Sort by most recently updated" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function dateMatchesFilter(
  dateStr: string,
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): boolean {
  if (preset === "any") return true;
  if (preset === "custom") {
    const d = new Date(dateStr);
    if (customFrom && d < new Date(customFrom)) return false;
    if (customTo) {
      const to = new Date(customTo);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  }
  const diff = Date.now() - new Date(dateStr).getTime();
  const day = 86_400_000;
  switch (preset) {
    case "today": return diff < day;
    case "week":  return diff < 7 * day;
    case "month": return diff < 30 * day;
    case "year":  return diff < 365 * day;
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)    return "just now";
  if (mins < 60)   return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)  return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)    return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5)   return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function TableSearch({ tables, actions }: Props) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Author combobox
  const [author, setAuthor] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [authorOpen, setAuthorOpen] = useState(false);
  const authorRef = useRef<HTMLDivElement>(null);

  // Date filters
  const [dateCreated, setDateCreated] = useState<DatePreset>("any");
  const [dateUpdated, setDateUpdated] = useState<DatePreset>("any");
  const [customCreatedFrom, setCustomCreatedFrom] = useState("");
  const [customCreatedTo, setCustomCreatedTo] = useState("");
  const [customUpdatedFrom, setCustomUpdatedFrom] = useState("");
  const [customUpdatedTo, setCustomUpdatedTo] = useState("");

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const authors = useMemo(() => {
    const set = new Set(tables.map((t) => t.author));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tables]);

  const filteredAuthors = useMemo(() => {
    const q = authorQuery.toLowerCase();
    if (!q) return authors;
    return authors.filter((a) => a.toLowerCase().includes(q));
  }, [authors, authorQuery]);

  // Close author dropdown on outside click
  useEffect(() => {
    if (!authorOpen) return;
    const handler = (e: MouseEvent) => {
      if (authorRef.current && !authorRef.current.contains(e.target as Node)) {
        setAuthorQuery(author); // restore to last confirmed selection
        setAuthorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [authorOpen, author]);

  function selectAuthor(a: string) {
    setAuthor(a);
    setAuthorQuery(a);
    setAuthorOpen(false);
  }

  function clearAuthor() {
    setAuthor("");
    setAuthorQuery("");
    setAuthorOpen(false);
  }

  const hasActiveFilters =
    author !== "" ||
    dateCreated !== "any" ||
    dateUpdated !== "any";

  function clearFilters() {
    setAuthor("");
    setAuthorQuery("");
    setDateCreated("any");
    setDateUpdated("any");
    setCustomCreatedFrom("");
    setCustomCreatedTo("");
    setCustomUpdatedFrom("");
    setCustomUpdatedTo("");
  }

  const filtered = useMemo(() => {
    return tables.filter((t) => {
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const match =
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false) ||
          t.author.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (author && t.author !== author) return false;
      if (!dateMatchesFilter(t.createdAt, dateCreated, customCreatedFrom, customCreatedTo)) return false;
      if (!dateMatchesFilter(t.updatedAt, dateUpdated, customUpdatedFrom, customUpdatedTo)) return false;
      return true;
    });
  }, [tables, query, author, dateCreated, dateUpdated, customCreatedFrom, customCreatedTo, customUpdatedFrom, customUpdatedTo]);

  const displayItems = useMemo(() => {
    if (sortMode === "popular") return [...filtered].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
    if (sortMode === "crowded") return [...filtered].sort((a, b) => (b.collaboratorCount ?? 0) - (a.collaboratorCount ?? 0));
    if (sortMode === "updated") return [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return filtered;
  }, [filtered, sortMode]);

  function handleRandom() {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    router.push(`/tables/${pick.id}`);
  }

  useEffect(() => { setPage(0); }, [query, author, dateCreated, dateUpdated, customCreatedFrom, customCreatedTo, customUpdatedFrom, customUpdatedTo, sortMode]);

  const totalPages = Math.max(1, Math.ceil(displayItems.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageItems = displayItems.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize);
  const firstItem = displayItems.length === 0 ? 0 : clampedPage * pageSize + 1;
  const lastItem = Math.min((clampedPage + 1) * pageSize, displayItems.length);

  const selectClass = "w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer";
  const dateInputClass = "flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-1 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 min-w-0";

  return (
    <div className="space-y-3 max-w-4xl">
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {actions && <div className="mr-2">{actions}</div>}
        {SORT_CHIPS.map((chip) => (
          <button
            key={chip.value}
            title={chip.title}
            onClick={() => setSortMode((prev) => prev === chip.value ? "default" : chip.value)}
            className={[
              "px-3 py-1.5 text-sm rounded-md border transition-colors font-medium",
              sortMode === chip.value
                ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            {chip.label}
          </button>
        ))}
        <button
          title="Go to a random table"
          onClick={handleRandom}
          disabled={filtered.length === 0}
          className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Random
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <circle cx="6.5" cy="6.5" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFiltersOpen(true)}
          placeholder="Search tables..."
          className="w-full pl-10 pr-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 focus:border-transparent"
        />
        {(query || hasActiveFilters) && (
          <button
            onClick={() => { setQuery(""); clearFilters(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Filters</span>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                  Clear all
                </button>
              )}
              <button onClick={() => setFiltersOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                Hide
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Author combobox */}
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Author</label>
              <div ref={authorRef} className="relative">
                <input
                  type="text"
                  value={authorQuery}
                  onChange={(e) => {
                    setAuthorQuery(e.target.value);
                    setAuthor("");
                    setAuthorOpen(true);
                  }}
                  onFocus={() => setAuthorOpen(true)}
                  placeholder="All authors"
                  className={[
                    "w-full text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400",
                    author
                      ? "border-zinc-400 dark:border-zinc-500 text-zinc-900 dark:text-zinc-100 font-medium pr-7"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 pr-2",
                  ].join(" ")}
                />
                {author && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); clearAuthor(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
                    aria-label="Clear author"
                  >
                    ✕
                  </button>
                )}
                {authorOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-20">
                    {!authorQuery && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); clearAuthor(); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        All authors
                      </button>
                    )}
                    {filteredAuthors.length === 0 ? (
                      <p className="px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-500">No matches</p>
                    ) : (
                      filteredAuthors.map((a) => (
                        <button
                          key={a}
                          onMouseDown={(e) => { e.preventDefault(); selectAuthor(a); }}
                          className={[
                            "w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800",
                            author === a
                              ? "font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800"
                              : "text-zinc-700 dark:text-zinc-300",
                          ].join(" ")}
                        >
                          {a}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Topic (placeholder) */}
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Topic</label>
              <select disabled className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed">
                <option>Coming soon</option>
              </select>
            </div>

            {/* Date Created */}
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Date Created</label>
              <select
                value={dateCreated}
                onChange={(e) => setDateCreated(e.target.value as DatePreset)}
                className={selectClass}
              >
                {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {dateCreated === "custom" && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <input
                    type="date"
                    value={customCreatedFrom}
                    onChange={(e) => setCustomCreatedFrom(e.target.value)}
                    className={dateInputClass}
                  />
                  <span className="text-xs text-zinc-400 shrink-0">–</span>
                  <input
                    type="date"
                    value={customCreatedTo}
                    onChange={(e) => setCustomCreatedTo(e.target.value)}
                    className={dateInputClass}
                  />
                </div>
              )}
            </div>

            {/* Date Updated */}
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Date Updated</label>
              <select
                value={dateUpdated}
                onChange={(e) => setDateUpdated(e.target.value as DatePreset)}
                className={selectClass}
              >
                {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {dateUpdated === "custom" && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <input
                    type="date"
                    value={customUpdatedFrom}
                    onChange={(e) => setCustomUpdatedFrom(e.target.value)}
                    className={dateInputClass}
                  />
                  <span className="text-xs text-zinc-400 shrink-0">–</span>
                  <input
                    type="date"
                    value={customUpdatedTo}
                    onChange={(e) => setCustomUpdatedTo(e.target.value)}
                    className={dateInputClass}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(query || hasActiveFilters) && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {displayItems.length} table{displayItems.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Table list */}
      <div className="grid gap-3">
        {displayItems.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">
            No tables match your search.
          </p>
        ) : (
          pageItems.map((table) => (
            <Link
              key={table.id}
              href={`/tables/${table.id}`}
              className="flex items-start justify-between p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white truncate">
                    {table.name}
                  </p>
                  {table.published === false && (
                    <Badge color="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">Draft</Badge>
                  )}
                  {(table.viewCount ?? 0) >= HOT_THRESHOLD && (
                    <Badge color="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400">Hot</Badge>
                  )}
                  {(table.collaboratorCount ?? 0) >= CROWDED_THRESHOLD && (
                    <Badge color="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">Crowded</Badge>
                  )}
                  {Date.now() - new Date(table.createdAt).getTime() < NEW_THRESHOLD_MS && (
                    <Badge color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">New</Badge>
                  )}
                  {table.notification === "new-collaborator" && (
                    <Badge color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">New collaborator(s)</Badge>
                  )}
                  {table.notification === "updated-recently" && (
                    <Badge color="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400">Updated recently</Badge>
                  )}
                </div>
                {table.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{table.description}</p>
                )}
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">by {table.author}</p>
              </div>

              {/* Right-side stats */}
              <div className="ml-6 shrink-0 flex flex-col items-end gap-1 pt-0.5 text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
                {table.rowCount != null && (
                  <span>{table.rowCount.toLocaleString()} rows</span>
                )}
                {table.collaboratorCount != null && (
                  <span>{table.collaboratorCount} collaborator{table.collaboratorCount !== 1 ? "s" : ""}</span>
                )}
                <span title={new Date(table.updatedAt).toLocaleString()}>
                  Updated {relativeTime(table.updatedAt)}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {displayItems.length > 0 && (
        <div className="flex items-center justify-between gap-4 text-sm pt-1">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <span className="text-xs">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-1 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-xs tabular-nums">
              {displayItems.length === 0 ? "0" : `${firstItem}–${lastItem} of ${displayItems.length.toLocaleString()}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PageNavButton onClick={() => setPage(0)} disabled={clampedPage === 0} title="First page">«</PageNavButton>
            <PageNavButton onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} title="Previous page">‹</PageNavButton>
            <span className="px-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {clampedPage + 1} / {totalPages}
            </span>
            <PageNavButton onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={clampedPage >= totalPages - 1} title="Next page">›</PageNavButton>
            <PageNavButton onClick={() => setPage(totalPages - 1)} disabled={clampedPage >= totalPages - 1} title="Last page">»</PageNavButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`shrink-0 px-1.5 py-0.5 text-xs font-medium rounded-full ${color}`}>
      {children}
    </span>
  );
}

function PageNavButton({
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
