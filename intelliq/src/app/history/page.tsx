import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { HistoryView } from "@/components/history/HistoryView";
import type { HistoryRow } from "@/lib/history";

export const metadata: Metadata = { title: "History & progress", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const results = await db.assessmentResult.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "asc" },
    include: { session: { select: { assessment: { select: { slug: true, titleEn: true, titleMn: true } } } }, categories: { include: { category: { select: { slug: true } } } } },
  });
  const rows: HistoryRow[] = results.map((r) => ({
    id: r.id, date: r.createdAt.toISOString(), assessmentSlug: r.session.assessment.slug, titleEn: r.session.assessment.titleEn, titleMn: r.session.assessment.titleMn,
    performance: r.performanceScore, accuracy: r.accuracy, durationSec: r.durationSec, total: r.total,
    categories: r.categories.map((c) => ({ slug: c.category.slug, total: c.total, performance: c.performance })),
  }));
  return <HistoryView rows={rows} />;
}
