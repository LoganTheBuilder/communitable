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
      {([      
        {
          name: "Light",
          icon: (
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor">
              <circle cx="10" cy="10" r="4" fill="currentColor" />
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
          ),
        },
        {
          name: "Dark",
          icon: (
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor">
              <path
                d="M15.5 15.5a7 7 0 1 1-7-11 7 7 0 0 0 7 11z"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          ),
        },
      ] as const).map(({ name, icon }) => {
        const isActive = name === "Dark" ? dark : !dark;
        return (
          <button
            key={name}
            onClick={() => setTheme(name === "Dark")}
            className={`px-2.5 py-1 transition-colors flex items-center justify-center ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
            aria-label={name === "Dark" ? "Enable dark mode" : "Enable light mode"}
            type="button"
          >
            <span className={name === "Dark" ? "inline-flex items-end" : ""} style={name === "Dark" ? { transform: "translateY(-2px)" } : undefined}>
              {icon}
            </span>
          </button>
     
        );
      })}
    </div>
  );
}
