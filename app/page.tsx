"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { CastCard } from "@/components/CastCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCasts, usePlaybackStates } from "@/hooks/useCasts";

export default function LibraryPage() {
  const casts = useCasts();
  const playbackMap = usePlaybackStates();
  const [query, setQuery] = useState("");

  const continueCast = useMemo(() => {
    if (!casts || !playbackMap) return undefined;
    const candidates = casts
      .map((c) => ({ cast: c, pb: playbackMap.get(c.id) }))
      .filter(
        (x) =>
          x.pb &&
          x.pb.estimatedCurrentSeconds > 1 &&
          x.pb.estimatedCurrentSeconds <
            x.cast.totalDurationSeconds - 5,
      )
      .sort((a, b) => (b.pb!.updatedAt ?? 0) - (a.pb!.updatedAt ?? 0));
    return candidates[0];
  }, [casts, playbackMap]);

  const filtered = useMemo(() => {
    if (!casts) return [];
    const q = query.trim().toLowerCase();
    if (!q) return casts;
    return casts.filter((c) =>
      [c.title, c.topic ?? "", c.sourceType]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [casts, query]);

  return (
    <>
      <TopBar />
      <main className="p-4 space-y-4">
        {continueCast && (
          <Link
            href={`/player/${continueCast.cast.id}`}
            className="block rounded-xl bg-accent/15 border border-accent/40 p-4 hover:bg-accent/20 transition-colors"
          >
            <div className="text-xs uppercase tracking-wide text-accent font-semibold">
              Continue listening
            </div>
            <div className="mt-1 font-medium text-ink truncate">
              {continueCast.cast.title}
            </div>
            <div className="text-xs text-ink-muted mt-0.5">
              {Math.round(
                (continueCast.pb!.estimatedCurrentSeconds /
                  continueCast.cast.totalDurationSeconds) *
                  100,
              )}
              % complete
            </div>
          </Link>
        )}

        <div className="flex gap-2">
          <Link href="/import" className="flex-1">
            <Button className="w-full" size="lg">
              <Plus className="h-5 w-5" /> Import
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-dim" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search casts"
            className="pl-9"
          />
        </div>

        {casts === undefined ? (
          <div className="text-ink-muted text-sm">Loading…</div>
        ) : casts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <CastCard
                key={c.id}
                cast={c}
                playback={playbackMap?.get(c.id)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-ink-muted text-sm">No matches.</div>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-center">
      <div className="font-medium text-ink">No casts yet</div>
      <p className="text-sm text-ink-muted mt-1">
        Ask Claude to write a podcast script into a Google Doc, then tap{" "}
        <span className="text-accent">Import</span>.
      </p>
    </div>
  );
}
