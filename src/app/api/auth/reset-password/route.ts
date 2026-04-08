import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { authError } from "@/lib/auth/errors";

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return authError("MISSING_FIELDS", "Token and new password are required");
    }

    if (typeof newPassword === "string" && newPassword.length < 8) {
      return authError("WEAK_PASSWORD", "Password must be at least 8 characters");
    }

    await auth.api.resetPassword({
      body: { token, newPassword },
    });

    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("expired") || message.includes("TOKEN_EXPIRED")) {
      return authError("TOKEN_EXPIRED", "This reset link has expired. Please request a new one.");
    }
    return authError("RESET_FAILED", "Failed to reset password. The link may be invalid.");
  }
}
