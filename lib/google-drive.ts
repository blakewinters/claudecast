export interface DriveDoc {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
  iconLink?: string;
}

const DOC_MIME = "application/vnd.google-apps.document";

export class GoogleDriveError extends Error {
  constructor(
    message: string,
    public code: "unauthorized" | "forbidden" | "not_found" | "fetch_failed",
    public status?: number,
  ) {
    super(message);
  }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

async function callDrive(url: string, token: string): Promise<Response> {
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 401) {
    throw new GoogleDriveError(
      "Google access token rejected — try signing out and back in.",
      "unauthorized",
      401,
    );
  }
  if (res.status === 403) {
    throw new GoogleDriveError(
      "Google denied access. Make sure you granted Drive permission.",
      "forbidden",
      403,
    );
  }
  if (res.status === 404) {
    throw new GoogleDriveError("Document not found.", "not_found", 404);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GoogleDriveError(
      `Drive API error ${res.status}: ${body.slice(0, 200)}`,
      "fetch_failed",
      res.status,
    );
  }
  return res;
}

export async function listGoogleDocs(
  accessToken: string,
  opts: { query?: string; pageSize?: number } = {},
): Promise<DriveDoc[]> {
  const filters = [
    `mimeType='${DOC_MIME}'`,
    "trashed=false",
  ];
  if (opts.query) {
    const safe = opts.query.replace(/'/g, "\\'");
    filters.push(`name contains '${safe}'`);
  }
  const params = new URLSearchParams({
    q: filters.join(" and "),
    orderBy: "modifiedTime desc",
    pageSize: String(opts.pageSize ?? 50),
    fields: "files(id,name,modifiedTime,webViewLink,iconLink)",
  });
  const res = await callDrive(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    accessToken,
  );
  const data = (await res.json()) as { files?: DriveDoc[] };
  return data.files ?? [];
}

export async function exportGoogleDocAsHtml(
  fileId: string,
  accessToken: string,
): Promise<string> {
  const res = await callDrive(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/html`,
    accessToken,
  );
  return res.text();
}

export async function getGoogleDocMetadata(
  fileId: string,
  accessToken: string,
): Promise<DriveDoc> {
  const params = new URLSearchParams({
    fields: "id,name,modifiedTime,webViewLink,iconLink",
  });
  const res = await callDrive(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
    accessToken,
  );
  return (await res.json()) as DriveDoc;
}
