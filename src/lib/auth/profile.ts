import { prisma } from "@/lib/prisma";

/**
 * Get or create a Profile record for a BetterAuth user.
 * Called lazily on first login or signup completion.
 */
export async function ensureProfile(userId: string, displayName?: string | null) {
  const existing = await prisma.profile.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  return prisma.profile.create({
    data: {
      userId,
      displayName: displayName || null,
    },
  });
}

/**
 * Get a Profile by BetterAuth user ID.
 */
export async function getProfileByUserId(userId: string) {
  return prisma.profile.findUnique({
    where: { userId },
  });
}
