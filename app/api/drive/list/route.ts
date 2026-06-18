import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleDriveError, listGoogleDocs } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in first." } },
      { status: 401 },
    );
  }
  if (!session.accessToken) {
    return NextResponse.json(
      {
        error: {
          code: "no_token",
          message:
            "No Google access token in session. Sign out and back in to grant Drive access.",
        },
      },
      { status: 401 },
    );
  }
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? undefined;
  try {
    const files = await listGoogleDocs(session.accessToken, { query });
    return NextResponse.json({ files });
  } catch (err) {
    if (err instanceof GoogleDriveError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status ?? 500 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "unknown",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
