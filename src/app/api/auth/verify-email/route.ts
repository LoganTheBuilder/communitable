import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { authError } from "@/lib/auth/errors";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return authError("MISSING_TOKEN", "Verification token is required");
  }

  try {
    await auth.api.verifyEmail({
      query: { token },
    });
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("expired") || message.includes("TOKEN_EXPIRED")) {
      return authError("TOKEN_EXPIRED", "This verification link has expired.");
    }
    return authError("VERIFICATION_FAILED", "Invalid verification link.");
  }
}
