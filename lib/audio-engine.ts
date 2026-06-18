"use client";

import {
  audioCacheKey,
  getCachedAudio,
  putCachedAudio,
  type AudioCacheEntry,
} from "./db";
import type { Cast, Chunk, Section } from "./types";

export type EngineStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export interface EngineState {
  status: EngineStatus;
  currentSectionId: string | null;
  currentChunkIndex: number;
  estimatedCurrentSeconds: number;
  totalDurationSeconds: number;
  rate: number;
  voice: string;
  error?: string;
}

export interface FlatEntry {
  globalIndex: number;
  section: Section;
  chunk: Chunk;
  estimatedStart: number;
}

function flatten(cast: Cast): FlatEntry[] {
  const out: FlatEntry[] = [];
  let g = 0;
  let cum = 0;
  for (const section of cast.sections) {
    for (const chunk of section.chunks) {
      out.push({ globalIndex: g++, section, chunk, estimatedStart: cum });
      cum += chunk.estimatedSeconds;
    }
  }
  return out;
}

type Listener = (s: EngineState) => void;

export interface AudioEngineOpts {
  rate: number;
  voice: string;
}

export class AudioEngine {
  private cast: Cast;
  private flat: FlatEntry[];
  private rate: number;
  private voice: string;

  private audio: HTMLAudioElement;
  private currentBlobUrl: string | null = null;
  private currentIndex = 0;
  private status: EngineStatus = "idle";
  private errorMessage: string | undefined;
  /** Actual chunk durations once known (seconds). Indexed by globalIndex. */
  private actualDurations: Map<number, number> = new Map();
  private listeners: Set<Listener> = new Set();
  private prefetchedKeys: Set<string> = new Set();
  private destroyed = false;
  /** Token to invalidate in-flight loads on rapid seeks. */
  private loadToken = 0;

  constructor(cast: Cast, opts: AudioEngineOpts) {
    this.cast = cast;
    this.flat = flatten(cast);
    this.rate = opts.rate;
    this.voice = opts.voice;

    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.playbackRate = this.rate;
    this.audio.addEventListener("ended", this.onEnded);
    this.audio.addEventListener("error", this.onError);
    this.audio.addEventListener("timeupdate", this.emit);
    this.audio.addEventListener("loadedmetadata", this.onLoadedMetadata);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private emit = () => {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  };

  snapshot(): EngineState {
    return {
      status: this.status,
      currentSectionId: this.currentEntry?.section.id ?? null,
      currentChunkIndex: this.currentEntry?.chunk.index ?? 0,
      estimatedCurrentSeconds: this.computeGlobalSeconds(),
      totalDurationSeconds: this.computeTotalSeconds(),
      rate: this.rate,
      voice: this.voice,
      error: this.errorMessage,
    };
  }

  private get currentEntry(): FlatEntry | undefined {
    return this.flat[this.currentIndex];
  }

  private getDuration(entry: FlatEntry): number {
    return (
      this.actualDurations.get(entry.globalIndex) ??
      entry.chunk.estimatedSeconds
    );
  }

  private computeTotalSeconds(): number {
    let total = 0;
    for (const e of this.flat) total += this.getDuration(e);
    return total;
  }

  private computeChunkStart(entry: FlatEntry): number {
    let start = 0;
    for (let i = 0; i < entry.globalIndex; i++) {
      start += this.getDuration(this.flat[i]);
    }
    return start;
  }

  private computeGlobalSeconds(): number {
    const entry = this.currentEntry;
    if (!entry) return 0;
    const within = isFinite(this.audio.currentTime)
      ? this.audio.currentTime
      : 0;
    return this.computeChunkStart(entry) + within;
  }

  setRate(rate: number) {
    this.rate = rate;
    this.audio.playbackRate = rate;
    this.emit();
  }

  setVoice(voice: string) {
    if (voice === this.voice) return;
    this.voice = voice;
    const wasPlaying = this.status === "playing";
    this.audio.pause();
    this.actualDurations.clear();
    this.prefetchedKeys.clear();
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    if (wasPlaying) this.play();
    else this.emit();
  }

  async play() {
    if (this.destroyed || this.flat.length === 0) return;
    if (this.status === "playing") return;
    this.errorMessage = undefined;
    if (!this.audio.src) {
      await this.loadCurrent();
      if (this.destroyed) return;
    }
    try {
      await this.audio.play();
      this.status = "playing";
      this.emit();
      this.prefetchAhead();
    } catch (err) {
      this.status = "error";
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.emit();
    }
  }

  pause() {
    if (this.status !== "playing") return;
    this.audio.pause();
    this.status = "paused";
    this.emit();
  }

  toggle() {
    if (this.status === "playing") this.pause();
    else this.play();
  }

  rewind(seconds: number) {
    this.seekToTime(this.computeGlobalSeconds() - seconds);
  }

  forward(seconds: number) {
    this.seekToTime(this.computeGlobalSeconds() + seconds);
  }

  async seekToTime(seconds: number) {
    if (this.flat.length === 0) return;
    const total = this.computeTotalSeconds();
    const clamped = Math.max(0, Math.min(seconds, total));
    let cum = 0;
    let targetIdx = 0;
    let withinChunk = 0;
    for (let i = 0; i < this.flat.length; i++) {
      const d = this.getDuration(this.flat[i]);
      if (clamped < cum + d) {
        targetIdx = i;
        withinChunk = clamped - cum;
        break;
      }
      cum += d;
      targetIdx = i;
      withinChunk = d;
    }
    const sameChunk = targetIdx === this.currentIndex && !!this.audio.src;
    if (sameChunk) {
      this.audio.currentTime = withinChunk;
      this.emit();
      return;
    }
    this.currentIndex = targetIdx;
    const wasPlaying = this.status === "playing";
    this.audio.pause();
    await this.loadCurrent({ seekWithin: withinChunk });
    if (this.destroyed) return;
    if (wasPlaying) await this.audio.play();
    this.emit();
  }

  async seekToSection(sectionId: string) {
    const idx = this.flat.findIndex((e) => e.section.id === sectionId);
    if (idx === -1) return;
    this.currentIndex = idx;
    const wasPlaying = this.status === "playing";
    this.audio.pause();
    await this.loadCurrent();
    if (this.destroyed) return;
    if (wasPlaying) await this.audio.play();
    this.emit();
  }

  async seekToChunk(sectionId: string, chunkIndex: number) {
    const idx = this.flat.findIndex(
      (e) => e.section.id === sectionId && e.chunk.index === chunkIndex,
    );
    if (idx === -1) return;
    this.currentIndex = idx;
    const wasPlaying = this.status === "playing";
    this.audio.pause();
    await this.loadCurrent();
    if (this.destroyed) return;
    if (wasPlaying) await this.audio.play();
    this.emit();
  }

  restoreState(state: {
    currentSectionId?: string | null;
    currentChunkIndex?: number;
    estimatedCurrentSeconds?: number;
  }) {
    if (state.currentSectionId) {
      const idx = this.flat.findIndex(
        (e) =>
          e.section.id === state.currentSectionId &&
          e.chunk.index === (state.currentChunkIndex ?? 0),
      );
      if (idx >= 0) {
        this.currentIndex = idx;
        this.emit();
        return;
      }
    }
    if (typeof state.estimatedCurrentSeconds === "number") {
      void this.seekToTime(state.estimatedCurrentSeconds);
    }
  }

  destroy() {
    this.destroyed = true;
    this.audio.pause();
    this.audio.removeEventListener("ended", this.onEnded);
    this.audio.removeEventListener("error", this.onError);
    this.audio.removeEventListener("timeupdate", this.emit);
    this.audio.removeEventListener("loadedmetadata", this.onLoadedMetadata);
    if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
    this.currentBlobUrl = null;
    this.listeners.clear();
  }

  private onEnded = () => {
    if (this.destroyed) return;
    if (this.currentIndex >= this.flat.length - 1) {
      this.status = "ended";
      this.emit();
      return;
    }
    this.currentIndex += 1;
    void this.loadCurrent().then(() => {
      if (this.destroyed) return;
      this.audio.play().catch(() => {});
      this.status = "playing";
      this.emit();
      this.prefetchAhead();
    });
  };

  private onError = () => {
    if (this.destroyed) return;
    this.status = "error";
    this.errorMessage = "Audio playback error";
    this.emit();
  };

  private onLoadedMetadata = () => {
    if (this.destroyed) return;
    const entry = this.currentEntry;
    if (!entry) return;
    if (isFinite(this.audio.duration) && this.audio.duration > 0) {
      this.actualDurations.set(entry.globalIndex, this.audio.duration);
      this.emit();
    }
  };

  private async loadCurrent(opts: { seekWithin?: number } = {}): Promise<void> {
    const entry = this.currentEntry;
    if (!entry) return;
    const token = ++this.loadToken;
    this.status = "loading";
    this.errorMessage = undefined;
    this.emit();
    try {
      const blob = await this.fetchAudioBlob(entry);
      if (token !== this.loadToken || this.destroyed) return;
      if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = URL.createObjectURL(blob);
      this.audio.src = this.currentBlobUrl;
      this.audio.playbackRate = this.rate;
      await new Promise<void>((resolve) => {
        const onCanPlay = () => {
          this.audio.removeEventListener("canplay", onCanPlay);
          resolve();
        };
        this.audio.addEventListener("canplay", onCanPlay);
        // Already-cached blob may not fire canplay if src didn't change; force load.
        try {
          this.audio.load();
        } catch {
          // ignore
        }
      });
      if (token !== this.loadToken || this.destroyed) return;
      if (opts.seekWithin != null && isFinite(opts.seekWithin)) {
        try {
          this.audio.currentTime = Math.max(0, opts.seekWithin);
        } catch {
          // ignore
        }
      }
      this.status = this.audio.paused ? "paused" : "playing";
      this.emit();
    } catch (err) {
      if (token !== this.loadToken || this.destroyed) return;
      this.status = "error";
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.emit();
    }
  }

  private async fetchAudioBlob(entry: FlatEntry): Promise<Blob> {
    const key = audioCacheKey(
      this.cast.id,
      entry.section.id,
      entry.chunk.index,
      this.voice,
    );
    const cached = await getCachedAudio(key);
    if (cached) {
      if (cached.durationSeconds) {
        this.actualDurations.set(entry.globalIndex, cached.durationSeconds);
      }
      return cached.blob;
    }
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: entry.chunk.text,
        voice: this.voice,
      }),
    });
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ error: { message: "TTS failed" } }));
      throw new Error(data?.error?.message ?? "TTS failed");
    }
    const blob = await res.blob();
    const cacheEntry: AudioCacheEntry = {
      key,
      castId: this.cast.id,
      sectionId: entry.section.id,
      chunkIndex: entry.chunk.index,
      voice: this.voice,
      mimeType: blob.type || "audio/mpeg",
      blob,
      createdAt: Date.now(),
    };
    try {
      await putCachedAudio(cacheEntry);
    } catch {
      // Cache failures shouldn't block playback.
    }
    return blob;
  }

  private async prefetchAhead(count = 2) {
    for (let offset = 1; offset <= count; offset++) {
      const target = this.flat[this.currentIndex + offset];
      if (!target) return;
      const key = audioCacheKey(
        this.cast.id,
        target.section.id,
        target.chunk.index,
        this.voice,
      );
      if (this.prefetchedKeys.has(key)) continue;
      this.prefetchedKeys.add(key);
      // Don't await — fire-and-forget prefetch.
      this.fetchAudioBlob(target).catch(() => {
        this.prefetchedKeys.delete(key);
      });
    }
  }
}
