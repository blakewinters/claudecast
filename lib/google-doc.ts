export function extractGoogleDocId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  const patterns: RegExp[] = [
    /docs\.google\.com\/document\/d\/e\/([a-zA-Z0-9_-]+)/i,
    /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i,
    /[?&]id=([a-zA-Z0-9_-]{20,})/i,
  ];

  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

export function isPublishedGoogleDocUrl(url: string): boolean {
  return /docs\.google\.com\/document\/d\/e\/[a-zA-Z0-9_-]+/i.test(url);
}

export function googleDocExportUrl(
  id: string,
  format: "txt" | "html" = "html",
  published = false,
): string {
  if (published) {
    return `https://docs.google.com/document/d/e/${id}/pub`;
  }
  return `https://docs.google.com/document/d/${id}/export?format=${format}`;
}

export function googleDocViewUrl(id: string): string {
  return `https://docs.google.com/document/d/${id}/edit`;
}
