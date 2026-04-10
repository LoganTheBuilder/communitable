import { getSession } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/auth/profile";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) return Response.json({ hasUnread: false });

    const profile = await getProfileByUserId(session.user.id);
    if (!profile) return Response.json({ hasUnread: false });

    const tables = await prisma.table.findMany({
      where: { ownerId: profile.id },
      select: { id: true, ownerLastViewedAt: true },
    });
    if (tables.length === 0) return Response.json({ hasUnread: false });

    const tableIds = tables.map((t) => t.id);
    const lastViewedMap = new Map(
      tables.map((t) => [t.id, t.ownerLastViewedAt ?? new Date(0)])
    );

    // Get all versions by non-owners for these tables
    const otherVersions = await prisma.tableVersion.findMany({
      where: {
        tableId: { in: tableIds },
        authorId: { not: profile.id },
      },
      select: { tableId: true, createdAt: true },
    });

    const hasUnread = otherVersions.some((v) => {
      const lastViewed = lastViewedMap.get(v.tableId)!;
      return v.createdAt > lastViewed;
    });

    return Response.json({ hasUnread });
  } catch {
    return Response.json({ hasUnread: false });
  }
}
