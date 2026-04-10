import { getSession } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/auth/profile";
import { checkUnreadForOwner } from "@/lib/notifications";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) return Response.json({ hasUnread: false });

    const profile = await getProfileByUserId(session.user.id);
    if (!profile) return Response.json({ hasUnread: false });

    const hasUnread = await checkUnreadForOwner(profile.id);
    return Response.json({ hasUnread });
  } catch {
    return Response.json({ hasUnread: false });
  }
}
