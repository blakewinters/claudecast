"use client";

import { getDB } from "./db";
import type { Cast, PlaybackState, Settings } from "./types";

interface PullResponse {
  configured: boolean;
  casts: Cast[];
  playback: PlaybackState[];
  settings: Settings | null;
}

async function postJson(
  url: string,
  body: unknown,
  opts: { keepalive?: boolean } = {},
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // keepalive caps body at 64 KB; only enable for small payloads.
      keepalive: opts.keepalive ?? false,
    });
    if (!res.ok) {
      console.warn(`[sync] ${url} → ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[sync] ${url} threw`, err);
    return false;
  }
}

// Casts can be > 64 KB → no keepalive.
export async function pushCast(cast: Cast): Promise<boolean> {
  return postJson("/api/sync/casts", cast);
}

export async function pushCastDelete(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/sync/casts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Playback states are tiny — keepalive is safe.
export async function pushPlayback(state: PlaybackState): Promise<boolean> {
  return postJson("/api/sync/playback", state, { keepalive: true });
}

export async function pushSettings(settings: Settings): Promise<boolean> {
  return postJson("/api/sync/settings", settings, { keepalive: true });
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
  const pushPromises: Promise<unknown>[] = [];

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
      pushPromises.push(pushCast(local));
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
      pushPromises.push(pushPlayback(local));
      pushed++;
    }
  }

  // Settings: server wins if present (it's a singleton, not versioned strongly).
  if (data.settings) {
    await db.settings.put({ ...data.settings, id: "singleton" });
  }

  await Promise.allSettled(pushPromises);

  return { pulled, pushed, configured: true };
}
