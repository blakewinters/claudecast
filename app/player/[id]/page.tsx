"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  MoreVertical,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ProgressBar } from "@/components/ProgressBar";
import { PlayerControls } from "@/components/PlayerControls";
import { SectionList } from "@/components/SectionList";
import { TranscriptView } from "@/components/TranscriptView";
import { SpeedSelector } from "@/components/SpeedSelector";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCast } from "@/hooks/useCasts";
import { useSettings } from "@/hooks/useSettings";
import { usePlayer } from "@/hooks/usePlayer";
import { deleteCast, saveCast } from "@/lib/db";
import { buildCast } from "@/lib/parser";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PlayerPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const cast = useCast(id);
  const { settings, update: updateSettings } = useSettings();
  const player = usePlayer({ cast, settings });
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cast) {
    return (
      <>
        <TopBar back />
        <main className="p-4 text-ink-muted">Loading…</main>
      </>
    );
  }

  const playing = player.state.status === "playing";

  const onSetRate = (rate: number) => {
    updateSettings({ rate });
  };

  const onRefresh = async () => {
    if (!cast.sourceDocumentId && !cast.sourceUrl) {
      setError("This cast wasn't imported from a Google Doc.");
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/import/google-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cast.sourceUrl,
          documentId: cast.sourceDocumentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Refresh failed");
      const next = buildCast(
        {
          title: data.title,
          sections: data.sections,
          rawText: data.rawText ?? "",
        },
        {
          wpm: settings.wpm,
          title: cast.title,
          topic: cast.topic,
          sourcePrompt: cast.sourcePrompt,
          sourceType: "google_doc",
          sourceUrl: data.sourceUrl,
          sourceDocumentId: data.documentId,
        },
      );
      await saveCast({
        ...next,
        id: cast.id,
        createdAt: cast.createdAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
      setMenuOpen(false);
    }
  };

  const onDelete = async () => {
    if (!confirm(`Delete "${cast.title}"?`)) return;
    await deleteCast(cast.id);
    router.push("/");
  };

  return (
    <>
      <TopBar
        title={cast.title}
        back
        rightSlot={
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More"
              className="h-10 w-10 rounded-full hover:bg-bg-elevated flex items-center justify-center text-ink"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-lg bg-bg-card border border-line shadow-lg overflow-hidden">
                  {(cast.sourceUrl || cast.sourceDocumentId) && (
                    <button
                      onClick={onRefresh}
                      disabled={refreshing}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-bg-elevated text-left"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {refreshing ? "Refreshing…" : "Refresh from Google Doc"}
                    </button>
                  )}
                  {cast.sourceUrl && (
                    <a
                      href={cast.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-bg-elevated"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open source
                    </a>
                  )}
                  <button
                    onClick={onDelete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 text-left"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete cast
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />
      <main className="px-4 pt-4 pb-32 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{cast.title}</h1>
          {cast.topic && (
            <p className="text-sm text-ink-muted mt-1">{cast.topic}</p>
          )}
        </div>

        {!player.available && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm p-3">
            This browser doesn&apos;t support text-to-speech.
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3">
            {error}
          </div>
        )}

        <Card>
          <ProgressBar
            currentSeconds={player.state.estimatedCurrentSeconds}
            totalSeconds={player.state.totalDurationSeconds}
            onSeek={player.seekToTime}
          />
          <div className="mt-3">
            <PlayerControls
              playing={playing}
              onToggle={player.toggle}
              onRewind={() => player.rewind(settings.rewindSeconds)}
              onForward={() => player.forward(settings.forwardSeconds)}
              rewindSeconds={settings.rewindSeconds}
              forwardSeconds={settings.forwardSeconds}
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <span className="text-xs text-ink-dim">Speed</span>
            <SpeedSelector rate={settings.rate} onChange={onSetRate} />
          </div>
        </Card>

        <section>
          <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">
            Sections
          </h2>
          <SectionList
            sections={cast.sections}
            currentSectionId={player.state.currentSectionId}
            onJump={player.seekToSection}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">
            Transcript
          </h2>
          <TranscriptView
            sections={cast.sections}
            currentSectionId={player.state.currentSectionId}
            currentChunkIndex={player.state.currentChunkIndex}
            onChunkClick={player.seekToChunk}
          />
        </section>
      </main>

      <StickyPlayerBar
        title={cast.title}
        playing={playing}
        onToggle={player.toggle}
      />
    </>
  );
}

function StickyPlayerBar({
  title,
  playing,
  onToggle,
}: {
  title: string;
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-10 bg-bg/95 backdrop-blur border-t border-line">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-muted">Now playing</div>
          <div className="truncate text-sm font-medium">{title}</div>
        </div>
        <Button
          onClick={onToggle}
          size="icon"
          variant="primary"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <span className="block h-4 w-4 border-l-2 border-r-2 border-bg" />
          ) : (
            <span
              className="block h-0 w-0"
              style={{
                borderLeft: "10px solid currentColor",
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
                marginLeft: "2px",
              }}
            />
          )}
        </Button>
      </div>
    </div>
  );
}
