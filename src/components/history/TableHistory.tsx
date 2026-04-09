"use client";

import { useState } from "react";
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
  schema: { columns: ColumnDef[]; defaultSort?: DefaultSort | null };
  data: { rows: Row[] } | null;
  message: string | null;
  createdAt: string;
  author: VersionAuthor;
}

interface Props {
  versions: VersionEntry[];
  tableName: string;
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

export default function TableHistory({ versions, tableName }: Props) {
  const [selected, setSelected] = useState<[string | null, string | null]>([null, null]);

  function toggleSelect(id: string) {
    setSelected(([a, b]) => {
      if (a === id) return [b, null];
      if (b === id) return [a, null];
      if (!a) return [id, null];
      if (!b) return [a, id];
      return [a, id];
    });
  }

  const leftVersion = versions.find((v) => v.id === selected[0]) ?? null;
  const rightVersion = versions.find((v) => v.id === selected[1]) ?? null;

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
            {versions.length} version{versions.length !== 1 ? "s" : ""}
          </h2>
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

        {versions.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">No versions saved yet.</p>
        ) : (
          <div className="space-y-1">
            {versions.map((v) => {
              const isSelected = selected[0] === v.id || selected[1] === v.id;
              const selIndex = selected[0] === v.id ? 0 : selected[1] === v.id ? 1 : -1;
              return (
                <button
                  key={v.id}
                  onClick={() => toggleSelect(v.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    isSelected
                      ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800 ring-1 ring-zinc-900 dark:ring-zinc-100"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs flex items-center justify-center font-medium">
                            {selIndex === 0 ? "A" : "B"}
                          </span>
                        )}
                        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          v{v.version}
                        </span>
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
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showDiff && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Comparing v{older.version} → v{newer.version}
          </h2>
          <DiffView
            left={{ schema: older.schema, data: older.data }}
            right={{ schema: newer.schema, data: newer.data }}
            leftLabel={`v${older.version}${older.message ? ` — ${older.message}` : ""}`}
            rightLabel={`v${newer.version}${newer.message ? ` — ${newer.message}` : ""}`}
          />
        </div>
      )}
    </div>
  );
}
