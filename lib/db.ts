"use client";

import Dexie, { type Table } from "dexie";
import type { Cast, PlaybackState, Settings } from "./types";
import {
  pushCast,
  pushCastDelete,
  pushPlayback,
  pushSettings,
} from "./sync-client";

export interface AudioCacheEntry {
  key: string;
  castId: string;
  sectionId: string;
  chunkIndex: number;
  voice: string;
  mimeType: string;
  blob: Blob;
  durationSeconds?: number;
  createdAt: number;
}

export function audioCacheKey(
  castId: string,
  sectionId: string,
  chunkIndex: number,
  voice: string,
): string {
  return `${castId}:${sectionId}:${chunkIndex}:${voice}`;
}

export class ClaudeCastDB extends Dexie {
  casts!: Table<Cast, string>;
  playback!: Table<PlaybackState, string>;
  settings!: Table<Settings, string>;
  audio!: Table<AudioCacheEntry, string>;

  constructor() {
    super("claudecast");
    this.version(1).stores({
      casts: "id, createdAt, updatedAt, title, sourceType, sourceDocumentId",
      playback: "castId, updatedAt",
      settings: "id",
    });
    this.version(2).stores({
      casts: "id, createdAt, updatedAt, title, sourceType, sourceDocumentId",
      playback: "castId, updatedAt",
      settings: "id",
      audio: "key, castId, createdAt",
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
  ttsProvider: "google",
  ttsVoice: "en-US-Neural2-J",
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
  void pushSettings(next);
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
  const stamped = { ...cast, updatedAt: Date.now() };
  await db.casts.put(stamped);
  void pushCast(stamped);
}

export async function deleteCast(id: string): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.casts, db.playback, db.audio, async () => {
    await db.casts.delete(id);
    await db.playback.delete(id);
    await db.audio.where("castId").equals(id).delete();
  });
  void pushCastDelete(id);
}

export async function getCachedAudio(
  key: string,
): Promise<AudioCacheEntry | undefined> {
  return getDB().audio.get(key);
}

export async function putCachedAudio(entry: AudioCacheEntry): Promise<void> {
  await getDB().audio.put(entry);
}

export async function deleteCastAudio(castId: string): Promise<void> {
  await getDB().audio.where("castId").equals(castId).delete();
}

export async function getPlayback(castId: string): Promise<PlaybackState | undefined> {
  return getDB().playback.get(castId);
}

export async function savePlayback(state: PlaybackState): Promise<void> {
  const db = getDB();
  const stamped = { ...state, updatedAt: Date.now() };
  await db.playback.put(stamped);
  void pushPlayback(stamped);
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
