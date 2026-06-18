"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const RATES = [0.75, 1, 1.1, 1.15, 1.25, 1.5, 2];

interface Props {
  rate: number;
  onChange: (r: number) => void;
}

export function SpeedSelector({ rate, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 min-w-[3rem] px-2 rounded-md bg-bg-elevated border border-line text-sm font-medium text-ink tabular-nums"
        aria-label="Playback speed"
      >
        {rate}x
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 bottom-full mb-2 z-20 rounded-lg bg-bg-card border border-line overflow-hidden shadow-lg">
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                }}
                className={cn(
                  "block w-20 px-3 py-2 text-sm text-left tabular-nums",
                  r === rate
                    ? "bg-accent/15 text-accent"
                    : "text-ink hover:bg-bg-elevated",
                )}
              >
                {r}x
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
