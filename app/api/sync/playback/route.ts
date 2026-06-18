import { auth } from "@/auth";
import { putRemotePlayback } from "@/lib/sync-server";
import type { PlaybackState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in first." } },
      { status: 401 },
    );
  }
  let state: PlaybackState;
  try {
    state = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "Body must be JSON." } },
      { status: 400 },
    );
  }
  if (!state?.castId) {
    return Response.json(
      { error: { code: "invalid_body", message: "Missing castId." } },
      { status: 400 },
    );
  }
  await putRemotePlayback(email, state);
  return Response.json({ ok: true });
}
