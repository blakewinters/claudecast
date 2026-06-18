"use client";

import type { Cast, Chunk, Section } from "./types";

export type EngineStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

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

export interface EngineOptions {
  rate: number;
  pitch: number;
  voiceURI?: string;
}

export interface FlatEntry {
  globalIndex: number;
  section: Section;
  chunk: Chunk;
  globalStartSeconds: number;
}

type Listener = (s: EngineState) => void;

export function flattenCast(cast: Cast): FlatEntry[] {
  const out: FlatEntry[] = [];
  let g = 0;
  let cum = 0;
  for (const section of cast.sections) {
    for (const chunk of section.chunks) {
      out.push({ globalIndex: g++, section, chunk, globalStartSeconds: cum });
      cum += chunk.estimatedSeconds;
    }
  }
  return out;
}

export function findChunkIndexForTime(
  flat: FlatEntry[],
  seconds: number,
  totalDuration: number,
): number {
  if (flat.length === 0) return 0;
  const clamped = Math.max(0, Math.min(seconds, totalDuration));
  if (clamped >= totalDuration) return flat.length - 1;
  let idx = 0;
  for (let i = 0; i < flat.length; i++) {
    const e = flat[i];
    if (clamped < e.globalStartSeconds + e.chunk.estimatedSeconds) {
      idx = i;
      break;
    }
    idx = i;
  }
  return idx;
}

export class SpeechEngine {
  private cast: Cast;
  private flat: FlatEntry[];
  private rate: number;
  private pitch: number;
  private voiceURI: string | undefined;

  private currentIndex = 0;
  private chunkStartedAt = 0;
  private status: EngineStatus = "idle";
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private keepAliveHandle: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  private listeners: Set<Listener> = new Set();

  constructor(cast: Cast, opts: EngineOptions) {
    this.cast = cast;
    this.flat = flattenCast(cast);
    this.rate = opts.rate;
    this.pitch = opts.pitch;
    this.voiceURI = opts.voiceURI;
  }

  static isAvailable(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  static listVoices(): SpeechSynthesisVoice[] {
    if (!SpeechEngine.isAvailable()) return [];
    return window.speechSynthesis.getVoices();
  }

  static onVoicesChanged(cb: () => void): () => void {
    if (!SpeechEngine.isAvailable()) return () => {};
    const handler = () => cb();
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  snapshot(): EngineState {
    return {
      status: this.status,
      currentSectionId: this.currentEntry?.section.id ?? null,
      currentChunkIndex: this.currentEntry?.chunk.index ?? 0,
      estimatedCurrentSeconds: this.computeCurrentSeconds(),
      totalDurationSeconds: this.cast.totalDurationSeconds,
      rate: this.rate,
      voice: this.voiceURI ?? "",
    };
  }

  private get currentEntry(): FlatEntry | undefined {
    return this.flat[this.currentIndex];
  }

  private computeCurrentSeconds(): number {
    const entry = this.currentEntry;
    if (!entry) return 0;
    if (this.status !== "playing") {
      return entry.globalStartSeconds;
    }
    const elapsedMs = Date.now() - this.chunkStartedAt;
    const playbackSeconds = (elapsedMs / 1000) * this.rate;
    const capped = Math.min(playbackSeconds, entry.chunk.estimatedSeconds);
    return entry.globalStartSeconds + capped;
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.status === "playing") {
      const t = this.computeCurrentSeconds();
      this.cancelUtterance();
      this.seekToTime(t);
      this.startSpeaking();
    } else {
      this.emit();
    }
  }

  setVoice(voiceURI: string | undefined) {
    this.voiceURI = voiceURI;
    if (this.status === "playing") {
      const t = this.computeCurrentSeconds();
      this.cancelUtterance();
      this.seekToTime(t);
      this.startSpeaking();
    } else {
      this.emit();
    }
  }

  setPitch(pitch: number) {
    this.pitch = pitch;
  }

  play() {
    if (!SpeechEngine.isAvailable() || this.flat.length === 0) return;
    if (this.status === "playing") return;
    this.startSpeaking();
  }

  pause() {
    if (this.status !== "playing") return;
    const t = this.computeCurrentSeconds();
    this.cancelUtterance();
    this.status = "paused";
    this.stopTick();
    this.stopKeepAlive();
    this.seekToTime(t);
    this.emit();
  }

  toggle() {
    if (this.status === "playing") this.pause();
    else this.play();
  }

  rewind(seconds: number) {
    const t = Math.max(0, this.computeCurrentSeconds() - seconds);
    this.seekToTime(t);
    if (this.status === "playing") this.startSpeaking();
    else this.emit();
  }

  forward(seconds: number) {
    const t = this.computeCurrentSeconds() + seconds;
    this.seekToTime(t);
    if (this.status === "playing") this.startSpeaking();
    else this.emit();
  }

  seekToTime(seconds: number) {
    if (this.flat.length === 0) return;
    this.currentIndex = findChunkIndexForTime(
      this.flat,
      seconds,
      this.cast.totalDurationSeconds,
    );
    if (this.status === "playing") {
      this.cancelUtterance();
      this.startSpeaking();
    } else {
      this.emit();
    }
  }

  seekToSection(sectionId: string) {
    const idx = this.flat.findIndex((e) => e.section.id === sectionId);
    if (idx === -1) return;
    this.currentIndex = idx;
    if (this.status === "playing") {
      this.cancelUtterance();
      this.startSpeaking();
    } else {
      this.emit();
    }
  }

  seekToChunk(sectionId: string, chunkIndex: number) {
    const idx = this.flat.findIndex(
      (e) => e.section.id === sectionId && e.chunk.index === chunkIndex,
    );
    if (idx === -1) return;
    this.currentIndex = idx;
    if (this.status === "playing") {
      this.cancelUtterance();
      this.startSpeaking();
    } else {
      this.emit();
    }
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
      this.seekToTime(state.estimatedCurrentSeconds);
    }
  }

  destroy() {
    this.destroyed = true;
    this.cancelUtterance();
    this.stopTick();
    this.listeners.clear();
  }

  private startSpeaking() {
    if (!SpeechEngine.isAvailable() || this.destroyed) return;
    const entry = this.currentEntry;
    if (!entry) {
      this.status = "ended";
      this.emit();
      return;
    }
    this.cancelUtterance();
    const utterance = new SpeechSynthesisUtterance(entry.chunk.text);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    if (this.voiceURI) {
      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => v.voiceURI === this.voiceURI);
      if (voice) utterance.voice = voice;
    }

    utterance.onend = () => {
      if (this.destroyed) return;
      if (this.currentUtterance !== utterance) return;
      this.advance();
    };
    utterance.onerror = (e) => {
      if (this.destroyed) return;
      if (e.error === "interrupted" || e.error === "canceled") return;
      this.advance();
    };

    this.currentUtterance = utterance;
    this.chunkStartedAt = Date.now();
    this.status = "playing";
    window.speechSynthesis.speak(utterance);
    this.startTick();
    this.startKeepAlive();
    this.emit();
  }

  private advance() {
    if (this.currentIndex >= this.flat.length - 1) {
      this.currentIndex = this.flat.length - 1;
      this.status = "ended";
      this.stopTick();
      this.stopKeepAlive();
      this.emit();
      return;
    }
    this.currentIndex += 1;
    this.startSpeaking();
  }

  private cancelUtterance() {
    if (!SpeechEngine.isAvailable()) return;
    this.currentUtterance = null;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  private startTick() {
    this.stopTick();
    this.tickHandle = setInterval(() => this.emit(), 500);
  }

  private stopTick() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  /**
   * Chrome workaround: SpeechSynthesis sometimes stalls after ~14 seconds.
   * Pause+resume keeps it alive on long utterances.
   */
  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveHandle = setInterval(() => {
      if (!SpeechEngine.isAvailable()) return;
      if (this.status !== "playing") return;
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }
    }, 10000);
  }

  private stopKeepAlive() {
    if (this.keepAliveHandle) {
      clearInterval(this.keepAliveHandle);
      this.keepAliveHandle = null;
    }
  }
}
