"use client";

import { useRouter } from "next/navigation";

interface Props {
  label?: string;
}

export default function BackButton({ label = "Go back" }: Props) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
    >
      ← {label}
    </button>
  );
}
