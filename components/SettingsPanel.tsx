"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import type { Settings } from "@/lib/types";
import { SpeechEngine } from "@/lib/speech";
import { DEFAULT_GOOGLE_VOICES } from "@/lib/tts/types";
import { cn } from "@/lib/utils";

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const refresh = () => setVoices(SpeechEngine.listVoices());
    refresh();
    return SpeechEngine.onVoicesChanged(refresh);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold mb-3">Voice quality</h2>
        <div className="flex gap-2 mb-3">
          <ProviderTile
            label="Google Neural"
            sub="Natural, conversational"
            active={settings.ttsProvider === "google"}
            onClick={() => onChange({ ttsProvider: "google" })}
          />
          <ProviderTile
            label="Browser TTS"
            sub="Robotic but offline"
            active={settings.ttsProvider === "browser"}
            onClick={() => onChange({ ttsProvider: "browser" })}
          />
        </div>

        {settings.ttsProvider === "google" ? (
          <>
            <label className="block text-xs text-ink-muted mb-1">Voice</label>
            <select
              value={settings.ttsVoice}
              onChange={(e) => onChange({ ttsVoice: e.target.value })}
              className="h-11 w-full rounded-lg bg-bg-elevated border border-line px-3 text-ink"
            >
              {DEFAULT_GOOGLE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-ink-dim">
              Audio is cached per voice, so swapping costs nothing on replay.
            </p>
          </>
        ) : (
          <>
            <label className="block text-xs text-ink-muted mb-1">
              Browser voice
            </label>
            <select
              value={settings.voiceURI ?? ""}
              onChange={(e) =>
                onChange({ voiceURI: e.target.value || undefined })
              }
              className="h-11 w-full rounded-lg bg-bg-elevated border border-line px-3 text-ink"
            >
              <option value="">System default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            {voices.length === 0 && (
              <p className="mt-2 text-xs text-ink-dim">
                No voices detected yet — they load asynchronously.
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Playback</h2>
        <RangeRow
          label="Rate"
          value={settings.rate}
          min={0.5}
          max={2}
          step={0.05}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(rate) => onChange({ rate })}
        />
        <RangeRow
          label="Pitch"
          value={settings.pitch}
          min={0.5}
          max={2}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(pitch) => onChange({ pitch })}
        />
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Estimation</h2>
        <label className="block text-xs text-ink-muted mb-1">
          Words per minute (used to estimate duration)
        </label>
        <Input
          type="number"
          min={80}
          max={300}
          value={settings.wpm}
          onChange={(e) =>
            onChange({ wpm: Math.max(80, Math.min(300, Number(e.target.value) || 160)) })
          }
        />
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Skip buttons</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink-muted mb-1">
              Rewind seconds
            </label>
            <Input
              type="number"
              min={5}
              max={120}
              value={settings.rewindSeconds}
              onChange={(e) =>
                onChange({
                  rewindSeconds: Math.max(5, Math.min(120, Number(e.target.value) || 15)),
                })
              }
            />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">
              Forward seconds
            </label>
            <Input
              type="number"
              min={5}
              max={120}
              value={settings.forwardSeconds}
              onChange={(e) =>
                onChange({
                  forwardSeconds: Math.max(5, Math.min(120, Number(e.target.value) || 30)),
                })
              }
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function ProviderTile({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg border p-3 text-left",
        active
          ? "bg-accent/15 border-accent text-ink"
          : "bg-bg-elevated border-line text-ink-muted hover:text-ink",
      )}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs opacity-75">{sub}</div>
    </button>
  );
}

interface RangeRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}

function RangeRow({ label, value, min, max, step, format, onChange }: RangeRowProps) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs text-ink-muted mb-1">
        <span>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

export function BackupControls({
  onExport,
  onImport,
}: {
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <h2 className="font-semibold mb-1">Backup</h2>
      <p className="text-xs text-ink-muted mb-3">
        Export everything as JSON, or re-import a previous backup.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.currentTarget.value = "";
        }}
      />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onExport} className="flex-1">
          Export JSON
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
        >
          Import JSON
        </Button>
      </div>
    </Card>
  );
}
