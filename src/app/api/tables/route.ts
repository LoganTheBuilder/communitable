import { NextRequest } from "next/server";
import { writeTable } from "@/lib/table-store";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ensureProfile } from "@/lib/auth/profile";
import type { ColumnDef, Row } from "@/lib/types";

interface CreateTableBody {
  name: string;
  description?: string;
  rows: number;
  columns: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateTableBody;

  if (!body.name?.trim()) {
    return Response.json({ error: "Table name is required" }, { status: 400 });
  }

  try {
    // Check for duplicate table name
    const existing = await prisma.table.findFirst({
      where: { name: body.name.trim() },
      select: { id: true },
    });
    if (existing) {
      return Response.json(
        { error: "A table with that name already exists. Please choose a different name." },
        { status: 409 }
      );
    }

    const numCols = Math.max(1, Math.min(body.columns ?? 3, 26));
    const numRows = Math.max(0, Math.min(body.rows ?? 5, 1000));

    // Generate column definitions (A, B, C, ...)
    const columns: ColumnDef[] = Array.from({ length: numCols }, (_, i) => ({
      key: `col_${i}`,
      label: String.fromCharCode(65 + i), // A, B, C, ...
      type: "string" as const,
    }));

    // Generate empty rows
    const rows: Row[] = Array.from({ length: numRows }, () => {
      const row: Row = {};
      for (const col of columns) {
        row[col.key] = null;
      }
      return row;
    });

    // Get authenticated user or fall back to system user
    let profileId: string;
    const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);

    if (session?.user) {
      const profile = await ensureProfile(session.user.id, session.user.name);
      profileId = profile.id;
    } else {
      // Fallback: create/get a system profile for anonymous table creation
      const SYSTEM_USER_ID = "system";
      const profile = await ensureProfile(SYSTEM_USER_ID, "System");
      profileId = profile.id;
    }

    // Create the table record
    const table = await prisma.table.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        published: false,
        ownerId: profileId,
      },
    });

    // Write initial data to file store
    await writeTable(table.id, { columns, rows, defaultSort: null });

    // Create initial version
    await prisma.tableVersion.create({
      data: {
        tableId: table.id,
        version: 1,
        schema: JSON.parse(JSON.stringify({ columns, defaultSort: null })),
        data: JSON.parse(JSON.stringify({ rows })),
        message: "Initial draft",
        authorId: profileId,
      },
    });

    return Response.json({ id: table.id });
  } catch (err) {
    console.error("[POST /api/tables]", err);
    return Response.json({ error: "Failed to create table" }, { status: 500 });
  }
}
