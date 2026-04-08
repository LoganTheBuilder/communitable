import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { authError } from "@/lib/auth/errors";
import { ensureProfile } from "@/lib/auth/profile";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return authError("MISSING_FIELDS", "Email and password are required");
    }

    if (typeof password === "string" && password.length < 8) {
      return authError("WEAK_PASSWORD", "Password must be at least 8 characters");
    }

    const result = await auth.api.signUpEmail({
      body: {
        name: name || email.split("@")[0],
        email,
        password,
      },
    });

    // Create profile lazily on signup
    if (result.user) {
      await ensureProfile(result.user.id, result.user.name);
    }

    return Response.json({ user: { id: result.user.id, email: result.user.email } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signup failed";
    if (message.includes("already exists") || message.includes("unique")) {
      return authError("EMAIL_EXISTS", "An account with this email already exists", 409);
    }
    return authError("SIGNUP_FAILED", "Unable to create account", 500);
  }
}
