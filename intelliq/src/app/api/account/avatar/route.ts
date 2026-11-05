import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userForMutation } from "@/lib/guard";
import { checkImage, deleteObject, putObject } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const MAX = 1024 * 1024;
const EXTS = ["png", "jpg", "webp", "gif"];

export async function POST(req: Request) {
  const g = await userForMutation(req);
  if ("res" in g) return g.res;
  if (!rateLimit(`avatar:${g.user.id}`, 10, 60_000 * 10)) return NextResponse.json({ error: "Too many uploads." }, { status: 429 });
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Image too large (max 1024 KB)." }, { status: 413 });
  const checked = checkImage(Buffer.from(await file.arrayBuffer()), MAX);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 415 });

  for (const e of EXTS) if (e !== checked.ext) await deleteObject(`avatars/${g.user.id}.${e}`);
  await putObject(`avatars/${g.user.id}.${checked.ext}`, checked.bytes);
  await db.user.update({ where: { id: g.user.id }, data: { imageUrl: `avatar.${checked.ext}` } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = await userForMutation(req);
  if ("res" in g) return g.res;
  for (const e of EXTS) await deleteObject(`avatars/${g.user.id}.${e}`);
  await db.user.update({ where: { id: g.user.id }, data: { imageUrl: null } });
  return NextResponse.json({ ok: true });
}
