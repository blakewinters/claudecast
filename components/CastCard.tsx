"use client";

import Link from "next/link";
import { FileText, Mic2 } from "lucide-react";
import type { Cast, PlaybackState } from "@/lib/types";
import { formatTime } from "@/lib/utils";

interface Props {
  cast: Cast;
  playback?: PlaybackState;
}

const SOURCE_LABELS: Record<Cast["sourceType"], string> = {
  google_doc: "Google Doc",
  paste: "Pasted text",
  markdown: "Markdown",
  json: "JSON",
};

export function CastCard({ cast, playback }: Props) {
  const progress =
    cast.totalDurationSeconds > 0 && playback
      ? Math.min(
          100,
          (playback.estimatedCurrentSeconds / cast.totalDurationSeconds) * 100,
        )
      : 0;

  return (
    <Link
      href={`/player/${cast.id}`}
      className="block rounded-xl bg-bg-card border border-line p-4 hover:bg-bg-elevated transition-colors active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
          {cast.sourceType === "google_doc" ? (
            <FileText className="h-6 w-6" />
          ) : (
            <Mic2 className="h-6 w-6" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-ink truncate">{cast.title}</div>
          {cast.topic && (
            <div className="text-sm text-ink-muted truncate">{cast.topic}</div>
          )}
          <div className="mt-1 text-xs text-ink-dim flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{SOURCE_LABELS[cast.sourceType]}</span>
            <span>{formatTime(cast.totalDurationSeconds)}</span>
            <span>{cast.sections.length} sections</span>
            {playback && playback.estimatedCurrentSeconds > 1 && (
              <span className="text-accent">
                {Math.round(progress)}% — {formatTime(playback.estimatedCurrentSeconds)}
              </span>
            )}
          </div>
        </div>
      </div>
      {playback && progress > 0 && (
        <div className="mt-3 h-1 rounded-full bg-bg-elevated overflow-hidden">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </Link>
  );
}
