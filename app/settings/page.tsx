"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { BackupControls, SettingsPanel } from "@/components/SettingsPanel";
import { useSettings } from "@/hooks/useSettings";
import { exportBackup, importBackup } from "@/lib/db";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [message, setMessage] = useState<string | null>(null);

  const onExport = async () => {
    const bundle = await exportBackup();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claudecast-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Backup downloaded.");
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      await importBackup(bundle);
      setMessage("Backup imported.");
    } catch (e) {
      setMessage(
        "Couldn't import backup: " +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  };

  return (
    <>
      <TopBar title="Settings" back />
      <main className="p-4 space-y-4">
        <SettingsPanel settings={settings} onChange={update} />
        <BackupControls onExport={onExport} onImport={onImport} />
        {message && (
          <div className="text-xs text-ink-muted text-center">{message}</div>
        )}
        <div className="rounded-lg border border-line p-3 text-xs text-ink-dim">
          <p className="font-semibold text-ink mb-1">Known limitations</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Browser SpeechSynthesis isn&apos;t true audio playback — seeking restarts speech at the closest chunk.</li>
            <li>Voice availability varies by device.</li>
            <li>Background and lock-screen playback may be limited on mobile.</li>
            <li>Private Google Docs need OAuth (not in this MVP).</li>
          </ul>
        </div>
      </main>
    </>
  );
}
