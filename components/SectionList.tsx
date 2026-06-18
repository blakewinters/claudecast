"use client";

import type { Section } from "@/lib/types";
import { formatTime, cn } from "@/lib/utils";

interface Props {
  sections: Section[];
  currentSectionId: string | null;
  onJump: (sectionId: string) => void;
}

export function SectionList({ sections, currentSectionId, onJump }: Props) {
  return (
    <ul className="divide-y divide-line rounded-xl bg-bg-card border border-line overflow-hidden">
      {sections.map((s, i) => {
        const active = s.id === currentSectionId;
        return (
          <li key={s.id}>
            <button
              onClick={() => onJump(s.id)}
              className={cn(
                "w-full text-left px-4 py-3 flex items-center gap-3",
                "hover:bg-bg-elevated touch-manipulation",
                active && "bg-bg-elevated",
              )}
            >
              <span
                className={cn(
                  "h-6 w-6 shrink-0 rounded-full text-xs flex items-center justify-center",
                  active
                    ? "bg-accent text-bg font-semibold"
                    : "bg-bg-elevated text-ink-muted",
                )}
              >
                {i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className={cn(
                    "block truncate text-sm",
                    active ? "text-accent font-medium" : "text-ink",
                  )}
                >
                  {s.title}
                </span>
                <span className="block text-xs text-ink-dim tabular-nums">
                  {formatTime(s.estimatedStartSeconds)} ·{" "}
                  {formatTime(s.estimatedDurationSeconds)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
