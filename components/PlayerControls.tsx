"use client";

import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  playing: boolean;
  onToggle: () => void;
  onRewind: () => void;
  onForward: () => void;
  rewindSeconds: number;
  forwardSeconds: number;
}

export function PlayerControls({
  playing,
  onToggle,
  onRewind,
  onForward,
  rewindSeconds,
  forwardSeconds,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        onClick={onRewind}
        aria-label={`Rewind ${rewindSeconds} seconds`}
        className="relative h-12 w-12 flex items-center justify-center text-ink hover:text-accent touch-manipulation"
      >
        <RotateCcw className="h-9 w-9" />
        <span className="absolute text-[10px] font-semibold">{rewindSeconds}</span>
      </button>
      <Button
        size="icon-lg"
        variant="primary"
        onClick={onToggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-0.5" />}
      </Button>
      <button
        onClick={onForward}
        aria-label={`Forward ${forwardSeconds} seconds`}
        className="relative h-12 w-12 flex items-center justify-center text-ink hover:text-accent touch-manipulation"
      >
        <RotateCw className="h-9 w-9" />
        <span className="absolute text-[10px] font-semibold">{forwardSeconds}</span>
      </button>
    </div>
  );
}
