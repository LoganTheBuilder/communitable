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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-bl from-[#f6339a] to-fuchsia-500 text-white rounded-md hover:from-pink-700 hover:to-fuchsia-600 dark:bg-gradient-to-bl dark:from-[#f6339a] dark:to-fuchsia-500 dark:text-white dark:hover:from-pink-700 dark:hover:to-fuchsia-600 transition-colors font-medium disabled:opacity-50"
    >
 
      + New Table
    </button>
  );
}
