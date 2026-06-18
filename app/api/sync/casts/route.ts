import { auth } from "@/auth";
import { putRemoteCast } from "@/lib/sync-server";
import type { Cast } from "@/lib/types";

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
  let cast: Cast;
  try {
    cast = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "Body must be JSON." } },
      { status: 400 },
    );
  }
  if (!cast?.id) {
    return Response.json(
      { error: { code: "invalid_body", message: "Missing cast.id." } },
      { status: 400 },
    );
  }
  await putRemoteCast(email, cast);
  return Response.json({ ok: true });
}
