import type { Cast, Chunk, ParsedDoc, Section, SourceType } from "./types";
import { newId } from "./utils";

export const DEFAULT_WPM = 160;
export const DEFAULT_CHUNK_CHARS = 240;

export function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function estimateSeconds(text: string, wpm = DEFAULT_WPM): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return (words / wpm) * 60;
}

interface RawChunk {
  text: string;
  charStart: number;
  charEnd: number;
}

export function chunkText(text: string, maxChars = DEFAULT_CHUNK_CHARS): RawChunk[] {
  if (!text.trim()) return [];

  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return splitLongSpan(text, 0, maxChars);
  }

  const out: RawChunk[] = [];
  let current: RawChunk | null = null;

  const flush = () => {
    if (!current) return;
    if (current.text.trim()) out.push(current);
    current = null;
  };

  for (const s of sentences) {
    if (s.text.length > maxChars) {
      flush();
      const pieces = splitLongSpan(s.text, s.charStart, maxChars);
      for (const p of pieces) if (p.text.trim()) out.push(p);
      continue;
    }
    if (current && current.text.length + s.text.length > maxChars) {
      flush();
    }
    if (!current) {
      current = { ...s };
    } else {
      current.text += s.text;
      current.charEnd = s.charEnd;
    }
  }
  flush();
  return out;
}

// Walk text tracking paren/bracket/quote depth so `.!?` only ends a sentence
// when we're at depth 0. Keeps "e.g." and parentheticals like "(great!)" intact.
function splitSentences(text: string): RawChunk[] {
  const out: RawChunk[] = [];
  const depths = computeGroupingDepths(text);
  let start = 0;
  const push = (end: number) => {
    if (end <= start) return;
    const slice = text.slice(start, end);
    if (slice.trim()) {
      out.push({ text: slice, charStart: start, charEnd: end });
    }
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      push(i + 1);
      continue;
    }
    if ((c === "." || c === "!" || c === "?") && depths[i] === 0) {
      let j = i + 1;
      while (j < text.length && (text[j] === "." || text[j] === "!" || text[j] === "?")) j++;
      // Extend over a trailing closing quote/bracket like `.")` so it stays with the sentence.
      while (j < text.length && /["'”’)\]]/.test(text[j]) && depths[j] === 0) j++;
      const next = text[j];
      if (next === undefined || /\s/.test(next)) {
        // Include trailing spaces so the next sentence starts at its first non-space char.
        let k = j;
        while (k < text.length && text[k] === " ") k++;
        push(k);
        i = k - 1;
      }
    }
  }
  push(text.length);
  return out;
}

// Split an over-long span at the strongest available boundary before maxChars.
// Prefers sentence punctuation → clause punctuation → dash → comma → whitespace,
// and refuses to split when the candidate index sits inside an open group.
function splitLongSpan(text: string, baseOffset: number, maxChars: number): RawChunk[] {
  const out: RawChunk[] = [];
  let pos = 0;
  while (pos < text.length) {
    const remaining = text.length - pos;
    if (remaining <= maxChars) {
      out.push({
        text: text.slice(pos),
        charStart: baseOffset + pos,
        charEnd: baseOffset + text.length,
      });
      break;
    }
    const windowEnd = pos + maxChars;
    const splitAt = findSplitPoint(text, pos, windowEnd);
    out.push({
      text: text.slice(pos, splitAt),
      charStart: baseOffset + pos,
      charEnd: baseOffset + splitAt,
    });
    pos = splitAt;
  }
  return out;
}

function findSplitPoint(text: string, start: number, endLimit: number): number {
  const depths = computeGroupingDepths(text);
  const patterns: RegExp[] = [
    /[.!?]["'”’)\]]?\s+/g,
    /[;:]\s+/g,
    /[—–]\s*/g,
    /,\s+/g,
    /\s+/g,
  ];
  for (const pat of patterns) {
    let best = -1;
    pat.lastIndex = start;
    let m: RegExpExecArray | null;
    while ((m = pat.exec(text)) !== null) {
      if (m.index >= endLimit) break;
      const splitIdx = m.index + m[0].length;
      if (splitIdx > endLimit) break;
      if (splitIdx <= start) continue;
      if ((depths[m.index] ?? 0) !== 0) continue;
      best = splitIdx;
    }
    if (best > start) return best;
  }
  return endLimit;
}

// depths[i] = number of open (,[,{ groups at position i, computed before consuming text[i].
function computeGroupingDepths(text: string): number[] {
  const depths = new Array<number>(text.length + 1);
  let paren = 0;
  let bracket = 0;
  let curly = 0;
  for (let i = 0; i < text.length; i++) {
    depths[i] = paren + bracket + curly;
    const c = text[i];
    if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    else if (c === "[") bracket++;
    else if (c === "]") bracket = Math.max(0, bracket - 1);
    else if (c === "{") curly++;
    else if (c === "}") curly = Math.max(0, curly - 1);
  }
  depths[text.length] = paren + bracket + curly;
  return depths;
}

const NAMED_HEADING_RE =
  /^(intro(?:duction)?|recap|conclusion|summary|outro|wrap[-\s]?up|prologue|epilogue|background|context|takeaways?|key\s+points?|q\s*&\s*a)(?:\s*[:.\-–—]\s*(.*))?$/i;

export function detectHeading(line: string): string | null {
  const t = line.trim();
  if (!t || t.length > 160) return null;

  const md = t.match(/^(#{1,6})\s+(.+?)\s*#*$/);
  if (md) return md[2].trim();

  const labeled = t.match(
    /^(section|part|chapter|episode|act|step)\s+([\divxlcdm]+)\s*[:.\-–—]?\s*(.*)$/i,
  );
  if (labeled) {
    const extra = labeled[3].trim();
    return extra
      ? extra
      : `${capitalize(labeled[1])} ${labeled[2].toUpperCase()}`;
  }

  const named = t.match(NAMED_HEADING_RE);
  if (named) {
    const base = capitalize(named[1]);
    const extra = (named[2] ?? "").trim();
    return extra ? `${base}: ${extra}` : base;
  }

  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface RawSection {
  title: string;
  text: string;
}

function generateSectionTitle(text: string, index: number): string {
  const trimmed = text.trim();
  if (!trimmed) return `Section ${index + 1}`;
  const firstSentence = trimmed.split(/[.!?\n]/, 1)[0].trim();
  if (firstSentence && firstSentence.length <= 60) {
    return firstSentence;
  }
  const words = firstSentence.split(/\s+/).slice(0, 8).join(" ");
  return words ? `${words}…` : `Section ${index + 1}`;
}

function fallbackSectionsFromParagraphs(text: string): RawSection[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [];
  if (paragraphs.length <= 3) {
    return [{ title: "", text: paragraphs.join("\n\n") }];
  }
  const targetGroups = Math.min(6, Math.ceil(paragraphs.length / 3));
  const perGroup = Math.ceil(paragraphs.length / targetGroups);
  const out: RawSection[] = [];
  for (let i = 0; i < paragraphs.length; i += perGroup) {
    out.push({ title: "", text: paragraphs.slice(i, i + perGroup).join("\n\n") });
  }
  return out;
}

export function parseText(
  input: string,
  opts: { title?: string } = {},
): ParsedDoc {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return { title: opts.title ?? "Untitled Cast", sections: [], rawText: "" };
  }

  const lines = normalized.split("\n");

  let detectedTitle = opts.title;
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) {
      startIdx = i + 1;
      continue;
    }
    const md = t.match(/^#\s+(.+?)\s*#*$/);
    if (md) {
      // Skip a leading H1 — it's almost always the doc title, redundant if
      // opts.title is already set, or the title itself otherwise.
      if (!detectedTitle) detectedTitle = md[1].trim();
      startIdx = i + 1;
    } else if (
      !detectedTitle &&
      !detectHeading(t) &&
      t.length < 120 &&
      !/[.!?]$/.test(t) &&
      (lines[i + 1]?.trim() ?? "") === ""
    ) {
      detectedTitle = t;
      startIdx = i + 1;
    }
    break;
  }

  const sections: RawSection[] = [];
  let current: { title: string; lines: string[] } | null = null;

  const closeCurrent = () => {
    if (!current) return;
    const text = current.lines.join("\n").trim();
    if (text || current.title) {
      sections.push({ title: current.title, text });
    }
    current = null;
  };

  for (let i = startIdx; i < lines.length; i++) {
    const raw = lines[i];
    const heading = detectHeading(raw);
    if (heading !== null) {
      closeCurrent();
      current = { title: heading, lines: [] };
    } else {
      if (!current) current = { title: "", lines: [] };
      current.lines.push(raw);
    }
  }
  closeCurrent();

  let finalSections = sections.filter((s) => s.text.length > 0 || s.title);

  const onlyOneUntitled =
    finalSections.length === 1 && !finalSections[0].title;
  if (finalSections.length === 0 || onlyOneUntitled) {
    const source =
      finalSections.length === 1 ? finalSections[0].text : normalized;
    finalSections = fallbackSectionsFromParagraphs(source);
  }

  finalSections = finalSections.map((s, i) => ({
    title: s.title || generateSectionTitle(s.text, i),
    text: s.text,
  }));

  return {
    title: detectedTitle || finalSections[0]?.title || "Untitled Cast",
    sections: finalSections,
    rawText: normalized,
  };
}

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos|mdash|ndash|hellip|rsquo|lsquo|rdquo|ldquo);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
}

export function parseHtml(html: string, opts: { title?: string } = {}): ParsedDoc {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  let detectedTitle = opts.title;
  if (!detectedTitle) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      const t = stripTags(titleMatch[1]).trim();
      if (t) detectedTitle = t;
    }
  }

  const elementRegex = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = elementRegex.exec(cleaned)) !== null) {
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]).replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (tag.startsWith("h")) {
      const level = parseInt(tag.slice(1), 10);
      blocks.push(`${"#".repeat(level)} ${text}`);
    } else if (tag === "li") {
      blocks.push(`- ${text}`);
    } else {
      blocks.push(text);
    }
  }

  if (blocks.length === 0) {
    return parseText(stripTags(cleaned), { title: detectedTitle });
  }

  return parseText(blocks.join("\n\n"), { title: detectedTitle });
}

export function parseMarkdown(input: string, opts: { title?: string } = {}): ParsedDoc {
  return parseText(input, opts);
}

export function buildCast(
  parsed: ParsedDoc,
  opts: {
    wpm?: number;
    title?: string;
    topic?: string;
    sourceType: SourceType;
    sourceUrl?: string;
    sourceDocumentId?: string;
    sourcePrompt?: string;
  },
): Cast {
  const wpm = opts.wpm ?? DEFAULT_WPM;
  const sections: Section[] = [];
  let cumulativeSeconds = 0;
  let totalWords = 0;

  for (let i = 0; i < parsed.sections.length; i++) {
    const s = parsed.sections[i];
    const rawChunks = chunkText(s.text);
    const chunks: Chunk[] = rawChunks.map((c, idx) => ({
      index: idx,
      text: c.text,
      charStart: c.charStart,
      charEnd: c.charEnd,
      estimatedSeconds: estimateSeconds(c.text, wpm),
    }));
    const sectionDuration = chunks.reduce((a, c) => a + c.estimatedSeconds, 0);
    sections.push({
      id: newId("sec"),
      title: s.title || `Section ${i + 1}`,
      order: i,
      text: s.text,
      chunks,
      estimatedStartSeconds: cumulativeSeconds,
      estimatedDurationSeconds: sectionDuration,
    });
    cumulativeSeconds += sectionDuration;
    totalWords += countWords(s.text);
  }

  const now = Date.now();
  return {
    id: newId("cast"),
    title: opts.title ?? parsed.title,
    topic: opts.topic,
    sourcePrompt: opts.sourcePrompt,
    sourceType: opts.sourceType,
    sourceUrl: opts.sourceUrl,
    sourceDocumentId: opts.sourceDocumentId,
    createdAt: now,
    updatedAt: now,
    importedAt: now,
    totalDurationSeconds: cumulativeSeconds,
    totalWords,
    sections,
  };
}

export function recomputeChunks(cast: Cast, wpm: number): Cast {
  let cumulative = 0;
  const sections = cast.sections.map((sec, i) => {
    const chunks = chunkText(sec.text).map((c, idx) => ({
      index: idx,
      text: c.text,
      charStart: c.charStart,
      charEnd: c.charEnd,
      estimatedSeconds: estimateSeconds(c.text, wpm),
    }));
    const duration = chunks.reduce((a, c) => a + c.estimatedSeconds, 0);
    const out: Section = {
      ...sec,
      order: i,
      chunks,
      estimatedStartSeconds: cumulative,
      estimatedDurationSeconds: duration,
    };
    cumulative += duration;
    return out;
  });
  return {
    ...cast,
    sections,
    totalDurationSeconds: cumulative,
    totalWords: sections.reduce((a, s) => a + countWords(s.text), 0),
    updatedAt: Date.now(),
  };
}
