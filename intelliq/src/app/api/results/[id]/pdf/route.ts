import { db } from "@/lib/db";
import { loadOwnedResult } from "@/lib/results";
import { buildReportPdf } from "@/lib/pdf";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Vercel: allow up to 60 s (the default is shorter than an AI call or a PDF with embedded fonts can need).
export const maxDuration = 60;

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!rateLimit(`pdf:${clientIp(req)}`, 20, 60_000 * 10)) return Response.json({ error: "Too many requests." }, { status: 429 });
  const result = await loadOwnedResult(id);
  if (!result) return Response.json({ error: "Not found." }, { status: 404 });

  const lang = new URL(req.url).searchParams.get("lang") === "mn" ? "mn" : "en";
  const pdf = await buildReportPdf(result, lang);
  await db.report.upsert({ where: { resultId: id }, update: {}, create: { resultId: id, userId: (await db.assessmentResult.findUnique({ where: { id }, select: { userId: true } }))?.userId ?? null } });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="INTELLIQ-report-${result.reportCode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
