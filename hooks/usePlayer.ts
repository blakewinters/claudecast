"use client";

import { useEffect, useRef, useState } from "react";
import { AudioEngine, type EngineState } from "@/lib/audio-engine";
import { SpeechEngine } from "@/lib/speech";
import { getPlayback, savePlayback } from "@/lib/db";
import type { Cast, Settings } from "@/lib/types";

interface UsePlayerOpts {
  cast: Cast | undefined;
  settings: Settings;
}

interface EngineLike {
  subscribe(listener: (s: EngineState) => void): () => void;
  play(): void;
  pause(): void;
  toggle(): void;
  rewind(seconds: number): void;
  forward(seconds: number): void;
  seekToTime(seconds: number): void | Promise<void>;
  seekToSection(id: string): void | Promise<void>;
  seekToChunk(sectionId: string, idx: number): void | Promise<void>;
  setRate(r: number): void;
  setVoice(v: string): void;
  setPitch?(p: number): void;
  restoreState(state: {
    currentSectionId?: string | null;
    currentChunkIndex?: number;
    estimatedCurrentSeconds?: number;
  }): void;
  destroy(): void;
  snapshot(): EngineState;
}

function adaptSpeech(engine: SpeechEngine): EngineLike {
  return {
    subscribe: (l) => engine.subscribe(l as (s: EngineState) => void),
    play: () => engine.play(),
    pause: () => engine.pause(),
    toggle: () => engine.toggle(),
    rewind: (s) => engine.rewind(s),
    forward: (s) => engine.forward(s),
    seekToTime: (s) => engine.seekToTime(s),
    seekToSection: (id) => engine.seekToSection(id),
    seekToChunk: (sid, idx) => engine.seekToChunk(sid, idx),
    setRate: (r) => engine.setRate(r),
    setPitch: (p) => engine.setPitch(p),
    setVoice: (v) => engine.setVoice(v),
    restoreState: (s) => engine.restoreState(s),
    destroy: () => engine.destroy(),
    snapshot: () => engine.snapshot() as EngineState,
  };
}

export function usePlayer({ cast, settings }: UsePlayerOpts) {
  const engineRef = useRef<EngineLike | null>(null);
  const [state, setState] = useState<EngineState>({
    status: "idle",
    currentSectionId: null,
    currentChunkIndex: 0,
    estimatedCurrentSeconds: 0,
    totalDurationSeconds: cast?.totalDurationSeconds ?? 0,
    rate: settings.rate,
    voice: settings.ttsVoice,
  });

  useEffect(() => {
    if (!cast) return;
    let engine: EngineLike;
    if (settings.ttsProvider === "google") {
      engine = new AudioEngine(cast, {
        rate: settings.rate,
        voice: settings.ttsVoice,
      });
    } else {
      engine = adaptSpeech(
        new SpeechEngine(cast, {
          rate: settings.rate,
          pitch: settings.pitch,
          voiceURI: settings.voiceURI,
        }),
      );
    }
    engineRef.current = engine;
    const unsub = engine.subscribe(setState);

    getPlayback(cast.id).then((saved) => {
      if (saved) {
        engine.restoreState({
          currentSectionId: saved.currentSectionId,
          currentChunkIndex: saved.currentChunkIndex,
          estimatedCurrentSeconds: saved.estimatedCurrentSeconds,
        });
      }
    });

    return () => {
      unsub();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cast?.id, settings.ttsProvider]);

  useEffect(() => {
    engineRef.current?.setRate(settings.rate);
  }, [settings.rate]);

  useEffect(() => {
    engineRef.current?.setPitch?.(settings.pitch);
  }, [settings.pitch]);

  useEffect(() => {
    if (settings.ttsProvider === "google") {
      engineRef.current?.setVoice(settings.ttsVoice);
    } else if (settings.voiceURI) {
      engineRef.current?.setVoice(settings.voiceURI);
    }
  }, [settings.ttsProvider, settings.ttsVoice, settings.voiceURI]);

  // Persist position periodically.
  useEffect(() => {
    if (!cast || !state.currentSectionId) return;
    const handle = setInterval(() => {
      savePlayback({
        castId: cast.id,
        currentSectionId: state.currentSectionId ?? "",
        currentChunkIndex: state.currentChunkIndex,
        currentCharacterOffset: 0,
        estimatedCurrentSeconds: state.estimatedCurrentSeconds,
        playbackRate: state.rate,
        selectedVoiceURI: state.voice,
        updatedAt: Date.now(),
      });
    }, 4000);
    return () => clearInterval(handle);
  }, [
    cast,
    state.currentSectionId,
    state.currentChunkIndex,
    state.rate,
    state.voice,
    state.estimatedCurrentSeconds,
  ]);

  useEffect(() => {
    if (!cast) return;
    const persist = () => {
      const snap = engineRef.current?.snapshot();
      if (!snap || !snap.currentSectionId) return;
      savePlayback({
        castId: cast.id,
        currentSectionId: snap.currentSectionId,
        currentChunkIndex: snap.currentChunkIndex,
        currentCharacterOffset: 0,
        estimatedCurrentSeconds: snap.estimatedCurrentSeconds,
        playbackRate: snap.rate,
        selectedVoiceURI: snap.voice,
        updatedAt: Date.now(),
      });
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
      persist();
    };
  }, [cast]);

  return {
    state,
    available:
      settings.ttsProvider === "google" || SpeechEngine.isAvailable(),
    play: () => engineRef.current?.play(),
    pause: () => engineRef.current?.pause(),
    toggle: () => engineRef.current?.toggle(),
    rewind: (seconds: number) => engineRef.current?.rewind(seconds),
    forward: (seconds: number) => engineRef.current?.forward(seconds),
    seekToTime: (sec: number) => engineRef.current?.seekToTime(sec),
    seekToSection: (id: string) => engineRef.current?.seekToSection(id),
    seekToChunk: (sectionId: string, idx: number) =>
      engineRef.current?.seekToChunk(sectionId, idx),
  };
}
