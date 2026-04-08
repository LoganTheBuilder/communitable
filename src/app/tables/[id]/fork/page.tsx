import Link from "next/link";
import { notFound } from "next/navigation";
import { getTableMeta } from "@/lib/sample-data";
import { readTable } from "@/lib/table-store";
import { prisma } from "@/lib/prisma";
import ForkForm from "./ForkForm";
import AuthNav from "@/components/AuthNav";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ForkPage({ params }: Props) {
  const { id } = await params;

  // Resolve source table info
  const sampleMeta = getTableMeta(id);
  let sourceName: string | null = null;
  let sourceAuthor: string | null = null;
  let sourceDescription: string | null = null;

  if (sampleMeta) {
    sourceName = sampleMeta.name;
    sourceAuthor = sampleMeta.author;
    sourceDescription = sampleMeta.description;
  } else {
    try {
      const dbTable = await prisma.table.findUnique({
        where: { id },
        include: { owner: { select: { displayName: true } } },
      });
      if (dbTable) {
        sourceName = dbTable.name;
        sourceAuthor = dbTable.owner.displayName || "Anonymous";
        sourceDescription = dbTable.description;
      }
    } catch {
      // DB unavailable
    }
  }

  if (!sourceName) notFound();

  const stored = await readTable(id);

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight hover:opacity-70 transition-opacity"
        >
          AllYourBase
        </Link>
        <AuthNav />
      </header>

      <main className="px-8 py-12 max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-1">
          Fork Table
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Create your own copy of this table to edit independently.
        </p>

        {/* Source info */}
        <div className="mb-6 px-4 py-3 rounded-lg border border-zinc-200 bg-zinc-50">
          <p className="text-sm font-medium text-zinc-900">{sourceName}</p>
          {sourceDescription && (
            <p className="text-xs text-zinc-500 mt-0.5">{sourceDescription}</p>
          )}
          <p className="text-xs text-zinc-400 mt-1">
            by <span className="text-zinc-600">{sourceAuthor}</span>
            {" · "}
            {stored.rows.length.toLocaleString()} rows, {stored.columns.length} columns
          </p>
        </div>

        <ForkForm
          sourceId={id}
          defaultName={sourceName}
          defaultDescription={sourceDescription}
        />
      </main>
    </div>
  );
}
