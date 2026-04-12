"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ThemeToggleCompact from "@/components/ThemeToggleCompact";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-900 font-[family-name:var(--font-geist-sans)]">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity">
          tablebees
        </Link>
        <ThemeToggleCompact />
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm px-6 text-center">
          <Suspense fallback={<p className="text-zinc-500 dark:text-zinc-400">Verifying...</p>}>
            <VerifyEmailContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "Missing verification token."
  );

  useEffect(() => {
    if (!token) return;

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMessage(data.error?.message || "Invalid verification link.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("An unexpected error occurred.");
      });
  }, [token]);

  return (
    <>
      {status === "loading" && (
        <p className="text-zinc-500 dark:text-zinc-400">Verifying your email...</p>
      )}
      {status === "success" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
            Email verified
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
            Your email has been verified. You can now log in.
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
          >
            Log In
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
            Verification failed
          </h1>
          <p className="text-sm text-red-600 dark:text-red-400 mb-6">{errorMessage}</p>
          <Link href="/login" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            Back to login
          </Link>
        </>
      )}
    </>
  );
}
