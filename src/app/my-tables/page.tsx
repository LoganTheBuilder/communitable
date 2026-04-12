import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/auth/profile";
import { prisma } from "@/lib/prisma";
import { computeNotifications } from "@/lib/notifications";
import AuthNav from "@/components/AuthNav";
import MyTablesTabs from "./MyTablesTabs";
import type { DirectoryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Tables — tablebees",
};

export default async function MyTablesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const profile = await getProfileByUserId(session.user.id);

  let ownedTables: DirectoryEntry[] = [];
  let collaboratedTables: DirectoryEntry[] = [];

  if (profile) {
    // --- Owned tables ---
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

    // Parallel: collaborator counts, non-owner versions for notifications, and collaborated table IDs
    const [editorRows, otherVersions, collabVersions] = await Promise.all([
      tableIds.length > 0
        ? prisma.tableVersion.findMany({
            where: { tableId: { in: tableIds } },
            select: { tableId: true, authorId: true },
            distinct: ["tableId", "authorId"],
          })
        : Promise.resolve([]),
      tableIds.length > 0
        ? prisma.tableVersion.findMany({
            where: { tableId: { in: tableIds }, authorId: { not: profile.id } },
            select: { tableId: true, authorId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
      prisma.tableVersion.findMany({
        where: { authorId: profile.id },
        select: { tableId: true },
        distinct: ["tableId"],
      }),
    ]);

    const editorCountMap = editorRows.reduce((map, { tableId, authorId }) => {
      if (authorId !== profile.id) {
        map.set(tableId, (map.get(tableId) ?? 0) + 1);
      }
      return map;
    }, new Map<string, number>());

    const notificationMap = computeNotifications(
      rows.map((t) => ({ id: t.id, ownerLastViewedAt: t.ownerLastViewedAt })),
      otherVersions
    );

    ownedTables = rows.map((t) => {
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
    const collabTableIds = collabVersions
      .map((v) => v.tableId)
      .filter((id) => !tableIds.includes(id));

    if (collabTableIds.length > 0) {
      const collabRows = await prisma.table.findMany({
        where: { id: { in: collabTableIds } },
        orderBy: { updatedAt: "desc" },
        include: {
          owner: { select: { displayName: true } },
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { data: true },
          },
        },
      });

      collaboratedTables = collabRows.map((t) => {
        const latestData = t.versions[0]?.data as { rows?: unknown[] } | null;
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          author: t.owner.displayName || "Unknown",
          rowCount: latestData?.rows?.length,
          viewCount: t.viewCount,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        };
      });
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">
          tablebees
        </Link>
        <AuthNav />
      </header>

      <MyTablesTabs ownedTables={ownedTables} collaboratedTables={collaboratedTables} />
    </div>
  );
}
