"use client";

import { useEffect, useRef } from "react";
import type { Section } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  sections: Section[];
  currentSectionId: string | null;
  currentChunkIndex: number;
  onChunkClick?: (sectionId: string, chunkIndex: number) => void;
}

export function TranscriptView({
  sections,
  currentSectionId,
  currentChunkIndex,
  onChunkClick,
}: Props) {
  const activeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!activeRef.current) return;
    activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentSectionId, currentChunkIndex]);

  return (
    <div className="space-y-6">
      {sections.map((sec) => {
        const isCurrentSection = sec.id === currentSectionId;
        return (
          <section key={sec.id}>
            <h3
              className={cn(
                "text-sm font-semibold uppercase tracking-wide mb-2",
                isCurrentSection ? "text-accent" : "text-ink-muted",
              )}
            >
              {sec.title}
            </h3>
            <p className="text-ink leading-relaxed whitespace-pre-wrap">
              {sec.chunks.map((chunk) => {
                const active =
                  isCurrentSection && chunk.index === currentChunkIndex;
                return (
                  <span
                    key={chunk.index}
                    ref={active ? activeRef : undefined}
                    onClick={() => onChunkClick?.(sec.id, chunk.index)}
                    className={cn(
                      "cursor-pointer rounded transition-colors",
                      active && "bg-accent/20 text-ink",
                    )}
                  >
                    {chunk.text}
                  </span>
                );
              })}
            </p>
          </section>
        );
      })}
    </div>
  );
}
