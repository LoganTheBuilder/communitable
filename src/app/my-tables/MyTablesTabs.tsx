"use client";

import { useState } from "react";
import TableSearch from "@/components/TableSearch";
import NewTableButton from "@/components/NewTableButton";
import type { DirectoryEntry } from "@/lib/types";

interface Props {
  ownedTables: DirectoryEntry[];
  collaboratedTables: DirectoryEntry[];
}

export default function MyTablesTabs({ ownedTables, collaboratedTables }: Props) {
  const [tab, setTab] = useState<"owned" | "collaborated">("owned");

  const tabs = [
    { key: "owned" as const, label: "My Tables", count: ownedTables.length },
    { key: "collaborated" as const, label: "Collaborated", count: collaboratedTables.length },
  ];

  const tables = tab === "owned" ? ownedTables : collaboratedTables;

  return (
    <>
      <section className="px-8 pt-10 pb-6 max-w-4xl">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                tab === t.key
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {t.label}
              <span
                className={`inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium rounded-full min-w-[1.25rem] ${
                  tab === t.key
                    ? "bg-zinc-700 text-zinc-200 dark:bg-zinc-300 dark:text-zinc-800"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <p className="text-zinc-500 dark:text-zinc-400 text-lg">
          {tab === "owned"
            ? "Your published tables and drafts."
            : "Tables you\u2019ve contributed to."}
        </p>
      </section>

      <main className="px-8 pb-20">
        {tables.length === 0 ? (
          <div className="max-w-4xl">
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-4">
              {tab === "owned"
                ? "You haven\u2019t created any tables yet."
                : "You haven\u2019t collaborated on any tables yet."}
            </p>
            {tab === "owned" && <NewTableButton />}
          </div>
        ) : (
          <TableSearch
            tables={tables}
            actions={tab === "owned" ? <NewTableButton /> : undefined}
            hideRandom
          />
        )}
      </main>
    </>
  );
}
