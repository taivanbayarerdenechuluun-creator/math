import { getObject, MIME } from "@/lib/storage";
import type { ImageExt } from "@/lib/image-sniff";

const NAME = /^([a-f0-9]{32})\.(png|jpg|webp|gif)$/;

/** Serves uploaded question images. Strict name check (no traversal) and locked-down response headers. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const m = NAME.exec(name);
  if (!m) return new Response("Not found", { status: 404 });
  const data = await getObject(`assets/${name}`);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[m[2] as ImageExt],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
