import Link from "next/link";
import { notFound } from "next/navigation";
import { getTableMeta } from "@/lib/sample-data";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import TableHistory from "@/components/history/TableHistory";
import type { VersionEntry } from "@/components/history/TableHistory";
import AuthNav from "@/components/AuthNav";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HistoryPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();

  // Resolve table name from sample data or database
  const sampleMeta = getTableMeta(id);
  let tableName: string | null = sampleMeta?.name ?? null;
  let isOwner = false;
  let activeBranch = "main";
  let bannedProfileIds: string[] = [];
  let ownerProfileId = "";

  if (!tableName) {
    try {
      const dbTable = await prisma.table.findUnique({
        where: { id },
        select: { name: true, activeBranch: true, ownerId: true, owner: { select: { userId: true } } },
      });
      tableName = dbTable?.name ?? null;
      activeBranch = dbTable?.activeBranch ?? "main";
      ownerProfileId = dbTable?.ownerId ?? "";
      isOwner = !!(session?.user && dbTable?.owner.userId === session.user.id);
    } catch {
      // DB unavailable
    }
  }

  if (!tableName) notFound();

  // Fetch bans if owner
  if (isOwner) {
    try {
      const bans = await prisma.tableBan.findMany({
        where: { tableId: id },
        select: { profileId: true },
      });
      bannedProfileIds = bans.map((b) => b.profileId);
    } catch {
      // ignore
    }
  }

  let versions: VersionEntry[] = [];
  try {
    const raw = await prisma.tableVersion.findMany({
      where: { tableId: id },
      orderBy: [{ branch: "asc" }, { version: "desc" }],
      select: {
        id: true,
        version: true,
        branch: true,
        status: true,
        schema: true,
        data: true,
        message: true,
        createdAt: true,
        author: {
          select: { id: true, displayName: true, userId: true },
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
    <div className="min-h-screen bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity"
        >
          tablebees
        </Link>
        <AuthNav />
      </header>

      <main className="px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500 mb-6">
          <Link href={`/tables/${id}`} className="hover:text-zinc-600 transition-colors">
            {tableName}
          </Link>
          <span>/</span>
          <span className="text-zinc-700">History</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-6">
          Version History
        </h1>

        <TableHistory
          versions={versions}
          tableName={tableName}
          tableId={id}
          isOwner={isOwner}
          activeBranch={activeBranch}
          bannedProfileIds={bannedProfileIds}
          ownerProfileId={ownerProfileId}
        />
      </main>
    </div>
  );
}
