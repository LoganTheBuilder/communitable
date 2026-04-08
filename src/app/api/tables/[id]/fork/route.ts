import { NextRequest } from "next/server";
import { readTable, writeTable } from "@/lib/table-store";
import { prisma } from "@/lib/prisma";
import { getTableMeta } from "@/lib/sample-data";
import { auth } from "@/lib/auth";
import { ensureProfile } from "@/lib/auth/profile";

interface Params {
  params: Promise<{ id: string }>;
}

interface ForkBody {
  name: string;
  description?: string;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: sourceId } = await params;
  const body = (await req.json()) as ForkBody;

  if (!body.name?.trim()) {
    return Response.json({ error: "Table name is required" }, { status: 400 });
  }

  try {
    // Read source table data
    const sourceData = await readTable(sourceId);

    // Get authenticated user or fall back to system profile
    let profileId: string;
    const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);

    if (session?.user) {
      const profile = await ensureProfile(session.user.id, session.user.name);
      profileId = profile.id;
    } else {
      const profile = await ensureProfile("system", "System");
      profileId = profile.id;
    }

    // Ensure the source table has a DB record (sample tables may not yet)
    const sourceMeta = getTableMeta(sourceId);
    await prisma.table.upsert({
      where: { id: sourceId },
      update: {},
      create: {
        id: sourceId,
        name: sourceMeta?.name ?? `Table ${sourceId}`,
        description: sourceMeta?.description ?? null,
        published: true,
        ownerId: profileId,
      },
    });

    // Create the forked table record
    const forkedTable = await prisma.table.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        published: false,
        ownerId: profileId,
        forkedFromId: sourceId,
      },
    });

    // Copy data to file store
    await writeTable(forkedTable.id, sourceData);

    // Create initial version
    await prisma.tableVersion.create({
      data: {
        tableId: forkedTable.id,
        version: 1,
        schema: JSON.parse(JSON.stringify({ columns: sourceData.columns, defaultSort: sourceData.defaultSort ?? null })),
        data: JSON.parse(JSON.stringify({ rows: sourceData.rows })),
        message: "Forked from original",
        authorId: profileId,
      },
    });

    return Response.json({ id: forkedTable.id });
  } catch (err) {
    console.error("[POST /api/tables/fork]", err);
    return Response.json({ error: "Failed to fork table" }, { status: 500 });
  }
}
