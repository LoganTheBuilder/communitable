import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { authError } from "@/lib/auth/errors";
import { getProfileByUserId } from "@/lib/auth/profile";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return authError("UNAUTHORIZED", "Not authenticated", 401);
    }

    const profile = await getProfileByUserId(session.user.id);

    return Response.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        emailVerified: session.user.emailVerified,
      },
      profile: profile
        ? {
            id: profile.id,
            displayName: profile.displayName,
            bio: profile.bio,
          }
        : null,
    });
  } catch {
    return authError("UNAUTHORIZED", "Not authenticated", 401);
  }
}
