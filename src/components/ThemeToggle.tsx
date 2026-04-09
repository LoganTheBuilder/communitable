"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function setTheme(toDark: boolean) {
    setDark(toDark);
    document.documentElement.classList.toggle("dark", toDark);
    try { localStorage.setItem("theme", toDark ? "dark" : "light"); } catch {}
  }

  return (
    <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
      {(["Light", "Dark"] as const).map((label) => {
        const isActive = label === "Dark" ? dark : !dark;
        return (
          <button
            key={label}
            onClick={() => setTheme(label === "Dark")}
            className={`px-2.5 py-1 transition-colors ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
