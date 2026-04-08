import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { authError } from "@/lib/auth/errors";

export async function POST(req: NextRequest) {
  try {
    await auth.api.signOut({
      headers: req.headers,
    });
    return Response.json({ ok: true });
  } catch {
    return authError("LOGOUT_FAILED", "Failed to log out", 500);
  }
}
