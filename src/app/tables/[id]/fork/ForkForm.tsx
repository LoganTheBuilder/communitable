"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

interface Props {
  sourceId: string;
  defaultName: string;
  defaultDescription: string | null;
}

export default function ForkForm({ sourceId, defaultName, defaultDescription }: Props) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [name, setName] = useState(`${defaultName} (fork)`);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/signup");
    }
  }, [isPending, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Table name is required.");
      return;
    }

    setForking(true);
    setError(null);

    try {
      const res = await fetch(`/api/tables/${sourceId}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fork table");
      }

      const { id } = await res.json();
      router.push(`/tables/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setForking(false);
    }
  }

  if (isPending || !session?.user) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="fork-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Table name
        </label>
        <input
          id="fork-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 focus:border-transparent"
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="fork-desc" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Description <span className="text-zinc-400 dark:text-zinc-500 font-normal">(optional)</span>
        </label>
        <textarea
          id="fork-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 focus:border-transparent resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={forking}
        className="w-full py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {forking ? "Forking…" : "Fork Table"}
      </button>
    </form>
  );
}
