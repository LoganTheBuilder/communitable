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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-bl from-yellow-500 to-yellow-700 text-white rounded-md 
      hover:from-pink-800 to-yellow-600
      dark:bg-gradient-to-bl dark:from-yellow-600 dark:to-yellow-700 dark:text-white 
      dark:hover:from-pink-800 dark:hover:to-yellow-600 
      transition-colors font-medium disabled:opacity-50"
    >
      + New Table
    </button>
  );
}
