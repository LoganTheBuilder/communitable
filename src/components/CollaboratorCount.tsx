"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  collaborators: string[];
}

export default function CollaboratorCount({ collaborators }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasCollaborators = collaborators.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => hasCollaborators && setOpen((v) => !v)}
        className={`transition-colors ${
          hasCollaborators
            ? "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline underline-offset-2 cursor-pointer"
            : "text-zinc-400 dark:text-zinc-500 cursor-default"
        }`}
      >
        {collaborators.length} collaborator{collaborators.length !== 1 ? "s" : ""}
      </button>
      {open && hasCollaborators && (
        <div className="absolute left-0 mt-1 w-44 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-50 py-1">
          {collaborators.map((name, i) => (
            <div
              key={i}
              className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300"
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
