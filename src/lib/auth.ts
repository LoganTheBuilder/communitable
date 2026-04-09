import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your password",
          html: `
            <h2>Reset your password</h2>
            <p>Click the link below to reset your password. This link expires in 1 hour.</p>
            <p><a href="${url}">Reset Password</a></p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          `,
        });
      } catch (err) {
        console.error("[Auth] Failed to send password reset email:", err);
      }
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        // BetterAuth's url points to /api/auth/verify-email?token=...
        // Rewrite it to the UI page so the user lands on a proper page.
        const parsed = new URL(url);
        const token = parsed.searchParams.get("token");
        const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
        const uiUrl = `${base}/verify-email?token=${token}`;

        await sendEmail({
          to: user.email,
          subject: "Verify your email",
          html: `
            <h2>Verify your email</h2>
            <p>Click the link below to verify your email address.</p>
            <p><a href="${uiUrl}">Verify Email</a></p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          `,
        });
      } catch (err) {
        console.error("[Auth] Failed to send verification email:", err);
      }
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
