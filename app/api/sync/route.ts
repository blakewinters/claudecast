import { auth } from "@/auth";
import {
  isSyncConfigured,
  listRemoteCasts,
  listRemotePlayback,
  getRemoteSettings,
} from "@/lib/sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bulk pull: returns everything for the signed-in user.
 * Used by the client on app load.
 */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in first." } },
      { status: 401 },
    );
  }
  if (!isSyncConfigured()) {
    return Response.json({
      configured: false,
      casts: [],
      playback: [],
      settings: null,
    });
  }
  const [casts, playback, settings] = await Promise.all([
    listRemoteCasts(email),
    listRemotePlayback(email),
    getRemoteSettings(email),
  ]);
  return Response.json({ configured: true, casts, playback, settings });
}
