import Link from "next/link";
import { notFound } from "next/navigation";
import TableEditor from "@/components/editor/TableEditor";
import { getTableMeta } from "@/lib/sample-data";
import { readTable } from "@/lib/table-store";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TablePage({ params }: Props) {
  const { id } = await params;

  // Try sample data first, then check database for user-created tables
  const sampleMeta = getTableMeta(id);
  let tableMeta: {
    name: string;
    description: string | null;
    author: string;
    published: boolean;
    forkedFrom: { id: string; name: string; author: string } | null;
  } | null = null;

  if (sampleMeta) {
    tableMeta = {
      name: sampleMeta.name,
      description: sampleMeta.description,
      author: sampleMeta.author,
      published: true,
      forkedFrom: null,
    };
  } else {
    // Check database for user-created table
    try {
      const dbTable = await prisma.table.findUnique({
        where: { id },
        include: { owner: { select: { name: true, email: true } } },
      });
      if (dbTable) {
        // Fetch fork origin if this table was forked
        let forkOrigin: { id: string; name: string; author: string } | null = null;
        if (dbTable.forkedFromId) {
          const source = await prisma.table.findUnique({
            where: { id: dbTable.forkedFromId },
            include: { owner: { select: { name: true, email: true } } },
          }).catch(() => null);
          if (source) {
            forkOrigin = {
              id: source.id,
              name: source.name,
              author: source.owner.name || source.owner.email.split("@")[0],
            };
          }
        }

        tableMeta = {
          name: dbTable.name,
          description: dbTable.description,
          author: dbTable.owner.name || dbTable.owner.email.split("@")[0],
          published: dbTable.published,
          forkedFrom: forkOrigin,
        };
      }
    } catch (err) {
      console.error("[table page] DB query failed:", err);
    }
  }

  if (!tableMeta) notFound();

  const stored = await readTable(id);

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <Link href="/" className="text-lg font-semibold tracking-tight hover:opacity-70 transition-opacity">
          AllYourBase
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/auth/signin" className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
            Log In
          </Link>
          <Link href="/auth/signup" className="px-4 py-1.5 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-700 transition-colors">
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="px-8 py-8">
        {/* Table metadata */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{tableMeta.name}</h1>
            {!tableMeta.published && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                Draft
              </span>
            )}
          </div>
          {tableMeta.description && (
            <p className="mt-1 text-zinc-500">{tableMeta.description}</p>
          )}
          {tableMeta.forkedFrom && (
            <p className="mt-1.5 text-xs text-zinc-400">
              Forked from{" "}
              <Link
                href={`/tables/${tableMeta.forkedFrom.id}`}
                className="text-zinc-600 hover:text-zinc-900 underline underline-offset-2 transition-colors"
              >
                {tableMeta.forkedFrom.name}
              </Link>
              {" "}by <span className="text-zinc-600">{tableMeta.forkedFrom.author}</span>
            </p>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
            <span>by <span className="text-zinc-600">{tableMeta.author}</span></span>
            <Link
              href={`/tables/${id}/history`}
              className="text-zinc-500 hover:text-zinc-800 transition-colors underline underline-offset-2"
            >
              History
            </Link>
            {tableMeta.published && (
              <Link
                href={`/tables/${id}/fork`}
                className="text-zinc-500 hover:text-zinc-800 transition-colors underline underline-offset-2"
              >
                Fork
              </Link>
            )}
          </div>
        </div>

        {/* Editor (handles view / edit / preview modes) */}
        <TableEditor
          tableId={id}
          initialColumns={stored.columns}
          initialRows={stored.rows}
          initialDefaultSort={stored.defaultSort}
          publishMode={!tableMeta.published}
          initialName={tableMeta.name}
          initialDescription={tableMeta.description}
        />
      </main>
    </div>
  );
}
