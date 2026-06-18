"use client";

import Dexie, { type Table } from "dexie";
import type { Cast, PlaybackState, Settings } from "./types";

export class ClaudeCastDB extends Dexie {
  casts!: Table<Cast, string>;
  playback!: Table<PlaybackState, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("claudecast");
    this.version(1).stores({
      casts: "id, createdAt, updatedAt, title, sourceType, sourceDocumentId",
      playback: "castId, updatedAt",
      settings: "id",
    });
  }
}

let _db: ClaudeCastDB | null = null;

export function getDB(): ClaudeCastDB {
  if (typeof window === "undefined") {
    throw new Error("getDB() called server-side. Wrap callers in 'use client'.");
  }
  if (!_db) _db = new ClaudeCastDB();
  return _db;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  rate: 1.0,
  pitch: 1.0,
  wpm: 160,
  rewindSeconds: 15,
  forwardSeconds: 30,
};

export async function getSettings(): Promise<Settings> {
  const db = getDB();
  const existing = await db.settings.get("singleton");
  if (existing) return { ...DEFAULT_SETTINGS, ...existing };
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = getDB();
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, id: "singleton" };
  await db.settings.put(next);
  return next;
}

export async function listCasts(): Promise<Cast[]> {
  const db = getDB();
  return db.casts.orderBy("updatedAt").reverse().toArray();
}

export async function getCast(id: string): Promise<Cast | undefined> {
  return getDB().casts.get(id);
}

export async function saveCast(cast: Cast): Promise<void> {
  const db = getDB();
  await db.casts.put({ ...cast, updatedAt: Date.now() });
}

export async function deleteCast(id: string): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.casts, db.playback, async () => {
    await db.casts.delete(id);
    await db.playback.delete(id);
  });
}

export async function getPlayback(castId: string): Promise<PlaybackState | undefined> {
  return getDB().playback.get(castId);
}

export async function savePlayback(state: PlaybackState): Promise<void> {
  const db = getDB();
  await db.playback.put({ ...state, updatedAt: Date.now() });
}

export interface BackupBundle {
  version: 1;
  exportedAt: number;
  casts: Cast[];
  playback: PlaybackState[];
  settings: Settings;
}

export async function exportBackup(): Promise<BackupBundle> {
  const db = getDB();
  const [casts, playback, settings] = await Promise.all([
    db.casts.toArray(),
    db.playback.toArray(),
    getSettings(),
  ]);
  return { version: 1, exportedAt: Date.now(), casts, playback, settings };
}

export async function importBackup(bundle: BackupBundle): Promise<void> {
  if (bundle.version !== 1) {
    throw new Error(`Unsupported backup version: ${bundle.version}`);
  }
  const db = getDB();
  await db.transaction("rw", db.casts, db.playback, db.settings, async () => {
    await db.casts.bulkPut(bundle.casts);
    await db.playback.bulkPut(bundle.playback);
    await db.settings.put({ ...bundle.settings, id: "singleton" });
  });
}
