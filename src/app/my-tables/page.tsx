import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/auth/profile";
import { prisma } from "@/lib/prisma";
import { computeNotifications } from "@/lib/notifications";
import AuthNav from "@/components/AuthNav";
import TableSearch from "@/components/TableSearch";
import NewTableButton from "@/components/NewTableButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Tables — tablebees",
};

export default async function MyTablesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const profile = await getProfileByUserId(session.user.id);

  let tables: {
    id: string;
    name: string;
    description: string | null;
    author: string;
    rowCount?: number;
    collaboratorCount?: number;
    viewCount?: number;
    createdAt: string;
    updatedAt: string;
    published: boolean;
    notification?: "new-collaborator" | "updated-recently" | null;
  }[] = [];

  if (profile) {
    const rows = await prisma.table.findMany({
      where: { ownerId: profile.id },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { data: true },
        },
      },
    });

    const tableIds = rows.map((r) => r.id);

    // Parallel: collaborator counts + non-owner versions for notifications
    const [editorRows, otherVersions] = tableIds.length > 0
      ? await Promise.all([
          prisma.tableVersion.findMany({
            where: { tableId: { in: tableIds } },
            select: { tableId: true, authorId: true },
            distinct: ["tableId", "authorId"],
          }),
          prisma.tableVersion.findMany({
            where: { tableId: { in: tableIds }, authorId: { not: profile.id } },
            select: { tableId: true, authorId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          }),
        ])
      : [[], []];

    const editorCountMap = editorRows.reduce((map, { tableId }) => {
      map.set(tableId, (map.get(tableId) ?? 0) + 1);
      return map;
    }, new Map<string, number>());

    const notificationMap = computeNotifications(
      rows.map((t) => ({ id: t.id, ownerLastViewedAt: t.ownerLastViewedAt })),
      otherVersions
    );

    tables = rows.map((t) => {
      const latestData = t.versions[0]?.data as { rows?: unknown[] } | null;
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        author: profile.displayName || "You",
        rowCount: latestData?.rows?.length,
        collaboratorCount: editorCountMap.get(t.id) ?? 0,
        viewCount: t.viewCount,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        published: t.published,
        notification: notificationMap.get(t.id) ?? null,
      };
    });
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">
          tablebees
        </Link>
        <AuthNav />
      </header>

      <section className="px-8 pt-16 pb-10 max-w-4xl">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
          My Tables
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-lg">
          Your published tables and drafts.
        </p>
      </section>

      <main className="px-8 pb-20">
        {tables.length === 0 ? (
          <div className="max-w-4xl">
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-4">
              You haven&apos;t created any tables yet.
            </p>
            <NewTableButton />
          </div>
        ) : (
          <TableSearch tables={tables} actions={<NewTableButton />} />
        )}
      </main>
    </div>
  );
}
