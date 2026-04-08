"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

export default function AuthNav() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <nav className="flex items-center gap-3 h-8" />;
  }

  if (session?.user) {
    return (
      <nav className="flex items-center gap-3">
        <span className="text-sm text-zinc-500">{session.user.name || session.user.email}</span>
        <button
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
          className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          Log Out
        </button>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3">
      <Link
        href="/login"
        className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
      >
        Log In
      </Link>
      <Link
        href="/signup"
        className="px-4 py-1.5 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-700 transition-colors"
      >
        Sign Up
      </Link>
    </nav>
  );
}
