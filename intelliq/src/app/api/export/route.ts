import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Neutralise spreadsheet formula injection: cells starting with = + - @ are prefixed with a quote.
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const rows = await db.assessmentResult.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "asc" },
    include: { session: { select: { assessment: { select: { titleEn: true } } } }, categories: { include: { category: { select: { slug: true } } } } },
  });
  const slugs = ["logical", "abstract", "numerical", "verbal", "spatial", "memory", "speed"];
  const header = ["report_id", "date", "assessment", "total", "correct", "incorrect", "unanswered", "accuracy_pct", "performance_score", "duration_sec", ...slugs.map((s) => `${s}_pct`)];
  const lines = [header.join(",")];
  for (const r of rows) {
    const by = new Map(r.categories.map((c) => [c.category.slug, c.performance]));
    lines.push([r.reportCode, r.createdAt.toISOString(), r.session.assessment.titleEn, r.total, r.correct, r.incorrect, r.unanswered, r.accuracy, r.performanceScore, r.durationSec, ...slugs.map((s) => by.get(s) ?? "")].map(cell).join(","));
  }
  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="intelliq-results.csv"', "Cache-Control": "private, no-store" },
  });
}
