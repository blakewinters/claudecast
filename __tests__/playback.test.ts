import { describe, expect, it } from "vitest";
import { findChunkIndexForTime, flattenCast } from "../lib/speech";
import { buildCast, parseText } from "../lib/parser";

function makeCast() {
  const parsed = parseText(
    "# Title\n\n## Section 1\n" +
      "word ".repeat(160) +
      "\n\n## Section 2\n" +
      "word ".repeat(160) +
      "\n\n## Section 3\n" +
      "word ".repeat(160),
  );
  return buildCast(parsed, { sourceType: "paste" });
}

describe("flattenCast", () => {
  it("produces ascending globalStartSeconds", () => {
    const cast = makeCast();
    const flat = flattenCast(cast);
    expect(flat.length).toBeGreaterThan(3);
    for (let i = 1; i < flat.length; i++) {
      expect(flat[i].globalStartSeconds).toBeGreaterThanOrEqual(
        flat[i - 1].globalStartSeconds,
      );
    }
  });

  it("matches cast totalDurationSeconds", () => {
    const cast = makeCast();
    const flat = flattenCast(cast);
    const total = flat.reduce((a, e) => a + e.chunk.estimatedSeconds, 0);
    expect(total).toBeCloseTo(cast.totalDurationSeconds, 5);
  });
});

describe("findChunkIndexForTime", () => {
  it("returns 0 for t=0", () => {
    const cast = makeCast();
    const flat = flattenCast(cast);
    expect(findChunkIndexForTime(flat, 0, cast.totalDurationSeconds)).toBe(0);
  });

  it("returns last index for t >= total", () => {
    const cast = makeCast();
    const flat = flattenCast(cast);
    expect(
      findChunkIndexForTime(flat, cast.totalDurationSeconds + 100, cast.totalDurationSeconds),
    ).toBe(flat.length - 1);
  });

  it("finds chunk that contains the requested time", () => {
    const cast = makeCast();
    const flat = flattenCast(cast);
    const mid = flat[Math.floor(flat.length / 2)];
    const t = mid.globalStartSeconds + mid.chunk.estimatedSeconds / 2;
    const idx = findChunkIndexForTime(flat, t, cast.totalDurationSeconds);
    expect(flat[idx].globalStartSeconds).toBeLessThanOrEqual(t);
    expect(
      flat[idx].globalStartSeconds + flat[idx].chunk.estimatedSeconds,
    ).toBeGreaterThan(t);
  });

  it("seeking to section start returns first chunk of that section", () => {
    const cast = makeCast();
    const flat = flattenCast(cast);
    const sec2Start = cast.sections[1].estimatedStartSeconds;
    const idx = findChunkIndexForTime(flat, sec2Start, cast.totalDurationSeconds);
    expect(flat[idx].section.id).toBe(cast.sections[1].id);
    expect(flat[idx].chunk.index).toBe(0);
  });

  it("clamps negative time to 0", () => {
    const cast = makeCast();
    const flat = flattenCast(cast);
    expect(findChunkIndexForTime(flat, -50, cast.totalDurationSeconds)).toBe(0);
  });
});
