import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  // Always return success to prevent user enumeration
  if (email) {
    try {
      await auth.api.requestPasswordReset({
        body: {
          email,
          redirectTo: "/reset-password",
        },
      });
    } catch {
      // Silently fail — don't reveal whether the email exists
    }
  }

  return Response.json({ ok: true });
}
