"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-zinc-500">Loading...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-[family-name:var(--font-geist-sans)]">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
            Invalid link
          </h1>
          <p className="text-sm text-red-600 mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Failed to reset password");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-[family-name:var(--font-geist-sans)]">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
            Password reset
          </h1>
          <p className="text-zinc-500 text-sm mb-6">
            Your password has been updated. You can now log in.
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-700 transition-colors"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-sm px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-6">
          Set new password
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm text-zinc-600 mb-1"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label
              htmlFor="confirm"
              className="block text-sm text-zinc-600 mb-1"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
