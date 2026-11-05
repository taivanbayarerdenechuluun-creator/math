import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { aiConfigured, generateAiInsight } from "@/lib/ai";
import { loadOwnedResult } from "@/lib/results";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Vercel: allow up to 60 s (the default is shorter than an AI call or a PDF with embedded fonts can need).
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ lang: z.enum(["en", "mn"]) });

/** Optional AI explanation. Sends only aggregate scores (no name/email); runs only on explicit request. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!aiConfigured())
    return NextResponse.json({ error: "AI feedback is not configured on this server." }, { status: 501 });
  if (!rateLimit(`ai:${clientIp(req)}`, 6, 60_000 * 60))
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await loadOwnedResult(id);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { lang } = parsed.data;
  const cached = result.aiInsight?.[lang];
  if (cached) return NextResponse.json({ text: cached, cached: true });

  try {
    const text = await generateAiInsight(result.aiInput, lang);
    await db.assessmentResult.update({ where: { id }, data: { aiInsight: JSON.stringify({ ...result.aiInsight, [lang]: text }) } });
    return NextResponse.json({ text, cached: false });
  } catch (e) {
    console.error("[ai] generation failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "AI feedback is temporarily unavailable. The rule-based feedback above is unaffected." }, { status: 502 });
  }
}
