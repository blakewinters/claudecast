import { NextResponse } from "next/server";
import { googleDocsImporter } from "@/lib/google-docs-importer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReqBody {
  url?: string;
  documentId?: string;
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_body", message: "Body must be JSON." } },
      { status: 400 },
    );
  }

  const input = body.url || body.documentId;
  if (!input) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_body",
          message: "Provide a 'url' or 'documentId'.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await googleDocsImporter.importByUrlOrId(input);
    return NextResponse.json({
      ok: true,
      documentId: result.documentId,
      sourceUrl: result.sourceUrl,
      fetchedFormat: result.fetchedFormat,
      title: result.parsed.title,
      sections: result.parsed.sections,
      rawText: result.parsed.rawText,
    });
  } catch (err) {
    const error = err as { code?: string; message?: string };
    const code = error?.code ?? "fetch_failed";
    const message = error?.message ?? "Couldn't import the Google Doc.";
    const status =
      code === "invalid_url" || code === "invalid_body"
        ? 400
        : code === "not_accessible" || code === "oauth_required"
          ? 403
          : 502;
    return NextResponse.json({ error: { code, message } }, { status });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const documentId = searchParams.get("documentId");
  if (!url && !documentId) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_body",
          message: "Provide ?url= or ?documentId=",
        },
      },
      { status: 400 },
    );
  }
  return POST(
    new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url ?? undefined, documentId: documentId ?? undefined }),
    }),
  );
}
