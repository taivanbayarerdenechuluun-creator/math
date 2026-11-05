import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { userForMutation } from "@/lib/guard";

const body = z.object({ slug: z.string().min(1).max(80) });

/** Toggles a bookmark and returns the new state. */
export async function POST(req: Request) {
  const g = await userForMutation(req);
  if ("res" in g) return g.res;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const a = await db.assessment.findFirst({ where: { slug: p.data.slug, active: true }, select: { id: true } });
  if (!a) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  const key = { userId_assessmentId: { userId: g.user.id, assessmentId: a.id } };
  if (await db.bookmark.findUnique({ where: key })) {
    await db.bookmark.delete({ where: key });
    return NextResponse.json({ bookmarked: false });
  }
  await db.bookmark.create({ data: { userId: g.user.id, assessmentId: a.id } });
  return NextResponse.json({ bookmarked: true });
}
