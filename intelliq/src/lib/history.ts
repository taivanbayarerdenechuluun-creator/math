/**
 * History analysis. Pure (tested in history.test.ts). All "progress" here is practice progress
 * between attempts, never a change in IQ.
 */
import { MIN_Q_TO_RANK } from "./feedback";

export type HistoryRow = {
  id: string;
  date: string; // ISO
  assessmentSlug: string;
  titleEn: string;
  titleMn: string;
  performance: number;
  accuracy: number;
  durationSec: number;
  total: number;
  categories: { slug: string; total: number; performance: number }[];
};

export type CategoryTrend = {
  slug: string;
  attempts: number;
  average: number;
  first: number;
  latest: number;
  delta: number | null;
  kind: "strength" | "weakness" | "mixed";
};

export const STRENGTH_AVG = 70;
export const WEAKNESS_AVG = 50;
export const TREND_DELTA = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function categoryTrends(rows: HistoryRow[]): CategoryTrend[] {
  const slugs = [...new Set(rows.flatMap((r) => r.categories.map((c) => c.slug)))].sort();
  const out: CategoryTrend[] = [];
  for (const slug of slugs) {
    const pts = rows.flatMap((r) => r.categories.filter((c) => c.slug === slug && c.total >= MIN_Q_TO_RANK).map((c) => c.performance));
    if (!pts.length) continue;
    const average = round1(pts.reduce((a, b) => a + b, 0) / pts.length);
    // Consistent labels need repeated evidence: a single attempt never makes a strength or weakness.
    const kind = pts.length >= 2 ? (average >= STRENGTH_AVG ? "strength" : average < WEAKNESS_AVG ? "weakness" : "mixed") : "mixed";
    out.push({ slug, attempts: pts.length, average, first: pts[0], latest: pts[pts.length - 1], delta: pts.length >= 2 ? round1(pts[pts.length - 1] - pts[0]) : null, kind });
  }
  return out;
}

export type Summary = {
  attempts: number;
  best: number | null;
  average: number | null;
  latest: number | null;
  /** latest vs first, only with >= 2 attempts */
  delta: number | null;
  direction: "up" | "down" | "flat" | null;
  avgAccuracy: number | null;
  avgDurationSec: number | null;
};

export function summarize(rows: HistoryRow[]): Summary {
  if (!rows.length) return { attempts: 0, best: null, average: null, latest: null, delta: null, direction: null, avgAccuracy: null, avgDurationSec: null };
  const perf = rows.map((r) => r.performance);
  const delta = rows.length >= 2 ? round1(perf[perf.length - 1] - perf[0]) : null;
  return {
    attempts: rows.length,
    best: Math.max(...perf),
    average: round1(perf.reduce((a, b) => a + b, 0) / rows.length),
    latest: perf[perf.length - 1],
    delta,
    direction: delta === null ? null : delta >= TREND_DELTA ? "up" : delta <= -TREND_DELTA ? "down" : "flat",
    avgAccuracy: round1(rows.reduce((a, r) => a + r.accuracy, 0) / rows.length),
    avgDurationSec: Math.round(rows.reduce((a, r) => a + r.durationSec, 0) / rows.length),
  };
}

/** Per-domain differences between two attempts (b minus a). Domains need >= 2 questions in both. */
export function compareAttempts(a: HistoryRow, b: HistoryRow) {
  const slugs = [...new Set([...a.categories, ...b.categories].map((c) => c.slug))].sort();
  return {
    overall: round1(b.performance - a.performance),
    accuracy: round1(b.accuracy - a.accuracy),
    durationSec: b.durationSec - a.durationSec,
    comparableAssessment: a.assessmentSlug === b.assessmentSlug,
    categories: slugs.map((slug) => {
      const ca = a.categories.find((c) => c.slug === slug);
      const cb = b.categories.find((c) => c.slug === slug);
      const ok = !!ca && !!cb && ca.total >= MIN_Q_TO_RANK && cb.total >= MIN_Q_TO_RANK;
      return { slug, a: ca?.performance ?? null, b: cb?.performance ?? null, delta: ok ? round1(cb!.performance - ca!.performance) : null };
    }),
  };
}
