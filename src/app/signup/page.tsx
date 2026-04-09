"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import ThemeToggle from "@/components/ThemeToggle";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (result.error) {
        const code = result.error.code ?? "";
        const msg = result.error.message ?? "";
        if (code === "USER_ALREADY_EXISTS" || msg.toLowerCase().includes("already exist")) {
          setError("An account with this email already exists. Try logging in instead.");
        } else {
          setError(msg || "Sign up failed. Please try again.");
        }
      } else {
        setSuccess(true);
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">
          Communitables
        </Link>
        <ThemeToggle />
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm px-6">{content}</div>
      </div>
    </div>
  );

  if (success) {
    return shell(
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
          Check your email
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
          We sent a verification link to <strong>{email}</strong>. Click it to
          activate your account.
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
        Create an account
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="block text-sm text-zinc-600 dark:text-zinc-400 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 focus:border-transparent"
            placeholder="Your name"
          />
        </div>
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
        <div>
          <label htmlFor="password" className="block text-sm text-zinc-600 dark:text-zinc-400 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 focus:border-transparent"
            placeholder="Min. 8 characters"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="text-zinc-900 dark:text-zinc-100 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
