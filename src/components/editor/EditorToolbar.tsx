"use client";

import { useState, useRef, useEffect } from "react";
import type { ColumnDef } from "@/lib/types";

type Mode = "edit" | "preview";
type SortDir = "asc" | "desc";

interface DefaultSort {
  key: string;
  dir: SortDir;
}

interface Props {
  mode: Mode;
  undoCount: number;
  redoCount: number;
  columns: ColumnDef[];
  defaultSort: DefaultSort | null;
  onUndo: () => void;
  onRedo: () => void;
  onSetDefaultSort: (sort: DefaultSort | null) => void;
  saving?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  onBackToEdit: () => void;
  onPreview: () => void;
  onSave: () => void;
  onExit: () => void;
  tableName?: string;
  tableDescription?: string;
  isPublished?: boolean;
  onNameChange?: (name: string) => void;
  onDescriptionChange?: (desc: string) => void;
  onHide?: () => void;
}

export default function EditorToolbar({
  mode,
  undoCount,
  redoCount,
  columns,
  defaultSort,
  saving = false,
  saveLabel = "Save",
  savingLabel = "Saving…",
  onUndo,
  onRedo,
  onSetDefaultSort,
  onBackToEdit,
  onPreview,
  onSave,
  onExit,
  tableName = "",
  tableDescription = "",
  isPublished = true,
  onNameChange,
  onDescriptionChange,
  onHide,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings panel when clicking outside
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSettings]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 dark:bg-zinc-800 text-white rounded-lg text-sm flex-wrap">
      {mode === "edit" ? (
        <>
          {/* Left: exit + preview + settings */}
          <button
            onClick={onExit}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs"
          >
            ← Exit
          </button>
          <button
            onClick={onPreview}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors text-xs"
          >
            Preview
          </button>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          {/* Table settings button */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                showSettings
                  ? "text-white bg-zinc-700"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-700"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Table settings
            </button>

            {/* Settings dropdown */}
            {showSettings && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 p-4 space-y-4">
                {/* Table name */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Table name</label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => onNameChange?.(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm bg-zinc-900 border border-zinc-600 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
                    placeholder="Untitled table"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Description</label>
                  <textarea
                    value={tableDescription}
                    onChange={(e) => onDescriptionChange?.(e.target.value)}
                    rows={2}
                    className="w-full px-2.5 py-1.5 text-sm bg-zinc-900 border border-zinc-600 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 resize-none"
                    placeholder="Add a description..."
                  />
                </div>

                {/* Hide (unpublish) */}
                {isPublished && (
                  <div className="pt-2 border-t border-zinc-700">
                    {!showHideConfirm ? (
                      <button
                        onClick={() => setShowHideConfirm(true)}
                        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-4.879-4.879" />
                        </svg>
                        Hide table (move to Draft)
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-400">
                          This will unpublish the table and move it back to Draft. It will no longer be visible to others.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setShowSettings(false);
                              setShowHideConfirm(false);
                              onHide?.();
                            }}
                            disabled={saving}
                            className="px-3 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            {saving ? "Hiding..." : "Confirm hide"}
                          </button>
                          <button
                            onClick={() => setShowHideConfirm(false)}
                            className="px-3 py-1 text-xs rounded text-zinc-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          {/* Default sort */}
          <span className="text-zinc-500 text-xs">Default sort:</span>
          <select
            value={defaultSort?.key ?? ""}
            onChange={(e) => {
              const key = e.target.value;
              if (!key) return onSetDefaultSort(null);
              onSetDefaultSort({ key, dir: defaultSort?.dir ?? "asc" });
            }}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer"
          >
            <option value="">None</option>
            {columns.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>
          {defaultSort && (
            <button
              onClick={() =>
                onSetDefaultSort({
                  ...defaultSort,
                  dir: defaultSort.dir === "asc" ? "desc" : "asc",
                })
              }
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs transition-colors"
              title="Toggle sort direction"
            >
              {defaultSort.dir === "asc" ? "↑ Asc" : "↓ Desc"}
            </button>
          )}

          <div className="flex-1" />

          {/* Right: undo / redo / save */}
          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={undoCount === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
              title="Undo"
            >
              ↩{undoCount > 0 && <span className="text-zinc-500">{undoCount}</span>}
            </button>
            <button
              onClick={onRedo}
              disabled={redoCount === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
              title="Redo"
            >
              ↪{redoCount > 0 && <span className="text-zinc-500">{redoCount}</span>}
            </button>
          </div>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1 rounded bg-white text-zinc-900 font-medium hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
          >
            {saving ? savingLabel : saveLabel}
          </button>
        </>
      ) : (
        /* Preview mode */
        <>
          <button
            onClick={onBackToEdit}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs"
          >
            ← Back to edit
          </button>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          <span className="text-zinc-500 text-xs italic">Previewing as viewer</span>

          <div className="flex-1" />

          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1 rounded bg-white text-zinc-900 font-medium hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
          >
            {saving ? savingLabel : saveLabel}
          </button>
          <button
            onClick={onExit}
            className="px-2.5 py-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs"
          >
            Exit
          </button>
        </>
      )}
    </div>
  );
}
