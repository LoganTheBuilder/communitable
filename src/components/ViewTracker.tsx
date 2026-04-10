"use client";

import { useEffect } from "react";

export default function ViewTracker({ tableId }: { tableId: string }) {
  useEffect(() => {
    fetch(`/api/tables/${tableId}/view`, { method: "POST" }).catch(() => null);
  }, [tableId]);
  return null;
}
