"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function NewTableButton() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  function handleClick() {
    if (session?.user) {
      router.push("/tables/new");
    } else {
      router.push("/signup");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors font-medium disabled:opacity-50"
    >
      + New Table
    </button>
  );
}
