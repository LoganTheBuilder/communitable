"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  type: ColumnDef["type"];
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

const TYPE_LABEL: Record<ColumnDef["type"], string> = {
  string: "Text",
  number: "Number",
  date: "Date",
};

export default function EditableGrid({ columns, rows, onChange }: Props) {
  // ── Column resize ───────────────────────────────────────────
  const { getWidth, onMouseDown: onResizeMouseDown } = useColumnResize(150);

  // ── Existing state ──────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingCol, setEditingCol] = useState<EditingCol | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState<ColumnDef["type"]>("string");
  const [colNameError, setColNameError] = useState(false);

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
    setEditingCol({ key: col.key, label: col.label, type: col.type });
  }

  function commitCol() {
    if (!editingCol) return;
    const existing = columns.find((c) => c.key === editingCol.key)!;
    const newLabel = editingCol.label.trim() || existing.label;
    // Only push to undo history if the label or type actually changed
    if (newLabel !== existing.label || editingCol.type !== existing.type) {
      onChange({
        columns: columns.map((c) =>
          c.key === editingCol.key ? { ...c, label: newLabel, type: editingCol.type } : c
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
      columns: [...columns, { key, label: newColLabel.trim(), type: newColType }],
      rows: rows.map((r) => ({ ...r, [key]: null })),
    });
    setAddingCol(false);
    setNewColLabel("");
    setNewColType("string");
  }

  function cancelAddCol() {
    setAddingCol(false);
    setNewColLabel("");
    setNewColType("string");
    setColNameError(false);
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

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-3">
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
                      <div
                        className="flex flex-col gap-1"
                        onBlur={(e) => {
                          // Only commit when focus leaves the entire editing container
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            commitCol();
                          }
                        }}
                      >
                        <input
                          autoFocus
                          value={editingCol.label}
                          onChange={(e) =>
                            setEditingCol({ ...editingCol, label: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitCol();
                            if (e.key === "Escape") setEditingCol(null);
                          }}
                          className="w-full text-sm font-medium px-1.5 py-0.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-zinc-900"
                        />
                        <select
                          value={editingCol.type}
                          onChange={(e) =>
                            setEditingCol({
                              ...editingCol,
                              type: e.target.value as ColumnDef["type"],
                            })
                          }
                          className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
                        >
                          <option value="string">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1 group/col">
                        <button
                          onClick={() => handleHeaderSortClick(col.key)}
                          className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 text-left min-w-0 flex-1"
                          title="Sort column"
                        >
                          <span className="truncate">{col.label}</span>
                          <span className="text-[10px] text-zinc-400 font-normal shrink-0">
                            {TYPE_LABEL[col.type]}
                          </span>
                          <SortIcon active={sortActive} dir={sort?.dir ?? "asc"} />
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startCol(col);
                            }}
                            className="opacity-0 group-hover/col:opacity-100 text-zinc-400 hover:text-zinc-700 transition-opacity text-xs p-0.5"
                            title="Rename column"
                          >
                            ✎
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCol(col.key);
                            }}
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
                  <div className="flex flex-col gap-1 min-w-[150px]">
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
                      <select
                        value={newColType}
                        onChange={(e) =>
                          setNewColType(e.target.value as ColumnDef["type"])
                        }
                        className="flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none"
                      >
                        <option value="string">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                      </select>
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
                <tr
                  key={originalIdx}
                  className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 group/row"
                >
                  {/* Delete-row button */}
                  <td className="w-7 px-1 text-center align-middle">
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
