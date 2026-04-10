"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import ThemeToggle from "@/components/ThemeToggle";
import ThemeToggleCompact from "@/components/ThemeToggleCompact";

export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [hasUnread, setHasUnread] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check for unseen activity on the user's tables
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/my-tables/unread")
      .then((r) => r.json())
      .then((d) => setHasUnread(d.hasUnread))
      .catch(() => null);
  }, [session?.user?.id, pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav className="flex items-center gap-3">
      {!isPending && (
        <>
          {session?.user ? (
            <>
            <ThemeToggleCompact />
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="relative px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                {session.user.name || session.user.email}
                {hasUnread && (
                  <span className="absolute top-0.5 right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </span>
                )}
              </button>

              {open && (
                <div className="absolute right-0 mt-1 w-48 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-50">
                  <Link
                    href="/my-tables"
                    className="relative block px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    My Tables
                    {hasUnread && (
                      <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                      </span>
                    )}
                  </Link>
                  <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-700">
                    <ThemeToggle />
                  </div>
                  <button
                    onClick={async () => {
                      await signOut();
                      router.push("/");
                      router.refresh();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 border-t border-zinc-100 dark:border-zinc-700 transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
            </>
          ) : (
            <>
              <ThemeToggleCompact />
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
