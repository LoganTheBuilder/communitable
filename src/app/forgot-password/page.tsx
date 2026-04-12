"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggleCompact from "@/components/ThemeToggleCompact";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Always show success to prevent user enumeration
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => {});

    setSubmitted(true);
    setLoading(false);
  }

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">
          Communitables
        </Link>
        <ThemeToggleCompact />
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm px-6">{content}</div>
      </div>
    </div>
  );

  if (submitted) {
    return shell(
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
          Check your email
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
          If an account exists for <strong>{email}</strong>, we sent a
          password reset link.
        </p>
        <Link href="/login" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
          Back to login
        </Link>
      </>
    );
  }

  return shell(
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-6">
        Reset your password
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm text-zinc-600 dark:text-zinc-400 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/login" className="text-zinc-900 dark:text-zinc-100 hover:underline">
          Back to login
        </Link>
      </p>
    </>
  );
}
