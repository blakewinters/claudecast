import { auth } from "@/auth";
import { putRemoteSettings } from "@/lib/sync-server";
import type { Settings } from "@/lib/types";

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
  let settings: Settings;
  try {
    settings = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "Body must be JSON." } },
      { status: 400 },
    );
  }
  await putRemoteSettings(email, settings);
  return Response.json({ ok: true });
}
