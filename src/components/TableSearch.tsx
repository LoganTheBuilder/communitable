"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface DirectoryEntry {
  id: string;
  name: string;
  description: string | null;
  author: string;
  rowCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  tables: DirectoryEntry[];
}

type DatePreset = "any" | "today" | "week" | "month" | "year";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
];

function dateMatchesPreset(dateStr: string, preset: DatePreset): boolean {
  if (preset === "any") return true;
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const day = 86_400_000;
  switch (preset) {
    case "today":
      return diff < day;
    case "week":
      return diff < 7 * day;
    case "month":
      return diff < 30 * day;
    case "year":
      return diff < 365 * day;
  }
}

export default function TableSearch({ tables }: Props) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [author, setAuthor] = useState("");
  const [dateCreated, setDateCreated] = useState<DatePreset>("any");
  const [dateUpdated, setDateUpdated] = useState<DatePreset>("any");

  const authors = useMemo(() => {
    const set = new Set(tables.map((t) => t.author));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tables]);

  const hasActiveFilters = author !== "" || dateCreated !== "any" || dateUpdated !== "any";

  const filtered = useMemo(() => {
    return tables.filter((t) => {
      // Text search
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const match =
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false) ||
          t.author.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Author filter
      if (author && t.author !== author) return false;

      // Date filters
      if (!dateMatchesPreset(t.createdAt, dateCreated)) return false;
      if (!dateMatchesPreset(t.updatedAt, dateUpdated)) return false;

      return true;
    });
  }, [tables, query, author, dateCreated, dateUpdated]);

  function clearFilters() {
    setAuthor("");
    setDateCreated("any");
    setDateUpdated("any");
  }

  return (
    <div className="space-y-3 max-w-4xl">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
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
          className="w-full pl-10 pr-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
        />
        {(query || hasActiveFilters) && (
          <button
            onClick={() => {
              setQuery("");
              clearFilters();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-sm"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="border border-zinc-200 rounded-lg bg-zinc-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Filters</span>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setFiltersOpen(false)}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                Hide
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Author */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Author</label>
              <select
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
              >
                <option value="">All authors</option>
                {authors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic (placeholder) */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Topic</label>
              <select
                disabled
                className="w-full text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-zinc-100 text-zinc-400 cursor-not-allowed"
              >
                <option>Coming soon</option>
              </select>
            </div>

            {/* Date Created */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Date Created</label>
              <select
                value={dateCreated}
                onChange={(e) => setDateCreated(e.target.value as DatePreset)}
                className="w-full text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Updated */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Date Updated</label>
              <select
                value={dateUpdated}
                onChange={(e) => setDateUpdated(e.target.value as DatePreset)}
                className="w-full text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results count when filtering */}
      {(query || hasActiveFilters) && (
        <p className="text-xs text-zinc-400">
          {filtered.length} table{filtered.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Table list */}
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-400 py-8 text-center">
            No tables match your search.
          </p>
        ) : (
          filtered.map((table) => (
            <Link
              key={table.id}
              href={`/tables/${table.id}`}
              className="flex items-start justify-between p-4 border border-zinc-200 rounded-lg hover:border-zinc-400 hover:bg-zinc-50 transition-all group"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 group-hover:text-black truncate">
                  {table.name}
                </p>
                {table.description && (
                  <p className="text-sm text-zinc-500 mt-0.5">{table.description}</p>
                )}
                <p className="text-xs text-zinc-400 mt-1">by {table.author}</p>
              </div>
              {table.rowCount != null && (
                <span className="ml-6 shrink-0 text-xs text-zinc-400 tabular-nums pt-0.5">
                  {table.rowCount.toLocaleString()} rows
                </span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
