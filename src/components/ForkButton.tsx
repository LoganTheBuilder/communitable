"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function ForkButton({ tableId }: { tableId: string }) {
  const router = useRouter();
  const { data: session } = useSession();

  function handleClick() {
    if (session?.user) {
      router.push(`/tables/${tableId}/fork`);
    } else {
      router.push("/signup");
    }
  }

  return (
    <button
      onClick={handleClick}
      className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors underline underline-offset-2"
    >
      Fork
    </button>
  );
}
