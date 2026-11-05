"use client";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Sparkles, ShieldAlert, X } from "lucide-react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { FigureView, StemView } from "../FigureView";
import { RadarPanel } from "./RadarPanel";
import { Badge } from "../AchIcon";
import { ShareBar } from "./ShareBar";
import { useApp } from "../Providers";
import type { Key } from "@/lib/i18n";
import type { Bi } from "@/lib/feedback";
import type { FullResult } from "@/lib/results";
import type { Fig, Stem } from "@/lib/figures";

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Ring({ value }: { value: number }) {
  const { tt } = useApp();
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 180 180" className="h-44 w-44 -rotate-90" role="img" aria-label={tt(`${value} out of 100`, `100-аас ${value}`)}>
      <defs>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" /><stop offset="0.6" stopColor="#3B82F6" /><stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <circle cx="90" cy="90" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
      <motion.circle cx="90" cy="90" r={r} fill="none" stroke="url(#ring)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.2, ease: "easeOut" }} />
    </svg>
  );
}

function FbList({ title, items, lang, tone }: { title: string; items: Bi[]; lang: "en" | "mn"; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className={`text-sm font-semibold ${tone}`}>{title}</h3>
      <ul className="mt-2 space-y-2 text-sm text-muted">
        {items.map((b, i) => (
          <li key={i} className="flex gap-2"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone.replace("text-", "bg-")}`} /><span>{b[lang]}</span></li>
        ))}
      </ul>
    </div>
  );
}

function AiPanel({ id, available, saved }: { id: string; available: boolean; saved: { en?: string; mn?: string } | null }) {
  const { t, lang, te } = useApp();
  const [texts, setTexts] = useState(saved ?? {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const text = texts[lang];

  async function run() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/results/${id}/insights`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTexts((x) => ({ ...x, [lang]: d.text }));
    } catch (e) {
      setErr(e instanceof Error ? te(e.message) : t("t.error"));
    } finally {
      setBusy(false);
    }
  }

  if (!available && !text) return <p className="mt-5 text-xs text-muted">{t("r.ai.unavail")}</p>;
  return (
    <div className="mt-6 rounded-xl border border-line bg-deep p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-cyan-fg" /> {t("r.ai.title")}</h3>
        {!text && <button onClick={run} disabled={busy} className="btn btn-ghost !min-h-9 text-sm">{busy ? t("r.ai.loading") : t("r.ai.btn")}</button>}
      </div>
      {text && <div className="mt-3 space-y-2 whitespace-pre-line text-sm text-muted">{text}</div>}
      {err && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{err}</p>}
      <p className="mt-3 text-xs text-muted">{t("r.ai.note")}</p>
    </div>
  );
}

function Review({ items }: { items: FullResult["review"] }) {
  const { t, tt, lang } = useApp();
  const mn = lang === "mn";
  const [open, setOpen] = useState(false);
  return (
    <section className="card mt-5 p-6 sm:p-8">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <h2 className="font-display text-xl font-semibold">{t("r.review")}</h2>
        <span className="flex items-center gap-2 text-sm text-muted">{open ? t("r.review.hide") : t("r.review.show")} <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} /></span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-5 space-y-5 overflow-hidden">
            {items.map((q) => (
              <li key={q.position} className="rounded-xl border border-line bg-deep p-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>#{q.position} · {t(`cat.${q.category}` as Key)} · {t("t.diff")} {q.difficulty}/5</span>
                  <span className={q.correct ? "text-emerald-700 dark:text-emerald-400" : q.correct === false ? "text-rose-700 dark:text-rose-400" : ""}>{q.correct ? t("r.correct") : q.correct === false ? t("r.incorrect") : t("r.noans")}</span>
                </div>
                {q.stimulus && (
                  <div className="mt-3 rounded-lg border border-line p-3 text-center text-sm">
                    <p className="mb-1 text-xs text-muted">{t("r.shown")}</p>
                    {q.stimulus.text && <p className="font-display text-lg font-semibold tracking-wider">{mn && q.stimulusMn ? q.stimulusMn : q.stimulus.text}</p>}
                    {q.stimulus.fig ? <div className="mx-auto w-fit"><FigureView fig={q.stimulus.fig as Fig} size={90} /></div> : null}
                  </div>
                )}
                {q.stem ? <div className="mt-3"><StemView stem={q.stem as Stem} /></div> : null}
                <p className="mt-3 font-medium">{mn && q.promptMn ? q.promptMn : q.prompt}</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o) => {
                    const chosen = o.id === q.chosenId;
                    const cls = o.isCorrect ? "border-emerald-400 bg-emerald-400/10" : chosen ? "border-rose-400 bg-rose-400/10" : "border-line";
                    return (
                      <li key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
                        {o.figure ? <FigureView fig={o.figure as Fig} size={56} /> : <span>{mn && o.labelMn ? o.labelMn : o.label}</span>}
                        <span className="ml-auto flex items-center gap-1 text-xs">
                          {chosen && <span className="text-muted">{t("r.yours")}</span>}
                          {o.isCorrect ? <Check size={14} className="text-emerald-700 dark:text-emerald-400" aria-label={t("r.right")} /> : chosen ? <X size={14} className="text-rose-700 dark:text-rose-400" /> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-sm text-muted"><span className="font-semibold text-ink">{t("r.expl")}: </span>{mn && q.explanationMn ? q.explanationMn : q.explanation}</p>
                {q.reaction && (
                  <p className="mt-2 text-xs text-muted">
                    {q.reaction.falseStart ? tt("False start: you pressed before the pad lit.", "Буруу эхлэл: тэмдэг асахаас өмнө дарсан.") : q.reaction.ms === null ? tt("No reaction recorded.", "Хариу бүртгэгдээгүй.") : `${tt("Reaction time", "Хариу үйлдлийн хугацаа")}: ${q.reaction.ms} ms (${tt("limit", "хязгаар")} ${q.reaction.limitMs} ms)`}
                  </p>
                )}
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}

export function ResultsView({ d, aiAvailable }: { d: FullResult; aiAvailable: boolean }) {
  const { t, lang } = useApp();
  const fb = d.feedback;
  const showRadar = d.categories.length >= 3;
  const stat = (label: string, v: string | number) => (
    <div className="rounded-xl border border-line bg-deep p-4 text-center">
      <p className="font-display text-2xl font-bold">{v}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
  const noFindings = !fb.strengths.length && !fb.improvements.length && !fb.observations.length;

  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm text-muted">{lang === "en" ? d.titleEn : d.titleMn} · {t("r.code")} <span className="font-mono">{d.reportCode}</span></p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("r.title")}</h1>
        </motion.div>

        <AnimatePresence>
          {d.unlocked.map((u) => (
            <motion.div key={u.code} initial={{ opacity: 0, scale: 0.85, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 14 }} className="card mt-6 flex items-center gap-4 border-violet p-4" role="status" data-testid="unlock">
              <motion.div initial={{ rotate: -180 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 120 }}><Badge code={u.code} /></motion.div>
              <div><p className="text-xs uppercase tracking-wider text-cyan-fg">{lang === "en" ? "Achievement unlocked" : "Амжилт нээгдлээ"}</p><p className="font-semibold">{u.name[lang]}</p><p className="text-xs text-muted">+{u.xp} XP</p></div>
            </motion.div>
          ))}
        </AnimatePresence>

        <section className="card mt-6 grid items-center gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
          <div className="relative mx-auto">
            <Ring value={d.performance} />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="font-display text-4xl font-bold">{d.performance}</p>
                <p className="text-xs text-muted">/ 100</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">{t("r.perf")}</h2>
            <p className="mt-2 text-sm text-muted">{t("r.perf.d")}</p>
            {d.previous && (
              <p className="mt-2 text-sm">
                <span className="text-muted">{t("r.vsprev")}: </span>
                <span className={d.performance >= d.previous.performance ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                  {d.performance - d.previous.performance >= 0 ? "+" : ""}{Math.round((d.performance - d.previous.performance) * 10) / 10}
                </span>
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stat(t("r.raw"), `${d.correct} / ${d.total}`)}
              {stat(t("r.accuracy"), `${d.accuracy}%`)}
              {stat(t("r.time"), fmtTime(d.durationSec))}
              {stat(t("r.correct"), d.correct)}
              {stat(t("r.incorrect"), d.incorrect)}
              {stat(t("r.unanswered"), d.unanswered)}
            </div>
          </div>
        </section>

        <section className="card mt-5 p-4 sm:p-8">
          <h2 className="font-display text-xl font-semibold">{t("r.radar")}</h2>
          <p className="mt-1 text-sm text-muted">{t("r.radar.sub")}</p>
          {showRadar ? <RadarPanel cats={d.categories} /> : <p className="mt-4 text-sm text-muted">{t("r.radar.min")}</p>}
          {d.previous && <p className="mt-2 text-xs text-muted">{t("r.progress")}</p>}
        </section>

        <section className="card mt-5 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">{t("r.details")}</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {d.categories.map((c, i) => (
              <li key={c.slug} className="rounded-xl border border-line bg-deep p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{t(`cat.${c.slug}` as Key)}</h3>
                  <span className="font-display text-lg font-bold text-violet-fg">{c.performance}%</span>
                </div>
                <p className="mt-1 text-xs text-muted">{t(`cat.${c.slug}.d` as Key)}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" initial={{ width: 0 }} animate={{ width: `${c.performance}%` }} transition={{ duration: 0.9, delay: 0.08 * i }} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {c.correct}/{c.total} {t("r.correct").toLowerCase()}
                  {c.hardestCorrect ? ` · ${t("r.hardest")}: ${c.hardestCorrect}/5` : ""}
                  {c.prev !== null ? ` · ${t("r.previous")}: ${c.prev}%` : ""}
                </p>
                {c.total < 3 && <p className="mt-1 text-xs text-cyan-fg">{t("r.lowconf")}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="card mt-5 p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">{t("r.fb")}</h2>
          <p className="mt-2 text-sm">{fb.summary[lang]}</p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <FbList title={t("r.fb.strengths")} items={fb.strengths} lang={lang} tone="text-emerald-700 dark:text-emerald-400" />
            <FbList title={t("r.fb.improve")} items={fb.improvements} lang={lang} tone="text-amber-700 dark:text-amber-400" />
            <FbList title={t("r.fb.obs")} items={fb.observations} lang={lang} tone="text-cyan-fg" />
            <FbList title={t("r.fb.recs")} items={fb.recommendations} lang={lang} tone="text-violet-fg" />
          </div>
          {noFindings && <p className="mt-4 text-sm text-muted">{t("r.fb.none")}</p>}
          <p className="mt-5 text-xs text-muted">{t("r.fb.note")}</p>
          <AiPanel id={d.id} available={aiAvailable} saved={d.aiInsight} />
        </section>

        <ShareBar id={d.id} initialToken={d.shareToken} signedIn={d.signedIn} />

        <Review items={d.review} />

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-deep p-4 text-sm text-muted">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-cyan-fg" />
          <p>{t("r.limits")}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/assessments" className="btn btn-primary">{t("r.again")}</Link>
          {d.signedIn ? <Link href="/dashboard" className="btn btn-ghost">{t("r.dash")}</Link> : <Link href="/register" className="btn btn-ghost">{t("nav.signup")}</Link>}
        </div>
      </main>
      <Footer />
    </>
  );
}
