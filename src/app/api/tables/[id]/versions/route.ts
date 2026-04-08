import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const versions = await prisma.tableVersion.findMany({
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
          select: { id: true, displayName: true, userId: true },
        },
      },
    });

    return Response.json(versions);
  } catch {
    return Response.json([]);
  }
}
