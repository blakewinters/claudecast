"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/utils";

interface Props {
  currentSeconds: number;
  totalSeconds: number;
  onSeek: (seconds: number) => void;
}

export function ProgressBar({ currentSeconds, totalSeconds, onSeek }: Props) {
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const displayed = dragging ? dragValue : currentSeconds;
  const pct = totalSeconds > 0 ? Math.min(100, (displayed / totalSeconds) * 100) : 0;

  const computeFromEvent = (clientX: number): number => {
    const el = trackRef.current;
    if (!el || totalSeconds <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    return (x / rect.width) * totalSeconds;
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      setDragValue(computeFromEvent(e.clientX));
    };
    const onUp = (e: PointerEvent) => {
      const v = computeFromEvent(e.clientX);
      setDragging(false);
      onSeek(v);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, totalSeconds]);

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        className="relative h-8 flex items-center cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          const v = computeFromEvent(e.clientX);
          setDragValue(v);
          setDragging(true);
        }}
      >
        <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="absolute h-4 w-4 rounded-full bg-ink shadow-lg"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-muted tabular-nums">
        <span>{formatTime(displayed)}</span>
        <span>{formatTime(totalSeconds)}</span>
      </div>
    </div>
  );
}
