import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ensureProfile } from "@/lib/auth/profile";

interface Params {
  params: Promise<{ id: string }>;
}

/** GET — list all bans for a table */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const bans = await prisma.tableBan.findMany({
    where: { tableId: id },
    include: { profile: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(bans);
}

/** POST — ban a user from a table (owner only) */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureProfile(session.user.id, session.user.name);
  const table = await prisma.table.findUnique({ where: { id }, select: { ownerId: true } });
  if (!table || table.ownerId !== profile.id) {
    return Response.json({ error: "Only the table owner can ban users." }, { status: 403 });
  }

  const { profileId } = (await req.json()) as { profileId: string };
  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }
  if (profileId === profile.id) {
    return Response.json({ error: "You cannot ban yourself." }, { status: 400 });
  }

  const ban = await prisma.tableBan.upsert({
    where: { tableId_profileId: { tableId: id, profileId } },
    update: {},
    create: { tableId: id, profileId, bannedBy: profile.id },
  });

  return Response.json(ban);
}

/** DELETE — unban a user from a table (owner only) */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureProfile(session.user.id, session.user.name);
  const table = await prisma.table.findUnique({ where: { id }, select: { ownerId: true } });
  if (!table || table.ownerId !== profile.id) {
    return Response.json({ error: "Only the table owner can unban users." }, { status: 403 });
  }

  const { profileId } = (await req.json()) as { profileId: string };
  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }

  await prisma.tableBan.deleteMany({
    where: { tableId: id, profileId },
  });

  return Response.json({ ok: true });
}
