"use client";

import { useEffect, useRef, useState } from "react";
import { pullAndMerge } from "@/lib/sync-client";

export interface SyncStatus {
  state: "idle" | "syncing" | "synced" | "error" | "disabled";
  pulled: number;
  pushed: number;
  error?: string;
}

/**
 * Pulls server state once on mount and merges into IndexedDB.
 * Cheap to call — Upstash mget is fast — but we still gate on a ref.
 */
export function useInitialSync(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    state: "idle",
    pulled: 0,
    pushed: 0,
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setStatus((s) => ({ ...s, state: "syncing" }));
    pullAndMerge()
      .then((r) => {
        setStatus({
          state: r.configured ? "synced" : "disabled",
          pulled: r.pulled,
          pushed: r.pushed,
        });
      })
      .catch((err) => {
        setStatus({
          state: "error",
          pulled: 0,
          pushed: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, []);

  return status;
}
