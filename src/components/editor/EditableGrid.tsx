"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import type { ColumnDef, Row, CellValue } from "@/lib/types";
import { useColumnResize } from "@/components/useColumnResize";

interface EditingCell {
  rowIdx: number; // original data index
  colKey: string;
  value: string;
}

interface EditingCol {
  key: string;
  label: string;
}

interface Props {
  columns: ColumnDef[];
  rows: Row[];
  onChange: (patch: { columns?: ColumnDef[]; rows?: Row[] }) => void;
}

function makeKey(label: string, existing: ColumnDef[]): string {
  const base =
    label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "col";
  let key = base;
  let n = 2;
  while (existing.some((c) => c.key === key)) key = `${base}_${n++}`;
  return key;
}

function compareValues(a: CellValue, b: CellValue, type: ColumnDef["type"]): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (type === "number") return (a as number) - (b as number);
  return String(a).localeCompare(String(b));
}


interface PasteConfirm {
  pendingColumns: ColumnDef[];
  pendingRows: Row[];
  overwriteCount: number;
}

interface CellPasteSuggest {
  text: string;
  anchorRowIdx: number;
  anchorColIdx: number;
}

function parseTSV(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trimEnd()
    .split("\n")
    .map((line) => line.split("\t"));
}

export default function EditableGrid({ columns, rows, onChange }: Props) {
  // ── Column resize ───────────────────────────────────────────
  const { getWidth, onMouseDown: onResizeMouseDown } = useColumnResize(150);

  // ── Existing state ──────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingCol, setEditingCol] = useState<EditingCol | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [colNameError, setColNameError] = useState(false);
  const [pasteConfirm, setPasteConfirm] = useState<PasteConfirm | null>(null);
  const [cellPasteSuggest, setCellPasteSuggest] = useState<CellPasteSuggest | null>(null);
  const [openColMenu, setOpenColMenu] = useState<string | null>(null);
  const [insertColHover, setInsertColHover] = useState<number | null>(null);
  const [insertRowHover, setInsertRowHover] = useState<number | null>(null);

  // ── Keyboard navigation ─────────────────────────────────────
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);

  // ── Temporary filter / sort ─────────────────────────────────
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterCol, setFilterCol] = useState("__all__");

  // ── Column drag reorder ─────────────────────────────────────
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const skipBlurRef = useRef(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // ── Display rows (filtered + sorted, mapped to originals) ───
  const displayRows = useMemo(() => {
    let indexed = rows.map((row, idx) => ({ row, originalIdx: idx }));

    const q = filterQuery.trim().toLowerCase();
    if (q) {
      const keys = filterCol === "__all__" ? columns.map((c) => c.key) : [filterCol];
      indexed = indexed.filter(({ row }) =>
        keys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
      );
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        indexed = [...indexed].sort((a, b) => {
          const cmp = compareValues(a.row[col.key], b.row[col.key], col.type);
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }

    return indexed;
  }, [rows, columns, filterQuery, filterCol, sort]);

  // Clamp focused cell when display changes
  useEffect(() => {
    if (!focusedCell) return;
    if (displayRows.length === 0 || columns.length === 0) {
      setFocusedCell(null);
    } else {
      const row = Math.min(focusedCell.row, displayRows.length - 1);
      const col = Math.min(focusedCell.col, columns.length - 1);
      if (row !== focusedCell.row || col !== focusedCell.col) {
        setFocusedCell({ row, col });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayRows.length, columns.length]);

  // Return focus to grid container when editing ends
  useEffect(() => {
    if (!editingCell && focusedCell) {
      gridRef.current?.focus();
    }
  }, [editingCell, focusedCell]);

  // Dismiss cell-paste suggestion when editing ends (commit, escape, or click away)
  useEffect(() => {
    if (!editingCell) setCellPasteSuggest(null);
  }, [editingCell]);

  // Close column dropdown when clicking outside it
  useEffect(() => {
    if (!openColMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setOpenColMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openColMenu]);

  // ── Cell editing ────────────────────────────────────────────
  function startCellAt(displayRow: number, colIdx: number) {
    const { originalIdx, row } = displayRows[displayRow];
    const col = columns[colIdx];
    const v = row[col.key];
    setFocusedCell({ row: displayRow, col: colIdx });
    setEditingCell({
      rowIdx: originalIdx,
      colKey: col.key,
      value: v == null ? "" : String(v),
    });
  }

  function commitCell() {
    if (!editingCell) return;
    const col = columns.find((c) => c.key === editingCell.colKey)!;
    const raw = editingCell.value;
    const parsed =
      raw === ""
        ? null
        : col.type === "number" && !isNaN(Number(raw))
        ? Number(raw)
        : raw;
    // Only push to undo history if the value actually changed
    const existing = rows[editingCell.rowIdx]?.[editingCell.colKey] ?? null;
    if (parsed !== existing) {
      onChange({
        rows: rows.map((r, i) =>
          i === editingCell.rowIdx ? { ...r, [editingCell.colKey]: parsed } : r
        ),
      });
    }
    setEditingCell(null);
  }

  function handleCellBlur() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    commitCell();
  }

  // ── Focus navigation ────────────────────────────────────────
  function moveFocus(dRow: number, dCol: number, wrap = false) {
    if (!focusedCell) return;
    let newRow = focusedCell.row + dRow;
    let newCol = focusedCell.col + dCol;

    if (wrap) {
      if (newCol >= columns.length) {
        newCol = 0;
        newRow++;
      } else if (newCol < 0) {
        newCol = columns.length - 1;
        newRow--;
      }
      // At the boundary, do nothing
      if (newRow < 0 || newRow >= displayRows.length) return;
    }

    newRow = Math.max(0, Math.min(displayRows.length - 1, newRow));
    newCol = Math.max(0, Math.min(columns.length - 1, newCol));
    setFocusedCell({ row: newRow, col: newCol });
  }

  function commitAndMove(dRow: number, dCol: number, wrap = false) {
    commitCell();
    if (!focusedCell) return;
    let newRow = focusedCell.row + dRow;
    let newCol = focusedCell.col + dCol;

    if (wrap) {
      if (newCol >= columns.length) {
        newCol = 0;
        newRow++;
      } else if (newCol < 0) {
        newCol = columns.length - 1;
        newRow--;
      }
    }

    // If the destination is out of bounds, just commit and stay
    if (newRow < 0 || newRow >= displayRows.length || newCol < 0 || newCol >= columns.length) {
      return;
    }

    // If we didn't actually move, just commit without re-entering edit
    if (newRow === focusedCell.row && newCol === focusedCell.col) {
      return;
    }

    setFocusedCell({ row: newRow, col: newCol });

    // Start editing the next cell immediately for rapid data entry
    const { originalIdx, row } = displayRows[newRow];
    const col = columns[newCol];
    const v = row[col.key];
    setEditingCell({
      rowIdx: originalIdx,
      colKey: col.key,
      value: v == null ? "" : String(v),
    });
  }

  function handleGridKeyDown(e: React.KeyboardEvent) {
    if (editingCell) return; // editing input handles its own keys
    if (!focusedCell) return;

    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (ctrlOrMeta) setFocusedCell({ row: 0, col: focusedCell.col });
        else moveFocus(-1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (ctrlOrMeta)
          setFocusedCell({ row: displayRows.length - 1, col: focusedCell.col });
        else moveFocus(1, 0);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (ctrlOrMeta) setFocusedCell({ row: focusedCell.row, col: 0 });
        else moveFocus(0, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (ctrlOrMeta)
          setFocusedCell({ row: focusedCell.row, col: columns.length - 1 });
        else moveFocus(0, 1);
        break;
      case "Tab":
        e.preventDefault();
        moveFocus(0, e.shiftKey ? -1 : 1, true);
        break;
      case "Enter":
        e.preventDefault();
        if (e.shiftKey) {
          moveFocus(-1, 0);
        } else {
          startCellAt(focusedCell.row, focusedCell.col);
        }
        break;
      case "Escape":
        setFocusedCell(null);
        break;
    }
  }

  function handleCellKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        skipBlurRef.current = true;
        commitAndMove(e.shiftKey ? -1 : 1, 0);
        break;
      case "Tab":
        e.preventDefault();
        skipBlurRef.current = true;
        commitAndMove(0, e.shiftKey ? -1 : 1, true);
        break;
      case "Escape":
        skipBlurRef.current = true;
        setEditingCell(null);
        break;
    }
  }

  // ── Column header ───────────────────────────────────────────

  function startCol(col: ColumnDef) {
    setEditingCol({ key: col.key, label: col.label });
  }

  function commitCol() {
    if (!editingCol) return;
    const existing = columns.find((c) => c.key === editingCol.key)!;
    const newLabel = editingCol.label.trim() || existing.label;
    if (newLabel !== existing.label) {
      onChange({
        columns: columns.map((c) =>
          c.key === editingCol.key ? { ...c, label: newLabel } : c
        ),
      });
    }
    setEditingCol(null);
  }

  function deleteCol(key: string) {
    onChange({
      columns: columns.filter((c) => c.key !== key),
      rows: rows.map(({ [key]: _removed, ...rest }) => rest),
    });
  }

  // ── Sort ────────────────────────────────────────────────────

  function handleHeaderSortClick(key: string) {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === "asc" ? { key, dir: "desc" } : null;
      }
      return { key, dir: "asc" };
    });
  }

  // ── Rows ────────────────────────────────────────────────────

  function addRow() {
    onChange({ rows: [...rows, Object.fromEntries(columns.map((c) => [c.key, null]))] });
  }

  function deleteRow(originalIdx: number) {
    onChange({ rows: rows.filter((_, i) => i !== originalIdx) });
  }

  // ── Add column ──────────────────────────────────────────────

  function commitAddCol() {
    if (!newColLabel.trim()) {
      setColNameError(true);
      return;
    }
    setColNameError(false);
    const key = makeKey(newColLabel, columns);
    onChange({
      columns: [...columns, { key, label: newColLabel.trim(), type: "string" }],
      rows: rows.map((r) => ({ ...r, [key]: null })),
    });
    setAddingCol(false);
    setNewColLabel("");
  }

  function cancelAddCol() {
    setAddingCol(false);
    setNewColLabel("");
    setColNameError(false);
  }

  // ── Column menu actions ─────────────────────────────────────

  function moveColToFirst(colIdx: number) {
    const newCols = [...columns];
    const [col] = newCols.splice(colIdx, 1);
    newCols.unshift(col);
    onChange({ columns: newCols });
    setOpenColMenu(null);
  }

  function moveColToLast(colIdx: number) {
    const newCols = [...columns];
    const [col] = newCols.splice(colIdx, 1);
    newCols.push(col);
    onChange({ columns: newCols });
    setOpenColMenu(null);
  }

  function insertColAt(idx: number) {
    const label = `Column ${columns.length + 1}`;
    const key = makeKey(label, columns);
    const newCol: ColumnDef = { key, label, type: "string" };
    const newCols = [...columns.slice(0, idx), newCol, ...columns.slice(idx)];
    onChange({
      columns: newCols,
      rows: rows.map((r) => ({ ...r, [key]: null })),
    });
    setOpenColMenu(null);
    setInsertColHover(null);
  }

  function insertRowAfter(originalIdx: number) {
    const blank = Object.fromEntries(columns.map((c) => [c.key, null]));
    onChange({
      rows: [...rows.slice(0, originalIdx + 1), blank, ...rows.slice(originalIdx + 1)],
    });
    setInsertRowHover(null);
  }

  // ── Column reorder (drag & drop) ───────────────────────────

  function handleColumnDrop(targetIdx: number) {
    if (dragCol === null || dragCol === targetIdx) return;
    const newCols = [...columns];
    const [moved] = newCols.splice(dragCol, 1);
    const insertIdx = targetIdx > dragCol ? targetIdx - 1 : targetIdx;
    newCols.splice(insertIdx, 0, moved);
    onChange({ columns: newCols });
    setFocusedCell(null);
    setDragCol(null);
    setDragOverCol(null);
  }

  function handleDropAtEnd() {
    if (dragCol === null) return;
    const newCols = [...columns];
    const [moved] = newCols.splice(dragCol, 1);
    newCols.push(moved);
    onChange({ columns: newCols });
    setFocusedCell(null);
    setDragCol(null);
    setDragOverCol(null);
  }

  // ── Paste from external spreadsheet ────────────────────────

  function computeTablePaste(
    text: string,
    anchorRow: number,
    anchorCol: number
  ): PasteConfirm {
    const grid = parseTSV(text);
    const pastedRowCount = grid.length;
    const pastedColCount = Math.max(...grid.map((r) => r.length));

    // Extend columns if the paste is wider than what exists
    let newColumns = [...columns];
    const colsNeeded = anchorCol + pastedColCount - columns.length;
    for (let i = 0; i < colsNeeded; i++) {
      const label = `Column ${columns.length + i + 1}`;
      const key = makeKey(label, newColumns);
      newColumns.push({ key, label, type: "string" });
    }

    // Clone rows and seed any new columns with null
    let newRows: Row[] = rows.map((r) => ({ ...r }));
    const addedCols = newColumns.slice(columns.length);
    if (addedCols.length > 0) {
      newRows = newRows.map((r) => ({
        ...r,
        ...Object.fromEntries(addedCols.map((c) => [c.key, null])),
      }));
    }

    // Extend rows if the paste is taller than what exists
    const rowsNeeded = anchorRow + pastedRowCount - newRows.length;
    for (let i = 0; i < rowsNeeded; i++) {
      newRows.push(Object.fromEntries(newColumns.map((c) => [c.key, null])));
    }

    // Apply pasted values and count overwrites
    let overwriteCount = 0;
    for (let r = 0; r < pastedRowCount; r++) {
      const rowIdx = anchorRow + r;
      for (let c = 0; c < grid[r].length; c++) {
        const colIdx = anchorCol + c;
        const col = newColumns[colIdx];
        const raw = grid[r][c];
        const parsed: CellValue =
          raw === ""
            ? null
            : col.type === "number" && !isNaN(Number(raw))
            ? Number(raw)
            : raw;

        // Only count as an overwrite if the cell existed before this paste
        const wasExistingRow = rowIdx < rows.length;
        const wasExistingCol = colIdx < columns.length;
        if (wasExistingRow && wasExistingCol) {
          const existing = rows[rowIdx][col.key];
          if (existing !== null && existing !== undefined) {
            overwriteCount++;
          }
        }

        newRows[rowIdx][col.key] = parsed;
      }
    }

    return { pendingColumns: newColumns, pendingRows: newRows, overwriteCount };
  }

  function applyOrConfirmPaste(result: PasteConfirm) {
    if (result.overwriteCount > 0) {
      setPasteConfirm(result);
    } else {
      onChange({ columns: result.pendingColumns, rows: result.pendingRows });
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const isMultiCell = text.includes("\t") || text.trimEnd().includes("\n");

    if (editingCell) {
      // Cell input handles the paste — but suggest table paste if it looks like spreadsheet data
      if (isMultiCell) {
        const anchorColIdx = columns.findIndex((c) => c.key === editingCell.colKey);
        setCellPasteSuggest({ text, anchorRowIdx: editingCell.rowIdx, anchorColIdx });
      }
      return;
    }

    if (!focusedCell) return;
    if (!isMultiCell) return;

    e.preventDefault();
    const anchorRow = displayRows[focusedCell.row].originalIdx;
    applyOrConfirmPaste(computeTablePaste(text, anchorRow, focusedCell.col));
  }

  function handleCellPasteAsTable() {
    if (!cellPasteSuggest) return;
    const { text, anchorRowIdx, anchorColIdx } = cellPasteSuggest;
    // Revert the cell edit without committing its current value
    setEditingCell(null);
    setCellPasteSuggest(null);
    applyOrConfirmPaste(computeTablePaste(text, anchorRowIdx, anchorColIdx));
  }

  function confirmPaste() {
    if (!pasteConfirm) return;
    onChange({ columns: pasteConfirm.pendingColumns, rows: pasteConfirm.pendingRows });
    setPasteConfirm(null);
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Cell paste → table suggestion */}
      {cellPasteSuggest && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 text-sm">
          <span className="text-amber-800 dark:text-amber-300">
            Did you mean to paste your clipboard as a table?
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCellPasteSuggest(null)}
              className="px-2.5 py-1 rounded text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Dismiss
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCellPasteAsTable}
              className="px-2.5 py-1 rounded text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              Paste as table
            </button>
          </div>
        </div>
      )}

      {/* Paste overwrite confirmation */}
      {pasteConfirm && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 text-sm">
          <span className="text-amber-800 dark:text-amber-300">
            This will overwrite{" "}
            <strong>{pasteConfirm.overwriteCount} existing {pasteConfirm.overwriteCount === 1 ? "cell" : "cells"}</strong>.
            Continue?
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setPasteConfirm(null)}
              className="px-2.5 py-1 rounded text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmPaste}
              className="px-2.5 py-1 rounded text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              Paste anyway
            </button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter rows…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={filterCol}
          onChange={(e) => setFilterCol(e.target.value)}
          className="text-sm border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
        >
          <option value="__all__">All columns</option>
          {columns.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
        {filterQuery && (
          <span className="text-xs text-zinc-400 whitespace-nowrap">
            {displayRows.length} match{displayRows.length !== 1 ? "es" : ""}
          </span>
        )}
        {sort && (
          <button
            onClick={() => setSort(null)}
            className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
          >
            Clear sort ✕
          </button>
        )}
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        onPaste={handlePaste}
        className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700 focus:outline-none"
      >
        <table className="w-full text-sm border-collapse" style={{ minWidth: 28 + columns.reduce((sum, col) => sum + getWidth(col.key), 0) + 48, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 28 }} />
            {columns.map((col) => (
              <col key={col.key} style={{ width: getWidth(col.key) }} />
            ))}
            <col style={{ width: 48 }} />
          </colgroup>
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
              {/* Row-delete spacer */}
              <th className="w-7 min-w-[28px]" />

              {columns.map((col, colIdx) => {
                const isEditing = editingCol?.key === col.key;
                const isDragOver =
                  dragOverCol === colIdx && dragCol !== null && dragCol !== colIdx;
                const sortActive = sort?.key === col.key;

                return (
                  <th
                    key={col.key}
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      setDragCol(colIdx);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", "");
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragCol !== null) setDragOverCol(colIdx);
                    }}
                    onDragLeave={() => {
                      if (dragOverCol === colIdx) setDragOverCol(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleColumnDrop(colIdx);
                    }}
                    onDragEnd={() => {
                      setDragCol(null);
                      setDragOverCol(null);
                    }}
                    className={[
                      "px-3 py-2 text-left font-medium border-r border-zinc-100 dark:border-zinc-800 transition-all relative",
                      isDragOver ? "border-l-2 border-l-blue-400" : "",
                      dragCol === colIdx ? "opacity-40" : "",
                    ].join(" ")}
                    style={{ width: getWidth(col.key) }}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingCol.label}
                        onChange={(e) =>
                          setEditingCol({ ...editingCol, label: e.target.value })
                        }
                        onBlur={commitCol}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitCol();
                          if (e.key === "Escape") setEditingCol(null);
                        }}
                        className="w-full text-sm font-medium px-1.5 py-0.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-zinc-900"
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-1 group/col">
                        <button
                          onClick={() => handleHeaderSortClick(col.key)}
                          className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 text-left min-w-0 flex-1"
                          title="Sort column"
                        >
                          <span className="truncate">{col.label}</span>
                          <SortIcon active={sortActive} dir={sort?.dir ?? "asc"} />
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); startCol(col); }}
                            className="opacity-0 group-hover/col:opacity-100 text-zinc-400 hover:text-zinc-700 transition-opacity text-xs p-0.5"
                            title="Rename column"
                          >
                            ✎
                          </button>
                          {/* Column options dropdown */}
                          <div className="relative" ref={openColMenu === col.key ? colMenuRef : null}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenColMenu(openColMenu === col.key ? null : col.key);
                              }}
                              className="opacity-0 group-hover/col:opacity-100 text-zinc-400 hover:text-zinc-700 transition-opacity text-xs px-0.5 leading-none"
                              title="Column options"
                            >
                              ▾
                            </button>
                            {openColMenu === col.key && (
                              <div className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg py-0.5 min-w-[130px]">
                                <button
                                  onClick={() => moveColToFirst(colIdx)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                >
                                  Move to First
                                </button>
                                <button
                                  onClick={() => moveColToLast(colIdx)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                >
                                  Move to Last
                                </button>
                                <hr className="my-0.5 border-zinc-100 dark:border-zinc-700" />
                                <button
                                  onClick={() => insertColAt(colIdx + 1)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                >
                                  Insert New
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteCol(col.key); }}
                            className="opacity-0 group-hover/col:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity text-xs"
                            title={`Delete "${col.label}"`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Resize handle */}
                    <span
                      onMouseDown={(e) => onResizeMouseDown(col.key, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/40 transition-colors z-10"
                    />
                    {/* Column gap insert indicator (shows between col i-1 and col i) */}
                    {colIdx > 0 && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-3 -translate-x-1/2 z-20 flex items-center justify-center"
                        onMouseEnter={() => setInsertColHover(colIdx)}
                        onMouseLeave={() => setInsertColHover(null)}
                      >
                        {insertColHover === colIdx && (
                          <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertColAt(colIdx)}
                            className="w-6 h-6 rounded-full bg-blue-500 text-white text-[16px] leading-none flex items-center justify-center hover:bg-blue-600 shadow-sm"
                            title="Insert column here"
                          >
                            +
                          </button>
                     
                        )}
                      </div>
                    )}
                  </th>
                );
              })}

              {/* Add-column header cell */}
              <th
                className={[
                  "px-2 py-2 border-l border-zinc-100",
                  dragCol !== null ? "border-l-2 border-l-blue-400/30" : "",
                ].join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragCol !== null) setDragOverCol(columns.length);
                }}
                onDragLeave={() => {
                  if (dragOverCol === columns.length) setDragOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropAtEnd();
                }}
              >
                {addingCol ? (
                  <div className="flex flex-col gap-1 min-w-[140px]">
                    <input
                      autoFocus
                      placeholder="Column name"
                      value={newColLabel}
                      onChange={(e) => { setNewColLabel(e.target.value); setColNameError(false); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitAddCol();
                        if (e.key === "Escape") cancelAddCol();
                      }}
                      className={`text-sm px-1.5 py-0.5 border rounded focus:outline-none focus:ring-1 ${colNameError ? "border-red-400 focus:ring-red-400" : "border-zinc-300 focus:ring-blue-400"}`}
                    />
                    {colNameError && (
                      <p className="text-xs text-red-500">Column name is required.</p>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={commitAddCol}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-1"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelAddCol}
                        className="text-xs text-zinc-400 hover:text-zinc-600 px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCol(true)}
                    className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-base leading-none"
                    title="Add column"
                  >
                    +
                  </button>
                )}
              </th>
            </tr>
          </thead>

          <tbody>
            {displayRows.length === 0 && filterQuery ? (
              <tr>
                <td />
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-zinc-400"
                >
                  No rows match &ldquo;{filterQuery}&rdquo;
                </td>
                <td />
              </tr>
            ) : (
              displayRows.map(({ row, originalIdx }, displayIdx) => (
                <React.Fragment key={originalIdx}>
                <tr
                  className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 group/row"
                >
                  {/* Delete-row button + row gap insert indicator */}
                  <td className="w-7 px-1 text-center align-middle relative">
                    <button
                      onClick={() => deleteRow(originalIdx)}
                      className="opacity-0 group-hover/row:opacity-100 w-5 h-5 inline-flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all text-xs"
                      title="Delete row"
                    >
                      ✕
                    </button>
                  </td>

                  {columns.map((col, colIdx) => {
                    const isActiveEdit =
                      editingCell?.rowIdx === originalIdx &&
                      editingCell?.colKey === col.key;
                    const isFocused =
                      focusedCell?.row === displayIdx &&
                      focusedCell?.col === colIdx &&
                      !isActiveEdit;
                    const value = row[col.key];

                    return (
                      <td
                        key={col.key}
                        className={[
                          "border-r border-zinc-100 dark:border-zinc-800 last:border-r-0",
                          isActiveEdit
                            ? "p-0"
                            : "px-3 py-1.5 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/20",
                          isFocused
                            ? "ring-2 ring-inset ring-blue-400 bg-blue-50/30"
                            : "",
                          col.type === "number" && !isActiveEdit
                            ? "text-right tabular-nums"
                            : "",
                        ].join(" ")}
                        onClick={() => {
                          if (!isActiveEdit) startCellAt(displayIdx, colIdx);
                        }}
                      >
                        {isActiveEdit ? (
                          <input
                            autoFocus
                            value={editingCell.value}
                            onChange={(e) =>
                              setEditingCell({
                                ...editingCell,
                                value: e.target.value,
                              })
                            }
                            onBlur={handleCellBlur}
                            onKeyDown={handleCellKeyDown}
                            className="w-full px-3 py-1.5 bg-blue-50 ring-2 ring-inset ring-blue-400 focus:outline-none text-sm font-[inherit] text-zinc-900"
                          />
                        ) : (
                          <span
                            className={
                              value == null
                                ? "text-zinc-300 dark:text-zinc-600 italic text-xs"
                                : "text-zinc-700 dark:text-zinc-300"
                            }
                          >
                            {value == null
                              ? "empty"
                              : col.type === "number" && typeof value === "number"
                              ? value.toLocaleString()
                              : String(value)}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Spacer under the add-col header */}
                  <td className="border-l border-zinc-100 dark:border-zinc-800" />
                </tr>
                {/* Row gap — hover zone for insert-row indicator */}
                <tr
                  onMouseEnter={() => setInsertRowHover(displayIdx)}
                  onMouseLeave={() => setInsertRowHover(null)}
                  style={{ height: 0 }}
                >
                  <td
                    colSpan={columns.length + 2}
                    className="p-0 relative"
                    style={{ height: 6, lineHeight: 0 }}
                  >
                    {insertRowHover === displayIdx && (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertRowAfter(originalIdx)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-blue-500 text-white text-[15px] leading-none flex items-center justify-center hover:bg-blue-600 shadow-sm"
                        title="Insert row here"
                      >
                        +
                      </button>
                 
                 
                    )}
                  </td>
                </tr>
                </React.Fragment>
              ))
            )}

            {/* Add-row footer */}
            <tr className="border-t border-zinc-100 dark:border-zinc-800">
              <td />
              <td colSpan={columns.length} className="px-3 py-2">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  <span className="text-base leading-none font-medium">+</span>
                  <span>Add row</span>
                </button>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) {
    return (
      <svg
        className="w-3 h-3 text-zinc-300 dark:text-zinc-600 shrink-0"
        viewBox="0 0 8 12"
        fill="currentColor"
      >
        <path d="M4 0L7 4H1L4 0ZM4 12L1 8H7L4 12Z" />
      </svg>
    );
  }
  return (
    <svg
      className="w-3 h-3 text-zinc-600 dark:text-zinc-400 shrink-0"
      viewBox="0 0 8 8"
      fill="currentColor"
    >
      {dir === "asc" ? (
        <path d="M4 0L8 6H0L4 0Z" />
      ) : (
        <path d="M4 8L0 2H8L4 8Z" />
      )}
    </svg>
  );
}
