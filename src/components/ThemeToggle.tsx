"use client";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export default function ThemeToggle() {
  return (
    <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs opacity-40 cursor-not-allowed">
      {OPTIONS.map(({ value, label }) => (
        <span key={value} className="px-2.5 py-1 text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
      ))}
    </div>
  );
}
