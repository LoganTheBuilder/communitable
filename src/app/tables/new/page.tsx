"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewTablePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState(5);
  const [columns, setColumns] = useState(3);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Table name is required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), rows, columns }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create table");
      }

      const { id } = await res.json();
      router.push(`/tables/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-geist-sans)]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight hover:opacity-70 transition-opacity"
        >
          AllYourBase
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/auth/signin"
            className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-1.5 text-sm bg-zinc-900 text-white rounded-md hover:bg-zinc-700 transition-colors"
          >
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="px-8 py-12 max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-1">
          New Table
        </h1>
        <p className="text-sm text-zinc-500 mb-8">
          Set up your table, then fill in the data. Publish when you&apos;re ready to share.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
              Table name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. World Population by Country"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="desc" className="block text-sm font-medium text-zinc-700 mb-1">
              Description <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what this table contains"
              rows={2}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"
            />
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cols" className="block text-sm font-medium text-zinc-700 mb-1">
                Columns
              </label>
              <input
                id="cols"
                type="number"
                min={1}
                max={26}
                value={columns}
                onChange={(e) => setColumns(Number(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              />
              <p className="text-xs text-zinc-400 mt-1">1–26</p>
            </div>
            <div>
              <label htmlFor="rows" className="block text-sm font-medium text-zinc-700 mb-1">
                Rows
              </label>
              <input
                id="rows"
                type="number"
                min={0}
                max={1000}
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              />
              <p className="text-xs text-zinc-400 mt-1">0–1,000</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating…" : "Create Table"}
          </button>
        </form>
      </main>
    </div>
  );
}
