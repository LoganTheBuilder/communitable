"use client";

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
  onSaveDraft?: () => void;
  onExit: () => void;
  onOpenSettings?: () => void;
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
  onSaveDraft,
  onExit,
  onOpenSettings,
}: Props) {

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
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Table settings
            </button>
          )}

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

          {onSaveDraft && (
            <button
              onClick={onSaveDraft}
              disabled={saving}
              className="px-3 py-1 rounded border border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
          )}

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

          {onSaveDraft && (
            <button
              onClick={onSaveDraft}
              disabled={saving}
              className="px-3 py-1 rounded border border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
          )}

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
