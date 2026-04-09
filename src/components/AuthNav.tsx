"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthNav() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  return (
    <nav className="flex items-center gap-3">
      <ThemeToggle />
      {!isPending && (
        <>
          {session?.user ? (
            <>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {session.user.name || session.user.email}
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  router.push("/");
                  router.refresh();
                }}
                className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-1.5 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </>
      )}
    </nav>
  );
}
