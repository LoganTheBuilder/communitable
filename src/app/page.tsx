import Link from "next/link";
import { SAMPLE_TABLES } from "@/lib/sample-data";
import { prisma } from "@/lib/prisma";
import TableSearch from "@/components/TableSearch";

export const dynamic = "force-dynamic";

interface DirectoryEntry {
  id: string;
  name: string;
  description: string | null;
  author: string;
  rowCount?: number;
  createdAt: string;
  updatedAt: string;
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

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <span className="text-lg font-semibold tracking-tight">Communitables</span>
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
          The collaborative table database
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

      {/* Search + Table directory */}
      <main className="px-8 pb-20">
        <TableSearch tables={allTables} />
      </main>
    </div>
  );
}
