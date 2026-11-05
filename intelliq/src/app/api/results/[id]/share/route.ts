import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { crossSite, forbidden } from "@/lib/guard";
import { loadOwnedResult } from "@/lib/results";

const body = z.object({ enable: z.boolean() });

/** Owner-only. Creates or revokes the public read-only link for a result. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (crossSite(req)) return forbidden("Cross-site request blocked.");
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await loadOwnedResult(id);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const row = await db.assessmentResult.findUniqueOrThrow({ where: { id }, select: { userId: true } });
  const shareToken = parsed.data.enable ? (result.shareToken ?? randomBytes(18).toString("base64url")) : null;
  await db.report.upsert({ where: { resultId: id }, update: { shareToken }, create: { resultId: id, userId: row.userId, shareToken } });
  return NextResponse.json({ shareToken });
}
