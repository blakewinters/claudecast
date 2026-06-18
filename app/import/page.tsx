"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import {
  ImportPreview,
  type PreviewSection,
} from "@/components/ImportPreview";
import { DrivePicker } from "@/components/DrivePicker";
import {
  buildCast,
  parseMarkdown,
  parseText,
  estimateSeconds,
} from "@/lib/parser";
import { extractGoogleDocId } from "@/lib/google-doc";
import { saveCast } from "@/lib/db";
import { useSettings } from "@/hooks/useSettings";
import type { ParsedDoc, SourceType } from "@/lib/types";

type Mode = "drive" | "google" | "paste" | "markdown" | "json";

interface PreparedImport {
  parsed: ParsedDoc;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceDocumentId?: string;
}

export default function ImportPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const [mode, setMode] = useState<Mode>("drive");
  const [docUrl, setDocUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [topic, setTopic] = useState("");
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewSections, setPreviewSections] = useState<PreviewSection[]>([]);
  const [saving, setSaving] = useState(false);

  const importFromGoogle = async (input: {
    url?: string;
    documentId?: string;
    titleHint?: string;
  }) => {
    const res = await fetch("/api/import/google-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: input.url,
        documentId: input.documentId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data?.error?.message ||
          "Couldn't import that doc. Try setting sharing to 'Anyone with the link can view'.",
      );
    }
    const parsed: ParsedDoc = {
      title: data.title || input.titleHint || "Untitled Cast",
      sections: data.sections,
      rawText: data.rawText ?? "",
    };
    setPrepared({
      parsed,
      sourceType: "google_doc",
      sourceUrl: data.sourceUrl,
      sourceDocumentId: data.documentId,
    });
    setPreviewTitle(titleOverride.trim() || input.titleHint || parsed.title);
    setPreviewSections(
      parsed.sections.map((s: { title: string; text: string }) => ({
        title: s.title,
        text: s.text,
      })),
    );
  };

  const onPickDriveDoc = async (doc: { id: string; name: string }) => {
    setError(null);
    setLoading(true);
    try {
      await importFromGoogle({ documentId: doc.id, titleHint: doc.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const submitImport = async () => {
    setError(null);
    setLoading(true);
    try {
      let parsed: ParsedDoc;
      let sourceType: SourceType = "paste";
      let sourceUrl: string | undefined;
      let sourceDocumentId: string | undefined;

      if (mode === "google") {
        const id = extractGoogleDocId(docUrl);
        if (!id) {
          setError("That doesn't look like a Google Doc URL.");
          setLoading(false);
          return;
        }
        await importFromGoogle({ url: docUrl });
        return;
      } else if (mode === "paste") {
        if (!pasted.trim()) {
          setError("Paste some text first.");
          setLoading(false);
          return;
        }
        parsed = parseText(pasted);
        sourceType = "paste";
      } else if (mode === "markdown") {
        if (!pasted.trim()) {
          setError("Paste some Markdown first.");
          setLoading(false);
          return;
        }
        parsed = parseMarkdown(pasted);
        sourceType = "markdown";
      } else {
        try {
          const j = JSON.parse(pasted);
          parsed = normalizeJsonImport(j);
        } catch (e) {
          setError(
            "Couldn't parse that JSON. Expected { title, sections: [{ title, text }] }.",
          );
          setLoading(false);
          return;
        }
        sourceType = "json";
      }

      if (parsed.sections.length === 0) {
        setError("No content found.");
        setLoading(false);
        return;
      }

      setPrepared({ parsed, sourceType, sourceUrl, sourceDocumentId });
      setPreviewTitle(titleOverride.trim() || parsed.title);
      setPreviewSections(
        parsed.sections.map((s) => ({ title: s.title, text: s.text })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const doSave = async () => {
    if (!prepared) return;
    setSaving(true);
    try {
      const cast = buildCast(
        { ...prepared.parsed, title: previewTitle, sections: previewSections },
        {
          wpm: settings.wpm,
          title: previewTitle,
          topic: topic.trim() || undefined,
          sourcePrompt: sourcePrompt.trim() || undefined,
          sourceType: prepared.sourceType,
          sourceUrl: prepared.sourceUrl,
          sourceDocumentId: prepared.sourceDocumentId,
        },
      );
      await saveCast(cast);
      router.push(`/player/${cast.id}`);
    } finally {
      setSaving(false);
    }
  };

  const estimatedDuration = previewSections.reduce(
    (a, s) => a + estimateSeconds(s.text, settings.wpm),
    0,
  );

  return (
    <>
      <TopBar title="Import" back />
      <main className="p-4 space-y-4">
        {prepared ? (
          <ImportPreview
            title={previewTitle}
            topic={topic}
            sections={previewSections}
            estimatedDuration={estimatedDuration}
            onTitleChange={setPreviewTitle}
            onTopicChange={setTopic}
            onSectionsChange={setPreviewSections}
            onSave={doSave}
            onCancel={() => setPrepared(null)}
            saving={saving}
          />
        ) : (
          <>
            <ModeTabs mode={mode} onChange={setMode} />
            {mode === "drive" ? (
              <Card>
                <h3 className="text-sm font-medium text-ink mb-3">
                  Your Google Docs
                </h3>
                <DrivePicker onPick={onPickDriveDoc} />
                {loading && (
                  <div className="mt-3 text-xs text-accent">Importing…</div>
                )}
              </Card>
            ) : (
            <Card>
              {mode === "google" && (
                <>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Google Doc URL
                  </label>
                  <Input
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="https://docs.google.com/document/d/…"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    inputMode="url"
                  />
                  <p className="mt-2 text-xs text-ink-dim">
                    The doc must be shared as “Anyone with the link can view”
                    (or published to web).
                  </p>
                </>
              )}
              {mode === "paste" && (
                <>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Paste Claude response
                  </label>
                  <Textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder="Paste the script here…"
                    className="min-h-[200px]"
                  />
                </>
              )}
              {mode === "markdown" && (
                <>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Paste Markdown
                  </label>
                  <Textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder={`# Cast title\n\n## Section 1\nText…`}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </>
              )}
              {mode === "json" && (
                <>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Paste JSON
                  </label>
                  <Textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder={`{"title":"…","sections":[{"title":"…","text":"…"}]}`}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </>
              )}
            </Card>
            )}

            <Card>
              <h3 className="text-sm font-medium text-ink mb-2">
                Optional details
              </h3>
              <label className="block text-xs text-ink-muted mb-1">
                Override title
              </label>
              <Input
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                placeholder="Leave blank to auto-detect"
              />
              <label className="block text-xs text-ink-muted mt-3 mb-1">
                Topic
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. real estate, AI"
              />
              <label className="block text-xs text-ink-muted mt-3 mb-1">
                Source prompt (optional)
              </label>
              <Textarea
                value={sourcePrompt}
                onChange={(e) => setSourcePrompt(e.target.value)}
                placeholder="What did you ask Claude?"
                className="min-h-[60px] text-sm"
              />
            </Card>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3">
                {error}
              </div>
            )}

            {mode !== "drive" && (
              <Button
                size="lg"
                className="w-full"
                onClick={submitImport}
                disabled={loading}
              >
                {loading ? "Importing…" : "Preview sections"}
              </Button>
            )}
          </>
        )}
      </main>
    </>
  );
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: { id: Mode; label: string }[] = [
    { id: "drive", label: "Drive" },
    { id: "google", label: "URL" },
    { id: "paste", label: "Paste" },
    { id: "markdown", label: "Markdown" },
    { id: "json", label: "JSON" },
  ];
  return (
    <div className="flex gap-1 rounded-lg bg-bg-card border border-line p-1 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            "flex-1 px-3 h-9 rounded-md text-sm whitespace-nowrap " +
            (t.id === mode
              ? "bg-accent text-bg font-semibold"
              : "text-ink-muted hover:text-ink")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function normalizeJsonImport(j: unknown): ParsedDoc {
  if (!j || typeof j !== "object") throw new Error("Expected object");
  const obj = j as Record<string, unknown>;
  const title =
    (typeof obj.title === "string" && obj.title) || "Untitled Cast";
  if (!Array.isArray(obj.sections)) {
    throw new Error("Expected 'sections' array");
  }
  const sections = obj.sections.map((s: unknown, i: number) => {
    if (!s || typeof s !== "object") {
      throw new Error(`Section ${i + 1} is not an object`);
    }
    const so = s as Record<string, unknown>;
    return {
      title:
        (typeof so.title === "string" && so.title) || `Section ${i + 1}`,
      text: typeof so.text === "string" ? so.text : "",
    };
  });
  return {
    title,
    sections,
    rawText: sections.map((s) => `${s.title}\n\n${s.text}`).join("\n\n"),
  };
}
