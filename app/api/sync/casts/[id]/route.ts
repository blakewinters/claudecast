import { auth } from "@/auth";
import { deleteRemoteCast } from "@/lib/sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in first." } },
      { status: 401 },
    );
  }
  await deleteRemoteCast(email, params.id);
  return Response.json({ ok: true });
}
