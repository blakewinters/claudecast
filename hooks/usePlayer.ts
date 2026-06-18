"use client";

import { useEffect, useRef, useState } from "react";
import { SpeechEngine, type EngineState } from "@/lib/speech";
import { getPlayback, savePlayback } from "@/lib/db";
import type { Cast, Settings } from "@/lib/types";

interface UsePlayerOpts {
  cast: Cast | undefined;
  settings: Settings;
}

export function usePlayer({ cast, settings }: UsePlayerOpts) {
  const engineRef = useRef<SpeechEngine | null>(null);
  const [state, setState] = useState<EngineState>({
    status: "idle",
    currentSectionId: null,
    currentChunkIndex: 0,
    estimatedCurrentSeconds: 0,
    totalDurationSeconds: 0,
    rate: settings.rate,
    voiceURI: settings.voiceURI,
  });
  const [available] = useState(() => SpeechEngine.isAvailable());

  useEffect(() => {
    if (!cast) return;
    const engine = new SpeechEngine(cast, {
      rate: settings.rate,
      pitch: settings.pitch,
      voiceURI: settings.voiceURI,
    });
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
  }, [cast?.id]);

  // Push setting changes into engine on the fly.
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setRate(settings.rate);
  }, [settings.rate]);
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPitch(settings.pitch);
  }, [settings.pitch]);
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setVoice(settings.voiceURI);
  }, [settings.voiceURI]);

  // Persist position periodically and on key transitions.
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
        selectedVoiceURI: state.voiceURI,
        updatedAt: Date.now(),
      });
    }, 4000);
    return () => clearInterval(handle);
  }, [cast, state.currentSectionId, state.currentChunkIndex, state.rate, state.voiceURI, state.estimatedCurrentSeconds]);

  // Save on pause / page hide.
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
        selectedVoiceURI: snap.voiceURI,
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
    available,
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
