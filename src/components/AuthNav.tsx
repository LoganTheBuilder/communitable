"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [hasUnread, setHasUnread] = useState(false);

  // Check for unseen activity on the user's tables
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/my-tables/unread")
      .then((r) => r.json())
      .then((d) => setHasUnread(d.hasUnread))
      .catch(() => null);
  }, [session?.user?.id, pathname]);

  return (
    <nav className="flex items-center gap-3">
      <ThemeToggle />
      {!isPending && (
        <>
          {session?.user ? (
            <>
              <Link
                href="/my-tables"
                className="relative px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                My Tables
                {hasUnread && (
                  <span className="absolute top-0.5 right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </span>
                )}
              </Link>
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
