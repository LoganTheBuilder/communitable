import type { Metadata } from "next";
import Link from "next/link";
import TableEditor from "@/components/editor/TableEditor";
import { getTableMeta } from "@/lib/sample-data";
import { readTable } from "@/lib/table-store";
import type { ColumnDef, Row } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/auth/profile";
import AuthNav from "@/components/AuthNav";
import ForkButton from "@/components/ForkButton";
import BackButton from "@/components/BackButton";
import ViewTracker from "@/components/ViewTracker";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sampleMeta = getTableMeta(id);
  if (sampleMeta) {
    return { title: `${sampleMeta.name} — tablebees` };
  }
  try {
    const dbTable = await prisma.table.findUnique({ where: { id }, select: { name: true } });
    if (dbTable) return { title: `${dbTable.name} — tablebees` };
  } catch {
    // ignore
  }
  return { title: "tablebees" };
}

export default async function TablePage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();

  // Try sample data first, then check database for user-created tables
  const sampleMeta = getTableMeta(id);
  let tableMeta: {
    name: string;
    description: string | null;
    author: string;
    published: boolean;
    forkedFrom: { id: string; name: string; author: string } | null;
    ownerUserId?: string;
    lastUpdatedBy?: string;
    collaborators?: string[];
    editability?: "LOCKED" | "APPROVALS" | "OPEN";
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
    try {
      const dbTable = await prisma.table.findUnique({
        where: { id },
        include: { owner: { select: { displayName: true, userId: true } } },
      });
      if (dbTable) {
        let forkOrigin: { id: string; name: string; author: string } | null = null;
        if (dbTable.forkedFromId) {
          const source = await prisma.table.findUnique({
            where: { id: dbTable.forkedFromId },
            include: { owner: { select: { displayName: true } } },
          }).catch(() => null);
          if (source) {
            forkOrigin = {
              id: source.id,
              name: source.name,
              author: source.owner.displayName || "Anonymous",
            };
          }
        }

        const [latestVersion, versionAuthors] = await Promise.all([
          prisma.tableVersion.findFirst({
            where: { tableId: id },
            orderBy: { version: "desc" },
            include: { author: { select: { displayName: true } } },
          }).catch(() => null),
          prisma.tableVersion.findMany({
            where: { tableId: id, authorId: { not: dbTable.ownerId }, status: "PUBLISHED" },
            select: { author: { select: { displayName: true } }, authorId: true },
            distinct: ["authorId"],
          }).catch(() => []),
        ]);

        tableMeta = {
          name: dbTable.name,
          description: dbTable.description,
          author: dbTable.owner.displayName || "Anonymous",
          published: dbTable.published,
          forkedFrom: forkOrigin,
          ownerUserId: dbTable.owner.userId,
          lastUpdatedBy: latestVersion?.author.displayName || undefined,
          collaborators: versionAuthors.map((v) => v.author.displayName || "Anonymous"),
          editability: dbTable.editability,
        };
      }
    } catch (err) {
      console.error("[table page] DB query failed:", err);
    }
  }

  // Table not found at all
  if (!tableMeta) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
        <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">tablebees</Link>
          <AuthNav />
        </header>
        <main className="px-8 py-20 max-w-2xl">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Table not found</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            That table doesn&apos;t exist, or the author has put it into Draft mode.
          </p>
          <BackButton />
        </main>
      </div>
    );
  }

  const isOwner = !!(session?.user && tableMeta.ownerUserId && session.user.id === tableMeta.ownerUserId);

  // Draft tables are only accessible to the owner
  if (!tableMeta.published && !isOwner) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
        <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">tablebees</Link>
          <AuthNav />
        </header>
        <main className="px-8 py-20 max-w-2xl">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Table not found</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            That table doesn&apos;t exist, or the author has put it into Draft mode.
          </p>
          <BackButton />
        </main>
      </div>
    );
  }

  const stored = await readTable(id);

  let pendingVersions: { rows: Row[]; columns: ColumnDef[] | null }[] = [];
  let isBanned = false;
  if (session?.user && !isOwner) {
    try {
      const profile = await getProfileByUserId(session.user.id);
      if (profile) {
        const [ban, pendingVersionsList] = await Promise.all([
          prisma.tableBan.findUnique({
            where: { tableId_profileId: { tableId: id, profileId: profile.id } },
          }).catch(() => null),
          tableMeta.editability === "APPROVALS"
            ? prisma.tableVersion.findMany({
                where: { tableId: id, status: "PENDING_APPROVAL", authorId: profile.id },
                orderBy: { createdAt: "desc" },
                select: { schema: true, data: true },
              })
            : [],
        ]);
        isBanned = !!ban;
        pendingVersions = pendingVersionsList
          .filter((v) => v.data)
          .map((v) => ({
            rows: (v.data as { rows: Row[] }).rows,
            columns: v.schema ? (v.schema as unknown as { columns: ColumnDef[] }).columns : null,
          }));
      }
    } catch {
      // ignore
    }
  }
  // Owner sees any pending version
  if (isOwner && tableMeta.editability === "APPROVALS" && pendingVersions.length === 0) {
    try {
      const pendingVersionsList = await prisma.tableVersion.findMany({
        where: { tableId: id, status: "PENDING_APPROVAL" },
        orderBy: { createdAt: "desc" },
        select: { schema: true, data: true },
      });
      pendingVersions = pendingVersionsList
        .filter((v) => v.data)
        .map((v) => ({
          rows: (v.data as { rows: Row[] }).rows,
          columns: v.schema ? (v.schema as unknown as { columns: ColumnDef[] }).columns : null,
        }));
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
      <ViewTracker tableId={id} />
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">
          tablebees
        </Link>
        <AuthNav />
      </header>

      <main className="px-8 py-8">
        {/* Table metadata */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{tableMeta.name}</h1>
            {!tableMeta.published && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                Draft
              </span>
            )}
          </div>
          {tableMeta.description && (
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">{tableMeta.description}</p>
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
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
            <span>Created by <span className="text-zinc-600 dark:text-zinc-300">{tableMeta.author}</span></span>
            {tableMeta.lastUpdatedBy && (
              <span>Last updated by <span className="text-zinc-600 dark:text-zinc-300">{tableMeta.lastUpdatedBy}</span></span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
            <Link
              href={`/tables/${id}/history`}
              className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors underline underline-offset-2"
            >
              History
            </Link>
            {tableMeta.published && <ForkButton tableId={id} />}
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
          isOwner={isOwner}
          collaborators={tableMeta.collaborators ?? []}
          initialEditability={tableMeta.editability}
          pendingVersions={pendingVersions.length > 0 ? pendingVersions : undefined}
          isBanned={isBanned}
        />
      </main>
    </div>
  );
}
