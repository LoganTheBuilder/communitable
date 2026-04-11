"use client";

import { useState } from "react";

type Editability = "LOCKED" | "APPROVALS" | "OPEN";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  tableDescription: string;
  editability: Editability;
  isPublished: boolean;
  isOwner: boolean;
  saving: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (desc: string) => void;
  onEditabilityChange: (mode: Editability) => void;
  onHide: () => void;
}

const EDITABILITY_OPTIONS: { value: Editability; label: string; desc: string }[] = [
  { value: "OPEN", label: "Open", desc: "Anyone can edit immediately." },
  { value: "APPROVALS", label: "Approvals", desc: "Edits are submitted as drafts for your approval." },
  { value: "LOCKED", label: "Locked", desc: "Only you can edit this table." },
];

export default function TableSettingsModal({
  isOpen,
  onClose,
  tableName,
  tableDescription,
  editability,
  isPublished,
  isOwner,
  saving,
  onNameChange,
  onDescriptionChange,
  onEditabilityChange,
  onHide,
}: Props) {
  const [showHideConfirm, setShowHideConfirm] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Table Settings</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table name */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Table name</label>
          <input
            type="text"
            value={tableName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 focus:border-transparent"
            placeholder="Untitled table"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Description</label>
          <textarea
            value={tableDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 focus:border-transparent resize-none"
            placeholder="Add a description..."
          />
        </div>

        {/* Editability — owner only */}
        {isOwner && (
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Editability</label>
            <div className="space-y-2">
              {EDITABILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    editability === opt.value
                      ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="editability"
                    value={opt.value}
                    checked={editability === opt.value}
                    onChange={() => onEditabilityChange(opt.value)}
                    className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{opt.label}</span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Hide (unpublish) — owner only */}
        {isPublished && isOwner && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
            {!showHideConfirm ? (
              <button
                onClick={() => setShowHideConfirm(true)}
                className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-4.879-4.879" />
                </svg>
                Revert to Draft
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  This will unpublish the table and move it back to Draft. It will no longer be visible to others.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowHideConfirm(false); onHide(); onClose(); }}
                    disabled={saving}
                    className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowHideConfirm(false)}
                    className="px-4 py-2 text-sm rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
