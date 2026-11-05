import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getObject, MIME } from "@/lib/storage";
import type { ImageExt } from "@/lib/image-sniff";

/** Avatars are visible to their owner and to anyone only when the owner made the profile public. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const u = await db.user.findUnique({ where: { id }, select: { imageUrl: true, publicProfile: true, disabledAt: true } });
  const viewer = await getCurrentUser();
  const allowed = u?.imageUrl && !u.disabledAt && (u.publicProfile || viewer?.id === id);
  if (!u || !u.imageUrl || !allowed) return new Response("Not found", { status: 404 });
  const ext = u.imageUrl.split(".").pop() as ImageExt;
  const data = await getObject(`avatars/${id}.${ext}`);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": MIME[ext], "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
