"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Hook for managing column resize state via drag handles.
 * Returns width map + event handlers to attach to resize handles.
 */
export function useColumnResize(defaultWidth = 150) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const dragState = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const getWidth = useCallback(
    (key: string) => widths[key] ?? defaultWidth,
    [widths, defaultWidth]
  );

  const onMouseDown = useCallback(
    (key: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startW = widths[key] ?? defaultWidth;
      dragState.current = { key, startX: e.clientX, startW };

      // Capture values upfront so closures don't depend on mutable ref
      const colKey = key;
      const startX = e.clientX;

      const onMouseMove = (ev: MouseEvent) => {
        const diff = ev.clientX - startX;
        const newW = Math.max(60, startW + diff);
        setWidths((prev) => ({ ...prev, [colKey]: newW }));
      };

      const onMouseUp = () => {
        dragState.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [widths, defaultWidth]
  );

  return { getWidth, onMouseDown };
}
