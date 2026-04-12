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
      className="inline-flex items-center gap-1.5 font-bold text-sm text-white 
      px-2 py-1.75 
      bg-gradient-to-bl from-blue-500 to-cyan-400 
      hover:from-cyan-300 hover:to-green-400 
      rounded transition-colors disabled:opacity-50"
    >
      + New Table
    </button>
  );
}
