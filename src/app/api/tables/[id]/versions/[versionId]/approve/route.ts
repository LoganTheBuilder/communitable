import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeTable } from "@/lib/table-store";
import { auth } from "@/lib/auth";
import { ensureProfile } from "@/lib/auth/profile";

interface Params {
  params: Promise<{ id: string; versionId: string }>;
}

/** POST — approve or reject a pending version (owner only) */
export async function POST(req: NextRequest, { params }: Params) {
  const { id, versionId } = await params;
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureProfile(session.user.id, session.user.name);
  const table = await prisma.table.findUnique({ where: { id }, select: { ownerId: true } });
  if (!table || table.ownerId !== profile.id) {
    return Response.json({ error: "Only the table owner can approve or reject versions." }, { status: 403 });
  }

  const { action } = (await req.json()) as { action: "approve" | "reject" };
  if (action !== "approve" && action !== "reject") {
    return Response.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const version = await prisma.tableVersion.findUnique({
    where: { id: versionId },
    select: { id: true, status: true, schema: true, data: true, tableId: true },
  });
  if (!version || version.tableId !== id) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }
  if (version.status !== "PENDING_APPROVAL") {
    return Response.json({ error: "Version is not pending approval" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "PUBLISHED" : "REJECTED";
  await prisma.tableVersion.update({
    where: { id: versionId },
    data: { status: newStatus },
  });

  // If approved, write the content to file store so it becomes the live version
  if (action === "approve") {
    const schema = version.schema as { columns: never[]; defaultSort?: never };
    const data = version.data as { rows: never[] } | null;
    await writeTable(id, {
      columns: schema.columns,
      rows: data?.rows ?? [],
      defaultSort: schema.defaultSort ?? null,
    });
  }

  return Response.json({ ok: true, status: newStatus });
}
