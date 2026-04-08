import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Get the current session from server components/actions.
 * Returns null if not authenticated.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Get session or throw — use in protected server actions/routes.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
