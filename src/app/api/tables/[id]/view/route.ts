import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.table.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Table may not exist in DB (e.g. sample tables) — silently ignore
  }
  return Response.json({ ok: true });
}
