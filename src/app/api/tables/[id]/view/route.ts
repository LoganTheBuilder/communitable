import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const session = await getSession();
    const table = await prisma.table.findUnique({
      where: { id },
      include: { owner: { select: { userId: true } } },
    });
    if (!table) return Response.json({ ok: true });

    const isOwner = session?.user?.id === table.owner.userId;
    await prisma.table.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
        ...(isOwner ? { ownerLastViewedAt: new Date() } : {}),
      },
    });
  } catch {
    // Table may not exist in DB (e.g. sample tables) — silently ignore
  }
  return Response.json({ ok: true });
}
