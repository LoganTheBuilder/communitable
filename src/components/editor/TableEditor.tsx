"use client";

import { useState, useReducer, useEffect, useRef, useCallback } from "react";
import CollaboratorCount from "@/components/CollaboratorCount";
import { useRouter } from "next/navigation";
import type { ColumnDef, Row } from "@/lib/types";
import TableGrid from "@/components/TableGrid";
import EditableGrid from "@/components/editor/EditableGrid";
import EditorToolbar from "@/components/editor/EditorToolbar";
import { useSession } from "@/lib/auth-client";

type Mode = "view" | "edit" | "preview";
type SortDir = "asc" | "desc";

interface DefaultSort {
  key: string;
  dir: SortDir;
}

export interface EditorContent {
  columns: ColumnDef[];
  rows: Row[];
  defaultSort: DefaultSort | null;
}

interface HistoryState {
  past: EditorContent[];
  present: EditorContent;
  future: EditorContent[];
}

type HistoryAction =
  | { type: "PUSH"; next: EditorContent }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; content: EditorContent };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "PUSH":
      return {
        past: [...state.past, state.present],
        present: action.next,
        future: [],
      };
    case "UNDO":
      if (!state.past.length) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    case "REDO":
      if (!state.future.length) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    case "RESET":
      return {
        past: [],
        present: action.content,
        future: [],
      };
  }
}

interface Props {
  tableId: string;
  initialColumns: ColumnDef[];
  initialRows: Row[];
  initialDefaultSort?: { key: string; dir: "asc" | "desc" } | null;
  /** When true, start in edit mode and show "Publish" instead of "Save" */
  publishMode?: boolean;
  initialName?: string;
  initialDescription?: string | null;
  /** When true, user is the table owner (can publish/unpublish) */
  isOwner?: boolean;
  collaborators?: string[];
}

export default function TableEditor({
  tableId,
  initialColumns,
  initialRows,
  initialDefaultSort = null,
  publishMode = false,
  initialName = "",
  initialDescription = null,
  isOwner = false,
  collaborators = [],
}: Props) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const router = useRouter();
  const pendingNavRef = useRef<string | null>(null);

  const [mode, setMode] = useState<Mode>(publishMode ? "edit" : "view");
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: { columns: initialColumns, rows: initialRows, defaultSort: initialDefaultSort },
    future: [],
  });

  // Track the last-saved content so we can reset on discard
  const [savedContent, setSavedContent] = useState<EditorContent>(history.present);

  const { present } = history;

  function push(patch: Partial<EditorContent>) {
    dispatch({ type: "PUSH", next: { ...present, ...patch } });
    setIsDirty(true);
  }

  function handleUndo() {
    dispatch({ type: "UNDO" });
    setIsDirty(true);
  }

  function handleRedo() {
    dispatch({ type: "REDO" });
    setIsDirty(true);
  }

  // ── Keyboard shortcuts: Ctrl/Cmd-Z undo, Ctrl/Cmd-Y redo ──
  useEffect(() => {
    if (mode !== "edit") return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, history.past.length, history.future.length]);

  // ── Unsaved changes: hard navigation (refresh, close, external URL) ──
  useEffect(() => {
    if (mode === "view" || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [mode, isDirty]);

  // ── Unsaved changes: Next.js <Link> clicks (soft navigation) ──
  useEffect(() => {
    if (mode === "view" || !isDirty) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor?.href || anchor.target === "_blank") return;

      try {
        const url = new URL(anchor.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname + url.search === window.location.pathname + window.location.search) return;

        e.preventDefault();
        e.stopPropagation();
        pendingNavRef.current = url.pathname + url.search + url.hash;
        setShowExitWarning(true);
      } catch {
        // invalid URL, let it pass through
      }
    };

    // capture phase so we intercept before Next.js router
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [mode, isDirty]);

  // ── Unsaved changes: browser back / forward ──
  useEffect(() => {
    if (mode === "view" || !isDirty) return;

    const handlePopState = () => {
      // Re-push current URL to cancel the back/forward navigation
      window.history.pushState(null, "", window.location.href);
      pendingNavRef.current = "__back__";
      setShowExitWarning(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [mode, isDirty]);

  // ── Exit handling ───────────────────────────────────────────
  function handleExitAttempt() {
    if (isDirty) {
      pendingNavRef.current = null;
      setShowExitWarning(true);
    } else {
      exitEditor();
    }
  }

  const exitEditor = useCallback(() => {
    const nav = pendingNavRef.current;
    pendingNavRef.current = null;
    dispatch({ type: "RESET", content: savedContent });
    setIsDirty(false);
    setShowExitWarning(false);

    if (nav === "__back__") {
      router.back();
    } else if (nav) {
      router.push(nav);
    } else {
      setMode("view");
    }
  }, [savedContent, router]);

  function dismissWarning() {
    pendingNavRef.current = null;
    setShowExitWarning(false);
  }

  const [isPublished, setIsPublished] = useState(!publishMode);
  const [tableName, setTableName] = useState(initialName);
  const [tableDescription, setTableDescription] = useState(initialDescription ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...present };
      if (!isPublished) {
        payload.publish = true;
      }
      payload.name = tableName;
      payload.description = tableDescription || null;
      await fetch(`/api/tables/${tableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // TODO: include auth token / session once auth is wired up
        body: JSON.stringify(payload),
      });
      setSavedContent(present);
      setIsDirty(false);
      if (!isPublished) setIsPublished(true);
    } finally {
      setSaving(false);
      setMode("view");
      router.refresh();
    }
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...present,
        name: tableName,
        description: tableDescription || null,
        // No publish flag — stays as draft
      };
      await fetch(`/api/tables/${tableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSavedContent(present);
      setIsDirty(false);
    } finally {
      setSaving(false);
      setMode("view");
      router.refresh();
    }
  }

  async function handleHide() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...present,
        unpublish: true,
        name: tableName,
        description: tableDescription || null,
      };
      await fetch(`/api/tables/${tableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSavedContent(present);
      setIsDirty(false);
      setIsPublished(false);
      setMode("view");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const toolbarProps = {
    undoCount: history.past.length,
    redoCount: history.future.length,
    columns: present.columns,
    defaultSort: present.defaultSort,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onSetDefaultSort: (sort: DefaultSort | null) => push({ defaultSort: sort }),
    onBackToEdit: () => setMode("edit"),
    onPreview: () => setMode("preview"),
    onSave: () => { void handleSave(); },
    saving,
    onExit: handleExitAttempt,
    tableName,
    tableDescription,
    isPublished,
    isOwner,
    onNameChange: (name: string) => { setTableName(name); setIsDirty(true); },
    onDescriptionChange: (desc: string) => { setTableDescription(desc); setIsDirty(true); },
    onHide: () => { void handleHide(); },
    ...(!isPublished && isOwner && {
      saveLabel: "Publish",
      savingLabel: "Publishing…",
      onSaveDraft: () => { void handleSaveDraft(); },
    }),
  };

  return (
    <div className="space-y-3">
      {/* Live row/column counts */}
      <div className="flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
        <span>{present.rows.length.toLocaleString()} rows</span>
        <span>{present.columns.length} column{present.columns.length !== 1 ? "s" : ""}</span>
        <CollaboratorCount collaborators={collaborators} />
      </div>

      {mode === "view" && (
        <TableGrid
          columns={present.columns}
          rows={present.rows}
          initialSort={present.defaultSort ?? undefined}
          toolbarExtra={
            <button
              onClick={() => {
                if (isLoggedIn) {
                  setMode("edit");
                } else {
                  router.push("/signup");
                }
              }}
              className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
            >
              Edit
            </button>
          }
        />
      )}

      {mode === "edit" && (
        <>
          <EditorToolbar mode="edit" {...toolbarProps} />
          <EditableGrid
            columns={present.columns}
            rows={present.rows}
            onChange={(patch) => push(patch)}
          />
        </>
      )}

      {mode === "preview" && (
        <>
          <EditorToolbar mode="preview" {...toolbarProps} />
          {/* key forces TableGrid to re-mount with the new defaultSort applied */}
          <TableGrid
            key={JSON.stringify(present.defaultSort)}
            columns={present.columns}
            rows={present.rows}
            initialSort={present.defaultSort ?? undefined}
          />
        </>
      )}

      {/* Unsaved changes warning modal */}
      {showExitWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={dismissWarning}
          />
          {/* Dialog */}
          <div className="relative bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Unsaved changes
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              You have unsaved changes that will be lost if you exit. Are you
              sure you want to discard them?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={dismissWarning}
                className="px-4 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={exitEditor}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
