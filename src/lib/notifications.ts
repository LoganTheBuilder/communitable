import { prisma } from "@/lib/prisma";

interface TableWithLastViewed {
  id: string;
  ownerLastViewedAt: Date | null;
}

interface VersionRecord {
  tableId: string;
  authorId: string;
  createdAt: Date;
}

export type TableNotification = "new-collaborator" | "updated-recently" | null;

/**
 * Compute whether any of the given tables have unseen activity from non-owners.
 */
export function hasUnseenActivity(
  tables: TableWithLastViewed[],
  otherVersions: { tableId: string; createdAt: Date }[]
): boolean {
  const lastViewedMap = new Map(
    tables.map((t) => [t.id, t.ownerLastViewedAt ?? new Date(0)])
  );
  return otherVersions.some((v) => {
    const lastViewed = lastViewedMap.get(v.tableId)!;
    return v.createdAt > lastViewed;
  });
}

/**
 * For each table, compute the notification type based on non-owner versions.
 * Pre-groups versions by tableId for O(n+m) instead of O(n*m).
 */
export function computeNotifications(
  tables: TableWithLastViewed[],
  otherVersions: VersionRecord[]
): Map<string, TableNotification> {
  // Pre-group versions by tableId
  const versionsByTable = new Map<string, VersionRecord[]>();
  for (const v of otherVersions) {
    let arr = versionsByTable.get(v.tableId);
    if (!arr) {
      arr = [];
      versionsByTable.set(v.tableId, arr);
    }
    arr.push(v);
  }

  const result = new Map<string, TableNotification>();
  for (const table of tables) {
    const lastViewed = table.ownerLastViewedAt ?? new Date(0);
    const versions = versionsByTable.get(table.id) ?? [];
    if (versions.length === 0) {
      result.set(table.id, null);
      continue;
    }

    const authorsBefore = new Set<string>();
    const authorsAfter = new Set<string>();
    for (const v of versions) {
      if (v.createdAt <= lastViewed) {
        authorsBefore.add(v.authorId);
      } else {
        authorsAfter.add(v.authorId);
      }
    }

    const newCollaborators = [...authorsAfter].filter((a) => !authorsBefore.has(a));
    if (newCollaborators.length > 0) {
      result.set(table.id, "new-collaborator");
      continue;
    }

    const hasRecentUpdate = versions.some((v) => v.createdAt > lastViewed);
    if (hasRecentUpdate) {
      result.set(table.id, "updated-recently");
      continue;
    }

    result.set(table.id, null);
  }

  return result;
}

/**
 * Optimized check: does the owner have any unseen activity?
 * Pushes the date filter into the DB query and uses findFirst for early exit.
 */
export async function checkUnreadForOwner(profileId: string): Promise<boolean> {
  const tables = await prisma.table.findMany({
    where: { ownerId: profileId },
    select: { id: true, ownerLastViewedAt: true },
  });
  if (tables.length === 0) return false;

  // Check each table individually with a DB-level date filter
  for (const table of tables) {
    const cutoff = table.ownerLastViewedAt ?? new Date(0);
    const unseen = await prisma.tableVersion.findFirst({
      where: {
        tableId: table.id,
        authorId: { not: profileId },
        createdAt: { gt: cutoff },
      },
      select: { id: true },
    });
    if (unseen) return true;
  }
  return false;
}
