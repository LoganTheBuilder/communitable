import Link from "next/link";
import { SAMPLE_TABLES } from "@/lib/sample-data";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import TableSearch from "@/components/TableSearch";
import AuthNav from "@/components/AuthNav";
import NewTableButton from "@/components/NewTableButton";
import type { DirectoryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Fetch user-created published tables from the database
  let dbTables: DirectoryEntry[] = [];
  try {
    const rows = await prisma.table.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { displayName: true, userId: true } },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { data: true },
        },
      },
    });

    const tableIds = rows.map((r) => r.id);
    const editorRows = tableIds.length > 0
      ? await prisma.tableVersion.findMany({
          where: { tableId: { in: tableIds } },
          select: { tableId: true, authorId: true },
          distinct: ["tableId", "authorId"],
        })
      : [];
    const ownerMap = new Map(rows.map((r) => [r.id, r.ownerId]));
    const editorCountMap = editorRows.reduce((map, { tableId, authorId }) => {
      if (authorId !== ownerMap.get(tableId)) {
        map.set(tableId, (map.get(tableId) ?? 0) + 1);
      }
      return map;
    }, new Map<string, number>());

    dbTables = rows.map((t) => {
      const latestData = t.versions[0]?.data as { rows?: unknown[] } | null;
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        author: t.owner.displayName || "Anonymous",
        rowCount: latestData?.rows?.length,
        collaboratorCount: editorCountMap.get(t.id) ?? 0,
        viewCount: t.viewCount,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });
  } catch {
    // DB unavailable — show sample tables only
  }

  // Merge sample + DB tables, sorted by most recently updated
  const sampleEntries: DirectoryEntry[] = SAMPLE_TABLES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    author: t.author,
    rowCount: t.rowCount,
    createdAt: t.updatedAt,
    updatedAt: t.updatedAt,
  }));

  const allTables = [...sampleEntries, ...dbTables].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const session = await getSession();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">tablebees</Link>
        <AuthNav />
      </header>

      {/* Hero — only shown to logged-out visitors */}
      {!session && (
        <section className="px-8 pt-16 pb-10 max-w-4xl">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
            The collaborative table database
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg">
            Browse, fork, and collaborate on structured data — no account required to explore.
          </p>
        </section>
      )}

      {/* Search + Table directory */}
      <main className={`px-8 pb-20 ${session ? "pt-8" : ""}`}>
        <TableSearch tables={allTables} actions={<NewTableButton />} />
      </main>
    </div>
  );
}
