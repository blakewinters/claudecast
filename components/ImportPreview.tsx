"use client";

import { useState } from "react";
import { Input, Textarea } from "./ui/Input";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Trash2, GripVertical } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

export interface PreviewSection {
  title: string;
  text: string;
}

export interface ImportPreviewProps {
  title: string;
  topic?: string;
  sections: PreviewSection[];
  estimatedDuration: number;
  onTitleChange: (title: string) => void;
  onTopicChange: (topic: string) => void;
  onSectionsChange: (sections: PreviewSection[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function ImportPreview({
  title,
  topic,
  sections,
  estimatedDuration,
  onTitleChange,
  onTopicChange,
  onSectionsChange,
  onSave,
  onCancel,
  saving,
}: ImportPreviewProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const updateSection = (i: number, patch: Partial<PreviewSection>) => {
    const next = sections.slice();
    next[i] = { ...next[i], ...patch };
    onSectionsChange(next);
  };

  const removeSection = (i: number) => {
    onSectionsChange(sections.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-4">
      <Card>
        <label className="block text-xs font-medium text-ink-muted mb-1">
          Title
        </label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Cast title"
        />
        <label className="block text-xs font-medium text-ink-muted mt-3 mb-1">
          Topic (optional)
        </label>
        <Input
          value={topic ?? ""}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder="What's this cast about?"
        />
        <div className="mt-3 text-xs text-ink-dim">
          {sections.length} sections · ~{formatTime(estimatedDuration)}
        </div>
      </Card>

      <div className="space-y-2">
        {sections.map((s, i) => (
          <div
            key={i}
            className="rounded-xl bg-bg-card border border-line overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3">
              <GripVertical className="h-4 w-4 text-ink-dim shrink-0" />
              <span className="h-6 w-6 shrink-0 rounded-full bg-bg-elevated text-ink-muted text-xs flex items-center justify-center">
                {i + 1}
              </span>
              <Input
                value={s.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
                placeholder="Section title"
                className="h-9 text-sm"
              />
              <button
                onClick={() => toggleExpand(i)}
                className="text-xs text-ink-muted hover:text-ink px-2"
              >
                {expanded.has(i) ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => removeSection(i)}
                aria-label="Remove section"
                className="text-ink-muted hover:text-red-400 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {expanded.has(i) && (
              <div className="px-3 pb-3">
                <Textarea
                  value={s.text}
                  onChange={(e) => updateSection(i, { text: e.target.value })}
                  className="text-sm"
                />
              </div>
            )}
            {!expanded.has(i) && s.text && (
              <div
                onClick={() => toggleExpand(i)}
                className={cn(
                  "px-3 pb-3 text-xs text-ink-muted line-clamp-2 cursor-pointer",
                )}
              >
                {s.text}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-line flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={onSave}
          disabled={saving || sections.length === 0 || !title.trim()}
        >
          {saving ? "Saving…" : "Save cast"}
        </Button>
      </div>
    </div>
  );
}
