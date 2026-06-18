"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db";
import type { Cast, PlaybackState } from "@/lib/types";

export function useCasts(): Cast[] | undefined {
  return useLiveQuery(
    () => getDB().casts.orderBy("updatedAt").reverse().toArray(),
    [],
  );
}

export function useCast(id: string | undefined): Cast | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined;
    return getDB().casts.get(id);
  }, [id]);
}

export function usePlaybackStates(): Map<string, PlaybackState> | undefined {
  return useLiveQuery(async () => {
    const all = await getDB().playback.toArray();
    return new Map(all.map((p) => [p.castId, p]));
  }, []);
}

export function usePlaybackState(castId: string | undefined): PlaybackState | undefined {
  return useLiveQuery(async () => {
    if (!castId) return undefined;
    return getDB().playback.get(castId);
  }, [castId]);
}
