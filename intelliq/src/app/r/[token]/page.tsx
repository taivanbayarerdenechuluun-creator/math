import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { SharedView } from "@/components/results/SharedView";

export const metadata: Metadata = { title: "Shared result", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 16) notFound();
  const rep = await db.report.findUnique({
    where: { shareToken: token },
    include: { result: { include: { session: { select: { assessment: { select: { titleEn: true, titleMn: true } } } }, categories: { include: { category: { select: { slug: true } } } } } } },
  });
  if (!rep) notFound();
  const r = rep.result;
  // Deliberately excludes the owner's identity, answers and report code.
  return (
    <SharedView
      d={{
        titleEn: r.session.assessment.titleEn, titleMn: r.session.assessment.titleMn, date: r.createdAt.toISOString().slice(0, 10),
        performance: r.performanceScore, accuracy: r.accuracy, total: r.total, correct: r.correct,
        categories: r.categories.map((c) => ({ slug: c.category.slug, total: c.total, correct: c.correct, performance: c.performance, prev: null })).sort((a, b) => a.slug.localeCompare(b.slug)),
      }}
    />
  );
}
