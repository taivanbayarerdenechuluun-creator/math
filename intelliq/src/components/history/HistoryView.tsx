"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { useApp } from "../Providers";
import { categoryTrends, compareAttempts, summarize, type HistoryRow } from "@/lib/history";
import type { Key } from "@/lib/i18n";

const skeleton = () => <div className="h-64 animate-pulse rounded-xl bg-deep" aria-hidden="true" />;
const TrendChart = dynamic(() => import("./HistoryCharts").then((m) => m.TrendChart), { ssr: false, loading: skeleton });
const TimeChart = dynamic(() => import("./HistoryCharts").then((m) => m.TimeChart), { ssr: false, loading: skeleton });
const CategoryBars = dynamic(() => import("./HistoryCharts").then((m) => m.CategoryBars), { ssr: false, loading: skeleton });
const CompareRadar = dynamic(() => import("./HistoryCharts").then((m) => m.CompareRadar), { ssr: false, loading: skeleton });

const ALL = "__all__";
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5 sm:p-6"><h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>{children}</motion.section>;
}

export function HistoryView({ rows }: { rows: HistoryRow[] }) {
  const { tt, lang, t } = useApp();
  const titles = useMemo(() => {
    const m = new Map<string, { en: string; mn: string; n: number }>();
    for (const r of rows) m.set(r.assessmentSlug, { en: r.titleEn, mn: r.titleMn, n: (m.get(r.assessmentSlug)?.n ?? 0) + 1 });
    return m;
  }, [rows]);
  const initial = [...titles.entries()].sort((a, b) => b[1].n - a[1].n)[0]?.[0] ?? ALL;
  const [filter, setFilter] = useState(initial);
  const [picked, setPicked] = useState<string[]>([]);

  const shown = useMemo(() => (filter === ALL ? rows : rows.filter((r) => r.assessmentSlug === filter)), [rows, filter]);
  const single = filter !== ALL;
  const sum = useMemo(() => summarize(shown), [shown]);
  const trends = useMemo(() => (single ? categoryTrends(shown) : []), [shown, single]);
  const label = (i: number) => `#${i + 1}`;
  const catName = (slug: string) => t(`cat.${slug}` as Key);

  const cmp = useMemo(() => {
    // Always compare older (A) with newer (B), whatever order the boxes were ticked in.
    const [a, b] = picked.map((id) => rows.find((r) => r.id === id)!).sort((x, y) => x.date.localeCompare(y.date));
    return a && b ? { a, b, diff: compareAttempts(a, b) } : null;
  }, [picked, rows]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
  const dir = sum.direction;
  const DirIcon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;

  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt("History & progress", "Түүх ба ахиц")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{tt("Changes between attempts show practice progress. They are not changes in IQ, and scores are only comparable within the same assessment.", "Оролдлого хоорондын өөрчлөлт нь дасгалын ахицыг харуулна. Энэ нь IQ-ийн өөрчлөлт биш бөгөөд оноо зөвхөн ижил тестийн дотор харьцуулагдана.")}</p>

        {rows.length === 0 ? (
          <div className="card mt-8 grid place-items-center px-6 py-14 text-center">
            <p className="font-semibold">{tt("No attempts yet", "Оролдлого алга")}</p>
            <p className="mt-2 max-w-sm text-sm text-muted">{tt("Complete an assessment and your trends, comparisons and strengths will appear here.", "Тест дуусгасны дараа хандлага, харьцуулалт, давуу талууд энд гарна.")}</p>
            <Link href="/assessments" className="btn btn-primary mt-5">{tt("Browse assessments", "Тестүүдийг үзэх")}</Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label htmlFor="flt" className="text-sm text-muted">{tt("Assessment", "Тест")}</label>
              <select id="flt" value={filter} onChange={(e) => { setFilter(e.target.value); setPicked([]); }} className="input !w-auto">
                {[...titles.entries()].map(([slug, v]) => <option key={slug} value={slug}>{lang === "en" ? v.en : v.mn} ({v.n})</option>)}
                <option value={ALL}>{tt("All assessments", "Бүх тестүүд")}</option>
              </select>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={tt("Summary", "Хураангуй")}>
              {[
                [tt("Attempts", "Оролдлого"), String(sum.attempts)],
                [tt("Best", "Хамгийн сайн"), String(sum.best)],
                [tt("Average", "Дундаж"), String(sum.average)],
                [tt("Avg. time", "Дундаж хугацаа"), fmtTime(sum.avgDurationSec ?? 0)],
              ].map(([k, v]) => <div key={k} className="card p-4 text-center"><p className="font-display text-2xl font-bold">{v}</p><p className="text-xs text-muted">{k}</p></div>)}
            </div>
            {sum.delta !== null && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                <DirIcon size={16} className={dir === "up" ? "text-emerald-700 dark:text-emerald-400" : dir === "down" ? "text-rose-700 dark:text-rose-400" : ""} />
                {tt("Latest vs first attempt", "Сүүлийн ба анхны оролдлого")}: <span className="font-semibold text-ink">{sum.delta > 0 ? "+" : ""}{sum.delta}</span> {tt("points", "оноо")}
                {!single && <span>({tt("mixed assessments", "холимог тестүүд")})</span>}
              </p>
            )}

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Panel title={tt("Score trend", "Онооны хандлага")}>
                {shown.length >= 2 ? <TrendChart data={shown.map((r, i) => ({ label: label(i), performance: r.performance, accuracy: r.accuracy }))} perfLabel={t("r.perf")} accLabel={t("r.accuracy")} /> : <p className="text-sm text-muted">{tt("Take this assessment at least twice to see a trend.", "Хандлага харахын тулд энэ тестийг дор хаяж хоёр удаа өг.")}</p>}
              </Panel>
              <Panel title={tt("Completion time", "Дуусгах хугацаа")}>
                {shown.length >= 2 ? <TimeChart data={shown.map((r, i) => ({ label: label(i), minutes: Math.round((r.durationSec / 60) * 10) / 10 }))} label={t("r.time")} /> : <p className="text-sm text-muted">{tt("A second attempt will show how your pace changes.", "Хоёр дахь оролдлого таны хурд хэрхэн өөрчлөгдөхийг харуулна.")}</p>}
              </Panel>
            </div>

            {single && trends.length > 0 && (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Panel title={tt("Domain change: first vs latest", "Чадварын өөрчлөлт: анхны ба сүүлийн")}>
                  {trends.some((c) => c.delta !== null) ? <CategoryBars data={trends.filter((c) => c.delta !== null).map((c) => ({ name: catName(c.slug), first: c.first, latest: c.latest }))} firstLabel={tt("First", "Анхны")} latestLabel={tt("Latest", "Сүүлийн")} /> : <p className="text-sm text-muted">{tt("Domain comparisons need at least two attempts with 2+ questions per domain.", "Чадварын харьцуулалтад чадвар бүрд 2+ асуулттай дор хаяж хоёр оролдлого хэрэгтэй.")}</p>}
                </Panel>
                <Panel title={tt("Consistent strengths & weaknesses", "Тогтвортой давуу ба сул тал")}>
                  <ul className="space-y-2.5 text-sm">
                    {trends.map((c) => (
                      <li key={c.slug} className="flex items-center justify-between gap-3">
                        <span>{catName(c.slug)}</span>
                        <span className="flex items-center gap-2 text-muted">
                          {c.average}% · {c.attempts}×
                          {c.kind === "strength" && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">{tt("strength", "давуу")}</span>}
                          {c.kind === "weakness" && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">{tt("to practise", "дасгалжуулах")}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted">{tt("Labels need 2+ measured attempts: strength = average ≥ 70%, to practise = average < 50%.", "Тэмдэглэгээнд хэмжсэн 2+ оролдлого хэрэгтэй: давуу = дундаж ≥ 70%, дасгалжуулах = дундаж < 50%.")}</p>
                </Panel>
              </div>
            )}

            <Panel title={tt("Your attempts", "Таны оролдлогууд")}>
              <p className="mb-3 text-xs text-muted">{tt("Select two attempts to compare them side by side.", "Хоёр оролдлогыг сонгоод зэрэгцүүлэн харьцуул.")}</p>
              <ul className="divide-y divide-line text-sm">
                {[...shown].reverse().map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`${tt("Select attempt", "Оролдлого сонгох")} ${r.date.slice(0, 10)}`} className="h-4 w-4 accent-[var(--violet)]" />
                    <span className="min-w-0 flex-1 truncate">{lang === "en" ? r.titleEn : r.titleMn}</span>
                    <span className="text-muted">{r.date.slice(0, 10)}</span>
                    <span className="w-10 text-right font-semibold">{r.performance}</span>
                    <Link href={`/results/${r.id}`} className="text-violet-fg underline underline-offset-2 hover:no-underline" aria-label={tt("Open results", "Үр дүн нээх")}><ArrowRight size={16} /></Link>
                  </li>
                ))}
              </ul>
            </Panel>

            {cmp && (
              <section className="card mt-5 p-5 sm:p-6" aria-live="polite">
                <h2 className="font-display text-lg font-semibold">{tt("Comparison", "Харьцуулалт")}</h2>
                {!cmp.diff.comparableAssessment && <p className="mt-2 rounded-lg border border-line bg-deep p-3 text-xs text-muted">{tt("These attempts are from different assessments, so differences are indicative only.", "Эдгээр оролдлого өөр тестүүдийнх тул ялгаа зөвхөн чиглүүлэх шинжтэй.")}</p>}
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <CompareRadar data={cmp.diff.categories.map((c) => ({ name: catName(c.slug), a: c.a, b: c.b }))} aLabel={cmp.a.date.slice(0, 16).replace("T", " ")} bLabel={cmp.b.date.slice(0, 16).replace("T", " ")} />
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-normal">&nbsp;</th><th className="font-normal">{cmp.a.date.slice(5, 16).replace("T", " ")}</th><th className="font-normal">{cmp.b.date.slice(5, 16).replace("T", " ")}</th><th className="text-right font-normal">Δ</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      <tr><td className="py-2 font-semibold">{t("r.perf")}</td><td>{cmp.a.performance}</td><td>{cmp.b.performance}</td><td className="text-right font-semibold">{cmp.diff.overall > 0 ? "+" : ""}{cmp.diff.overall}</td></tr>
                      <tr><td className="py-2">{t("r.accuracy")}</td><td>{cmp.a.accuracy}%</td><td>{cmp.b.accuracy}%</td><td className="text-right">{cmp.diff.accuracy > 0 ? "+" : ""}{cmp.diff.accuracy}</td></tr>
                      <tr><td className="py-2">{t("r.time")}</td><td>{fmtTime(cmp.a.durationSec)}</td><td>{fmtTime(cmp.b.durationSec)}</td><td className="text-right">{cmp.diff.durationSec > 0 ? "+" : "−"}{fmtTime(Math.abs(cmp.diff.durationSec))}</td></tr>
                      {cmp.diff.categories.map((c) => (
                        <tr key={c.slug}><td className="py-2">{catName(c.slug)}</td><td>{c.a ?? "–"}</td><td>{c.b ?? "–"}</td><td className="text-right">{c.delta === null ? "–" : `${c.delta > 0 ? "+" : ""}${c.delta}`}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
