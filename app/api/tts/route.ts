import { auth } from "@/auth";
import { GoogleTTSProvider, GoogleTTSError } from "@/lib/tts/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReqBody {
  text?: string;
  voice?: string;
  rate?: number;
  pitch?: number;
}

const MAX_CHARS = 5000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in first." } },
      { status: 401 },
    );
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "Body must be JSON." } },
      { status: 400 },
    );
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return Response.json(
      { error: { code: "invalid_body", message: "Missing 'text'." } },
      { status: 400 },
    );
  }
  if (text.length > MAX_CHARS) {
    return Response.json(
      {
        error: {
          code: "text_too_long",
          message: `Text exceeds ${MAX_CHARS} chars (got ${text.length}).`,
        },
      },
      { status: 400 },
    );
  }
  const voice = body.voice ?? "en-US-Neural2-J";

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: {
          code: "not_configured",
          message:
            "TTS isn't configured. Set GOOGLE_TTS_API_KEY in environment.",
        },
      },
      { status: 503 },
    );
  }

  const provider = new GoogleTTSProvider(apiKey);
  try {
    const result = await provider.synthesize({
      text,
      voice,
      rate: body.rate,
      pitch: body.pitch,
    });
    return new Response(result.audio, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    if (err instanceof GoogleTTSError) {
      return Response.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    return Response.json(
      {
        error: {
          code: "tts_failed",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
