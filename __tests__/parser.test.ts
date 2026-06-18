import { describe, expect, it } from "vitest";
import {
  chunkText,
  countWords,
  detectHeading,
  estimateSeconds,
  parseHtml,
  parseText,
  buildCast,
} from "../lib/parser";

describe("countWords / estimateSeconds", () => {
  it("counts words", () => {
    expect(countWords("hello world  foo")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("estimates seconds at 160 wpm", () => {
    const text = Array(160).fill("word").join(" ");
    expect(estimateSeconds(text)).toBeCloseTo(60, 5);
  });
  it("respects custom wpm", () => {
    const text = Array(80).fill("word").join(" ");
    expect(estimateSeconds(text, 80)).toBeCloseTo(60, 5);
  });
});

describe("detectHeading", () => {
  it("detects markdown headings", () => {
    expect(detectHeading("# Big Title")).toBe("Big Title");
    expect(detectHeading("## Sub")).toBe("Sub");
    expect(detectHeading("### Sub Sub")).toBe("Sub Sub");
  });
  it("detects Section/Part/Chapter prefixes", () => {
    expect(detectHeading("Section 1: Intro to AI")).toBe("Intro to AI");
    expect(detectHeading("Part 2 - The Deep Dive")).toBe("The Deep Dive");
    expect(detectHeading("Chapter 3. Conclusions")).toBe("Conclusions");
    expect(detectHeading("Section 4")).toBe("Section 4");
  });
  it("detects named headings", () => {
    expect(detectHeading("Recap")).toBe("Recap");
    expect(detectHeading("Conclusion: it was great")).toBe(
      "Conclusion: it was great",
    );
    expect(detectHeading("Intro")).toBe("Intro");
  });
  it("ignores body lines", () => {
    expect(detectHeading("This is a normal sentence.")).toBe(null);
    expect(detectHeading("")).toBe(null);
  });
});

describe("chunkText", () => {
  it("returns empty for blank input", () => {
    expect(chunkText("")).toEqual([]);
  });
  it("keeps short text as a single chunk", () => {
    const chunks = chunkText("Short sentence.", 240);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain("Short sentence");
  });
  it("breaks long text at sentence boundaries", () => {
    const text = (
      "First sentence here. Second sentence here. Third sentence. " +
      "Fourth one. Fifth! Sixth? Seventh, eighth, ninth and tenth."
    );
    const chunks = chunkText(text, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(60);
    }
  });
  it("hard-splits a single sentence longer than max", () => {
    const long = "a".repeat(600) + ".";
    const chunks = chunkText(long, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(200);
    }
  });
});

describe("parseText", () => {
  it("detects title from first markdown heading", () => {
    const out = parseText("# My Cast\n\n## Section 1\nHello.\n\n## Section 2\nWorld.");
    expect(out.title).toBe("My Cast");
    expect(out.sections.length).toBe(2);
    expect(out.sections[0].title).toBe("Section 1");
    expect(out.sections[1].title).toBe("Section 2");
  });

  it("detects 'Section N: Title' style", () => {
    const text = [
      "Podcast Title",
      "",
      "Section 1: Intro",
      "Hello there.",
      "",
      "Section 2: Body",
      "Main content goes here.",
      "",
      "Recap",
      "Wrapping up.",
    ].join("\n");
    const out = parseText(text);
    expect(out.title).toBe("Podcast Title");
    expect(out.sections.map((s) => s.title)).toEqual(["Intro", "Body", "Recap"]);
  });

  it("falls back to paragraph grouping when no headings", () => {
    const paragraphs = Array(12).fill(0).map((_, i) =>
      `Paragraph ${i + 1}. Some content here.`,
    );
    const out = parseText(paragraphs.join("\n\n"));
    expect(out.sections.length).toBeGreaterThan(1);
    expect(out.sections.length).toBeLessThanOrEqual(6);
  });

  it("handles empty input gracefully", () => {
    const out = parseText("");
    expect(out.sections.length).toBe(0);
    expect(out.title).toBeTruthy();
  });
});

describe("parseHtml", () => {
  it("extracts h1/h2/p from Google-Docs-like HTML", () => {
    const html = `
      <html><head><title>Doc Title</title><style>.c0 {color:red}</style></head>
      <body>
        <h1 class="c0"><span>Podcast Title</span></h1>
        <h2><span>Section 1</span></h2>
        <p class="c2"><span>Hello there.</span></p>
        <p><span>More body.</span></p>
        <h2>Section 2</h2>
        <p>Conclusion text.</p>
      </body></html>
    `;
    const out = parseHtml(html);
    expect(out.title).toBe("Doc Title");
    expect(out.sections.length).toBe(2);
    expect(out.sections[0].title).toBe("Section 1");
    expect(out.sections[0].text).toContain("Hello there");
    expect(out.sections[1].title).toBe("Section 2");
  });

  it("decodes entities", () => {
    const html =
      "<h1>It&rsquo;s great</h1><p>foo &amp; bar &mdash; baz</p>";
    const out = parseHtml(html);
    expect(out.title.includes("’") || out.title.includes("'")).toBe(true);
    const text = out.sections[0]?.text ?? "";
    expect(text.includes("&")).toBe(true);
    expect(text.includes("—")).toBe(true);
  });
});

describe("buildCast", () => {
  it("creates chunks with cumulative timestamps", () => {
    const parsed = parseText(
      "# Title\n\n## Section 1\n" + "word ".repeat(160) + "\n\n## Section 2\n" + "word ".repeat(160),
    );
    const cast = buildCast(parsed, { sourceType: "paste" });
    expect(cast.title).toBe("Title");
    expect(cast.sections.length).toBe(2);
    expect(cast.sections[0].estimatedStartSeconds).toBe(0);
    expect(cast.sections[1].estimatedStartSeconds).toBeGreaterThan(50);
    expect(cast.totalDurationSeconds).toBeGreaterThan(100);
    expect(cast.sections[0].chunks.length).toBeGreaterThan(0);
  });
});
