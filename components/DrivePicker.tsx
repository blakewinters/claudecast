"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, Search } from "lucide-react";
import { Input } from "./ui/Input";
import type { DriveDoc } from "@/lib/google-drive";

interface Props {
  onPick: (doc: DriveDoc) => void;
}

export function DrivePicker({ onPick }: Props) {
  const [docs, setDocs] = useState<DriveDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/drive/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Couldn't list Drive files.");
        return;
      }
      setDocs(data.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!docs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => d.name.toLowerCase().includes(q));
  }, [docs, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-dim" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your Docs"
            className="pl-9"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
        <button
          onClick={load}
          aria-label="Refresh"
          className="h-11 w-11 rounded-lg bg-bg-elevated border border-line text-ink hover:text-accent flex items-center justify-center"
          disabled={loading}
        >
          <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3">
          {error}
        </div>
      )}

      {docs === null && !error ? (
        <div className="text-sm text-ink-muted">Loading your Docs…</div>
      ) : filtered.length === 0 && !loading ? (
        <div className="text-sm text-ink-muted">
          {query ? "No matches." : "No Google Docs found in your Drive."}
        </div>
      ) : (
        <ul className="rounded-xl bg-bg-card border border-line divide-y divide-line overflow-hidden">
          {filtered.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => onPick(d)}
                className="w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-bg-elevated touch-manipulation"
              >
                <FileText className="h-5 w-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm text-ink">{d.name}</div>
                  <div className="text-xs text-ink-dim">
                    {formatDate(d.modifiedTime)}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    const day = 86_400_000;
    if (diff < day) {
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (diff < 7 * day) {
      return d.toLocaleDateString(undefined, { weekday: "short" });
    }
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
  } catch {
    return iso;
  }
}
