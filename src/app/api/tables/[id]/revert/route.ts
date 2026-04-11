import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeTable } from "@/lib/table-store";
import { auth } from "@/lib/auth";
import { ensureProfile } from "@/lib/auth/profile";

interface Params {
  params: Promise<{ id: string }>;
}

/** POST — revert table to a specific version, creating a new branch */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureProfile(session.user.id, session.user.name);
  const table = await prisma.table.findUnique({ where: { id }, select: { ownerId: true, activeBranch: true } });
  if (!table || table.ownerId !== profile.id) {
    return Response.json({ error: "Only the table owner can revert versions." }, { status: 403 });
  }

  const { versionId } = (await req.json()) as { versionId: string };
  if (!versionId) {
    return Response.json({ error: "versionId is required" }, { status: 400 });
  }

  const sourceVersion = await prisma.tableVersion.findUnique({
    where: { id: versionId },
    select: { schema: true, data: true, version: true, branch: true },
  });
  if (!sourceVersion) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  const existingBranches = await prisma.tableVersion.findMany({
    where: { tableId: id },
    select: { branch: true },
    distinct: ["branch"],
  });
  const branchNames = new Set(existingBranches.map((b) => b.branch));

  let newBranch = table.activeBranch;
  const latestOnBranch = await prisma.tableVersion.findFirst({
    where: { tableId: id, branch: table.activeBranch },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });

  // If reverting to a non-tip version, create a new branch
  if (latestOnBranch && latestOnBranch.id !== versionId) {
    const suffixes = "abcdefghijklmnopqrstuvwxyz";
    for (const suffix of suffixes) {
      const candidate = `main-${suffix}`;
      if (!branchNames.has(candidate)) {
        newBranch = candidate;
        break;
      }
    }
  }

  const nextVersion = newBranch !== table.activeBranch
    ? 1
    : (latestOnBranch?.version ?? 0) + 1;

  const schema = sourceVersion.schema as { columns: unknown[]; defaultSort?: unknown };
  const data = sourceVersion.data as { rows: unknown[] } | null;

  await prisma.tableVersion.create({
    data: {
      tableId: id,
      version: nextVersion,
      branch: newBranch,
      schema: sourceVersion.schema as object,
      data: sourceVersion.data as object ?? undefined,
      authorId: profile.id,
      message: `Reverted to v${sourceVersion.version}${sourceVersion.branch !== "main" ? ` (${sourceVersion.branch})` : ""}`,
    },
  });

  await prisma.table.update({
    where: { id },
    data: { activeBranch: newBranch, updatedAt: new Date() },
  });

  await writeTable(id, {
    columns: schema.columns as never[],
    rows: (data?.rows ?? []) as never[],
    defaultSort: (schema.defaultSort as never) ?? null,
  });

  return Response.json({
    ok: true,
    branch: newBranch,
    version: nextVersion,
    previousVersionId: latestOnBranch?.id ?? null,
  });
}
