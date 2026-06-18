import { describe, expect, it } from "vitest";
import {
  extractGoogleDocId,
  isPublishedGoogleDocUrl,
  googleDocExportUrl,
} from "../lib/google-doc";

describe("extractGoogleDocId", () => {
  it("extracts ID from /edit URL", () => {
    expect(
      extractGoogleDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMn0pQrStUvWxYz/edit",
      ),
    ).toBe("1AbCdEfGhIjKlMn0pQrStUvWxYz");
  });

  it("extracts ID from /view URL", () => {
    expect(
      extractGoogleDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMn0pQrStUvWxYz/view",
      ),
    ).toBe("1AbCdEfGhIjKlMn0pQrStUvWxYz");
  });

  it("extracts ID from /mobilebasic URL", () => {
    expect(
      extractGoogleDocId(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMn0pQrStUvWxYz/mobilebasic",
      ),
    ).toBe("1AbCdEfGhIjKlMn0pQrStUvWxYz");
  });

  it("extracts ID from published /d/e/ URL", () => {
    expect(
      extractGoogleDocId(
        "https://docs.google.com/document/d/e/2PACX-aaaabbbbcccc/pub",
      ),
    ).toBe("2PACX-aaaabbbbcccc");
  });

  it("extracts ID from drive file URL", () => {
    expect(
      extractGoogleDocId(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMn0pQrStUvWxYz/view?usp=sharing",
      ),
    ).toBe("1AbCdEfGhIjKlMn0pQrStUvWxYz");
  });

  it("accepts a bare ID", () => {
    const id = "1AbCdEfGhIjKlMn0pQrStUvWxYz_AndAFewMoreChars";
    expect(extractGoogleDocId(id)).toBe(id);
  });

  it("returns null for invalid URLs", () => {
    expect(extractGoogleDocId("")).toBe(null);
    expect(extractGoogleDocId("not-a-url")).toBe(null);
    expect(extractGoogleDocId("https://example.com/page")).toBe(null);
  });

  it("handles trailing whitespace", () => {
    expect(
      extractGoogleDocId(
        "  https://docs.google.com/document/d/1AbCdEfGhIjKlMn0pQrStUvWxYz/edit  ",
      ),
    ).toBe("1AbCdEfGhIjKlMn0pQrStUvWxYz");
  });
});

describe("isPublishedGoogleDocUrl", () => {
  it("detects /d/e/ pub URLs", () => {
    expect(
      isPublishedGoogleDocUrl(
        "https://docs.google.com/document/d/e/2PACX-xyz/pub",
      ),
    ).toBe(true);
  });
  it("returns false for normal /d/ URLs", () => {
    expect(
      isPublishedGoogleDocUrl(
        "https://docs.google.com/document/d/1abc/edit",
      ),
    ).toBe(false);
  });
});

describe("googleDocExportUrl", () => {
  it("builds html export URL by default", () => {
    expect(googleDocExportUrl("abc123")).toBe(
      "https://docs.google.com/document/d/abc123/export?format=html",
    );
  });
  it("builds txt export URL", () => {
    expect(googleDocExportUrl("abc123", "txt")).toBe(
      "https://docs.google.com/document/d/abc123/export?format=txt",
    );
  });
  it("builds pub URL when published", () => {
    expect(googleDocExportUrl("abc123", "html", true)).toBe(
      "https://docs.google.com/document/d/e/abc123/pub",
    );
  });
});
