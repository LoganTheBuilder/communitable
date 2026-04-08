import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { authError } from "@/lib/auth/errors";
import { ensureProfile } from "@/lib/auth/profile";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return authError("MISSING_FIELDS", "Email and password are required");
    }

    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: req.headers,
    });

    // Ensure profile exists on first login
    if (result.user) {
      await ensureProfile(result.user.id, result.user.name);
    }

    return Response.json({
      user: { id: result.user.id, email: result.user.email },
      session: { token: result.token },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("not verified") || message.includes("EMAIL_NOT_VERIFIED")) {
      return authError("EMAIL_NOT_VERIFIED", "Please verify your email before logging in", 403);
    }
    // Generic message prevents user enumeration
    return authError("INVALID_CREDENTIALS", "Invalid email or password", 401);
  }
}
