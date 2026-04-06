import Link from "next/link";
import { notFound } from "next/navigation";
import { getTableMeta } from "@/lib/sample-data";
import { prisma } from "@/lib/prisma";
import TableHistory from "@/components/history/TableHistory";
import type { VersionEntry } from "@/components/history/TableHistory";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HistoryPage({ params }: Props) {
  const { id } = await params;

  // Resolve table name from sample data or database
  const sampleMeta = getTableMeta(id);
  let tableName: string | null = sampleMeta?.name ?? null;

  if (!tableName) {
    try {
      const dbTable = await prisma.table.findUnique({
        where: { id },
        select: { name: true },
      });
      tableName = dbTable?.name ?? null;
    } catch {
      // DB unavailable
    }
  }

  if (!tableName) notFound();

  let versions: VersionEntry[] = [];
  try {
    const raw = await prisma.tableVersion.findMany({
      where: { tableId: id },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        schema: true,
        data: true,
        message: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    versions = raw.map((v) => ({
      ...v,
      schema: v.schema as unknown as VersionEntry["schema"],
      data: v.data as unknown as VersionEntry["data"],
      createdAt: v.createdAt.toISOString(),
    }));
  } catch {
    // Database unavailable — show empty history
  }

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

      <main className="px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <Link href={`/tables/${id}`} className="hover:text-zinc-600 transition-colors">
            {tableName}
          </Link>
          <span>/</span>
          <span className="text-zinc-700">History</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-6">
          Version History
        </h1>

        <TableHistory versions={versions} tableName={tableName} />
      </main>
    </div>
  );
}
