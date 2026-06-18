"use client";

import { getDB } from "./db";
import type { Cast, PlaybackState, Settings } from "./types";

interface PullResponse {
  configured: boolean;
  casts: Cast[];
  playback: PlaybackState[];
  settings: Settings | null;
}

/**
 * Fire-and-forget pushes — failures don't block local writes.
 */
export async function pushCast(cast: Cast): Promise<void> {
  try {
    await fetch("/api/sync/casts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cast),
      keepalive: true,
    });
  } catch {
    // Offline / network error — local copy still saved.
  }
}

export async function pushCastDelete(id: string): Promise<void> {
  try {
    await fetch(`/api/sync/casts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

export async function pushPlayback(state: PlaybackState): Promise<void> {
  try {
    await fetch("/api/sync/playback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

export async function pushSettings(settings: Settings): Promise<void> {
  try {
    await fetch("/api/sync/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

/**
 * Pull everything from server, merge into IndexedDB.
 * Resolution: latest updatedAt wins. Local-only items get pushed up.
 */
export async function pullAndMerge(): Promise<{
  pulled: number;
  pushed: number;
  configured: boolean;
}> {
  const res = await fetch("/api/sync", { cache: "no-store" });
  if (!res.ok) return { pulled: 0, pushed: 0, configured: false };
  const data = (await res.json()) as PullResponse;
  if (!data.configured) return { pulled: 0, pushed: 0, configured: false };

  const db = getDB();
  const [localCasts, localPlayback] = await Promise.all([
    db.casts.toArray(),
    db.playback.toArray(),
  ]);

  const remoteCastsById = new Map(data.casts.map((c) => [c.id, c]));
  const localCastsById = new Map(localCasts.map((c) => [c.id, c]));

  let pulled = 0;
  let pushed = 0;

  // Casts: merge by updatedAt
  for (const [id, remote] of remoteCastsById) {
    const local = localCastsById.get(id);
    if (!local || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      await db.casts.put(remote);
      pulled++;
    }
  }
  for (const [id, local] of localCastsById) {
    const remote = remoteCastsById.get(id);
    if (!remote || (local.updatedAt ?? 0) > (remote.updatedAt ?? 0)) {
      void pushCast(local);
      pushed++;
    }
  }

  // Playback states
  const remotePbById = new Map(data.playback.map((p) => [p.castId, p]));
  const localPbById = new Map(localPlayback.map((p) => [p.castId, p]));
  for (const [id, remote] of remotePbById) {
    const local = localPbById.get(id);
    if (!local || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      await db.playback.put(remote);
      pulled++;
    }
  }
  for (const [id, local] of localPbById) {
    const remote = remotePbById.get(id);
    if (!remote || (local.updatedAt ?? 0) > (remote.updatedAt ?? 0)) {
      void pushPlayback(local);
      pushed++;
    }
  }

  // Settings: server wins if present (it's a singleton, not versioned strongly).
  if (data.settings) {
    await db.settings.put({ ...data.settings, id: "singleton" });
  }

  return { pulled, pushed, configured: true };
}
