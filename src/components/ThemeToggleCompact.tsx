"use client";

import { useEffect, useState } from "react";

export default function ThemeToggleCompact() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
      type="button"
      aria-label="Toggle dark mode"
    >
      {dark ? (
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
          <path d="M15.5 15.5a7 7 0 1 1-7-11 7 7 0 0 0 7 11z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor" stroke="currentColor">
          <circle cx="10" cy="10" r="4" />
          <g strokeWidth="1.5">
            <line x1="10" y1="2" x2="10" y2="0" />
            <line x1="10" y1="18" x2="10" y2="20" />
            <line x1="2" y1="10" x2="0" y2="10" />
            <line x1="18" y1="10" x2="20" y2="10" />
            <line x1="15.07" y1="4.93" x2="16.48" y2="3.52" />
            <line x1="4.93" y1="15.07" x2="3.52" y2="16.48" />
            <line x1="15.07" y1="15.07" x2="16.48" y2="16.48" />
            <line x1="4.93" y1="4.93" x2="3.52" y2="3.52" />
          </g>
        </svg>
      )}
    </button>
  );
}
