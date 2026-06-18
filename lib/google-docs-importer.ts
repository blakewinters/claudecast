import {
  extractGoogleDocId,
  googleDocExportUrl,
  isPublishedGoogleDocUrl,
} from "./google-doc";
import { parseHtml, parseText } from "./parser";
import type { ParsedDoc } from "./types";

export interface ImportResult {
  parsed: ParsedDoc;
  documentId: string;
  sourceUrl: string;
  fetchedFormat: "html" | "txt" | "pub";
}

export interface ImportError {
  code:
    | "invalid_url"
    | "not_accessible"
    | "fetch_failed"
    | "empty_doc"
    | "oauth_required";
  message: string;
}

/**
 * Public/shared Google Doc importer.
 * Works when the doc is shared "Anyone with the link can view" or published to the web.
 * For private docs, callers should fall back to OAuth (not implemented in MVP).
 */
export class GoogleDocsImporter {
  async importByUrlOrId(urlOrId: string): Promise<ImportResult> {
    const id = extractGoogleDocId(urlOrId);
    if (!id) {
      throw <ImportError>{
        code: "invalid_url",
        message:
          "That doesn't look like a Google Doc link. Paste the URL from the address bar in Docs.",
      };
    }

    const isPublished = isPublishedGoogleDocUrl(urlOrId);

    const attempts: { format: "html" | "txt" | "pub"; url: string }[] =
      isPublished
        ? [{ format: "pub", url: `https://docs.google.com/document/d/e/${id}/pub` }]
        : [
            { format: "html", url: googleDocExportUrl(id, "html") },
            { format: "txt", url: googleDocExportUrl(id, "txt") },
          ];

    let lastErr: ImportError | null = null;
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, {
          redirect: "follow",
          headers: { Accept: a.format === "txt" ? "text/plain" : "text/html" },
        });

        if (res.status === 401 || res.status === 403) {
          lastErr = {
            code: "not_accessible",
            message:
              "Google says this doc isn't readable. Change sharing to 'Anyone with the link can view', or use OAuth import for private docs.",
          };
          continue;
        }
        if (!res.ok) {
          lastErr = {
            code: "fetch_failed",
            message: `Google returned ${res.status} when fetching the doc.`,
          };
          continue;
        }
        const finalUrl = res.url || a.url;
        if (
          finalUrl.includes("accounts.google.com") ||
          finalUrl.includes("ServiceLogin")
        ) {
          lastErr = {
            code: "not_accessible",
            message:
              "Google redirected to login — the doc isn't publicly shared. Set sharing to 'Anyone with the link can view'.",
          };
          continue;
        }

        const body = await res.text();
        if (!body.trim()) {
          lastErr = { code: "empty_doc", message: "The exported doc was empty." };
          continue;
        }

        const parsed =
          a.format === "txt" ? parseText(body) : parseHtml(body);

        if (parsed.sections.length === 0 && !parsed.rawText.trim()) {
          lastErr = {
            code: "empty_doc",
            message: "Couldn't extract any text from the doc.",
          };
          continue;
        }

        return {
          parsed,
          documentId: id,
          sourceUrl: `https://docs.google.com/document/d/${id}/edit`,
          fetchedFormat: a.format,
        };
      } catch (err) {
        lastErr = {
          code: "fetch_failed",
          message:
            err instanceof Error ? err.message : "Network error while fetching doc.",
        };
      }
    }

    throw (
      lastErr ?? {
        code: "fetch_failed",
        message: "Couldn't fetch the Google Doc.",
      }
    );
  }
}

export const googleDocsImporter = new GoogleDocsImporter();
