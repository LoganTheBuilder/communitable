import Link from "next/link";
import { SAMPLE_TABLES } from "@/lib/sample-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface DirectoryEntry {
  id: string;
  name: string;
  description: string | null;
  author: string;
  rowCount?: number;
  updatedAt: Date;
}

export default async function Home() {
  // Fetch user-created published tables from the database
  let dbTables: DirectoryEntry[] = [];
  try {
    const rows = await prisma.table.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { data: true },
        },
      },
    });
    dbTables = rows.map((t) => {
      const latestData = t.versions[0]?.data as { rows?: unknown[] } | null;
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        author: t.owner.name || t.owner.email.split("@")[0],
        rowCount: latestData?.rows?.length,
        updatedAt: t.updatedAt,
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
    updatedAt: new Date(t.updatedAt),
  }));

  const allTables = [...sampleEntries, ...dbTables].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <span className="text-lg font-semibold tracking-tight">AllYourBase</span>
        <nav className="flex items-center gap-3">
          <Link
            href="/auth/signin"
            className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-1.5 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-700 transition-colors"
          >
            Sign Up
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-8 pt-16 pb-10 max-w-4xl">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 mb-3">
          The open table directory
        </h1>
        <p className="text-zinc-500 text-lg">
          Browse, fork, and collaborate on structured data — no account required to explore.
        </p>
        <Link
          href="/tables/new"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-700 transition-colors font-medium"
        >
          + New Table
        </Link>
      </section>

      {/* Table directory */}
      <main className="px-8 pb-20">
        <div className="grid gap-3 max-w-4xl">
          {allTables.map((table) => (
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
          ))}
        </div>
      </main>
    </div>
  );
}
