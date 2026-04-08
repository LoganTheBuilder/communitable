"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-zinc-500">Verifying...</p></div>}>
      <VerifyEmailContent />
    </Suspense>
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
          setErrorMessage(
            data.error?.message || "Invalid verification link."
          );
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("An unexpected error occurred.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-sm px-6 text-center">
        {status === "loading" && (
          <p className="text-zinc-500">Verifying your email...</p>
        )}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
              Email verified
            </h1>
            <p className="text-zinc-500 text-sm mb-6">
              Your email has been verified. You can now log in.
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-700 transition-colors"
            >
              Log In
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
              Verification failed
            </h1>
            <p className="text-sm text-red-600 mb-6">{errorMessage}</p>
            <Link
              href="/login"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
