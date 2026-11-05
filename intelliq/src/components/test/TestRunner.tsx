"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock, Eraser, Flag, LogOut, X } from "lucide-react";
import { LogoMark } from "../Logo";
import { StemView, FigureView } from "../FigureView";
import { useApp } from "../Providers";
import type { Fig, Stem } from "@/lib/figures";
import type { Key } from "@/lib/i18n";

type Opt = { id: string; label: string; labelMn: string | null; figure: Fig | null };
type Q = {
  id: string; position: number; category: string; difficulty: number; prompt: string; promptMn: string | null;
  stem: Stem | null; stimulus: { text?: string; fig?: Fig } | null; stimulusMn: string | null; stimulusRemainingMs: number | null;
  timeLimitSec: number | null; timeLeftMs: number | null; options: Opt[];
  reaction: { startsInMs: number; targetOptionId: string; limitMs: number } | null;
};
type Ans = { optionId: string | null; flagged: boolean; resolved: boolean };
type Data = { title: { en: string; mn: string }; total: number; deadline: string | null; offset: number };

async function api(path: string, method: "GET" | "POST", body?: unknown) {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json };
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function TestRunner({ sessionId }: { sessionId: string }) {
  const { t, tt, lang } = useApp();
  const router = useRouter();

  const [data, setData] = useState<Data | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, Ans>>({});
  const [idx, setIdx] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(0);
  const [review, setReview] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [finalTotal, setFinalTotal] = useState<number | null>(null);

  // Absolute client-clock deadlines for per-question timers and memory stimuli.
  const [timeEnd, setTimeEnd] = useState<Record<string, number>>({});
  const [stim, setStim] = useState<Record<string, { end: number; total: number }>>({});
  const [litAt, setLitAt] = useState<Record<string, number>>({}); // reaction items: when the target pad lights (client clock)
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const autoAdvanced = useRef<string | null>(null);
  const submitting = useRef(false);

  const deadlineLeft = data?.deadline ? new Date(data.deadline).getTime() - (now + data.offset) : null;
  const timesUp = deadlineLeft !== null && deadlineLeft <= 0;
  const total = finalTotal ?? data?.total ?? 0;
  const q = qs[idx];
  const ans = q ? answers[q.id] : undefined;

  const register = useCallback((list: Q[]) => {
    const t0 = Date.now();
    setTimeEnd((m) => ({ ...m, ...Object.fromEntries(list.filter((x) => x.timeLeftMs != null).map((x) => [x.id, t0 + (x.timeLeftMs as number)])) }));
    setStim((m) => ({ ...m, ...Object.fromEntries(list.filter((x) => x.stimulusRemainingMs != null).map((x) => [x.id, { end: t0 + (x.stimulusRemainingMs as number), total: x.stimulusRemainingMs as number }])) }));
    setLitAt((m) => ({ ...m, ...Object.fromEntries(list.filter((x) => x.reaction).map((x) => [x.id, t0 + (x.reaction as NonNullable<Q["reaction"]>).startsInMs])) }));
  }, []);

  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    setPending((n) => n + 1);
    const run = queue.current.then(fn, fn).finally(() => setPending((n) => n - 1));
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const goResults = useCallback((resultId: string) => router.replace(`/results/${resultId}`), [router]);

  // Initial load / resume
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await api(`/api/sessions/${sessionId}`, "GET");
      if (!live) return;
      if (!r.ok) return setFatal(r.status === 404 ? "notfound" : "error");
      if (r.json.status === "SUBMITTED") return r.json.resultId ? goResults(r.json.resultId) : setFatal("error");
      const list: Q[] = r.json.questions;
      register(list);
      setQs(list);
      setAnswers(r.json.answers);
      // Resume at the first unanswered question, else the latest.
      const firstOpen = list.findIndex((x) => !r.json.answers[x.id]?.optionId);
      setIdx(firstOpen === -1 ? list.length - 1 : firstOpen);
      setData({
        title: { en: r.json.assessment.titleEn, mn: r.json.assessment.titleMn },
        total: r.json.assessment.total,
        deadline: r.json.deadline,
        offset: new Date(r.json.serverNow).getTime() - Date.now(),
      });
    })().catch(() => live && setFatal("error"));
    return () => {
      live = false;
    };
  }, [sessionId, register, goResults]);

  // One ticker drives every countdown.
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  }, []);

  const submit = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    const r = await enqueue(() => api(`/api/sessions/${sessionId}/submit`, "POST"));
    if (r.ok) goResults(r.json.resultId);
    else {
      submitting.current = false;
      flash(t("t.error"));
    }
  }, [enqueue, sessionId, goResults, flash, t]);

  const handleExpired = useCallback(
    (json: { resultId?: string }) => {
      if (json.resultId) goResults(json.resultId);
      else void submit();
    },
    [goResults, submit],
  );

  const select = useCallback(
    async (optionId: string | null) => {
      if (!q || timesUp) return;
      const locked = !!q.timeLimitSec && !!answers[q.id]?.resolved;
      if (locked) return;
      setAnswers((a) => ({ ...a, [q.id]: { flagged: a[q.id]?.flagged ?? false, resolved: a[q.id]?.resolved || optionId !== null, optionId } }));
      const r = await enqueue(() => api(`/api/sessions/${sessionId}/answer`, "POST", { questionId: q.id, optionId }));
      if (r.status === 409 && r.json.expired) return handleExpired(r.json);
      if (r.ok && r.json.expired) {
        setAnswers((a) => ({ ...a, [q.id]: { ...a[q.id], optionId: null, resolved: true } }));
        flash(t("t.timesup").replace("Submitting…", "").trim());
      } else if (!r.ok) flash(t("t.error"));
    },
    [q, answers, timesUp, enqueue, sessionId, handleExpired, flash, t],
  );

  const toggleFlag = useCallback(async () => {
    if (!q) return;
    const flagged = !(answers[q.id]?.flagged ?? false);
    setAnswers((a) => ({ ...a, [q.id]: { optionId: a[q.id]?.optionId ?? null, resolved: a[q.id]?.resolved ?? false, flagged } }));
    const r = await enqueue(() => api(`/api/sessions/${sessionId}/answer`, "POST", { questionId: q.id, flagged }));
    if (!r.ok) flash(t("t.error"));
  }, [q, answers, enqueue, sessionId, flash, t]);

  const next = useCallback(async () => {
    if (!q || timesUp) return;
    if (idx < qs.length - 1) return setIdx(idx + 1);
    if (qs.length >= total) return setReview(true);
    const r = await enqueue(() => api(`/api/sessions/${sessionId}/next`, "POST", { fromQuestionId: q.id }));
    if (r.status === 409 && r.json.expired) return handleExpired(r.json);
    if (!r.ok) return flash(t("t.error"));
    const nq: Q | null = r.json.question;
    if (!nq) {
      setFinalTotal(qs.length);
      return setReview(true);
    }
    register([nq]);
    setQs((cur) => (cur.some((x) => x.id === nq.id) ? cur : [...cur, nq]));
    setAnswers((a) => ({ ...a, [q.id]: { optionId: a[q.id]?.optionId ?? null, flagged: a[q.id]?.flagged ?? false, resolved: true } }));
    setIdx((i) => i + 1);
  }, [q, qs, idx, total, timesUp, enqueue, sessionId, handleExpired, register, flash, t]);

  // Auto-skip when a timed question runs out of time.
  const qTimeLeft = q && !ans?.resolved && timeEnd[q.id] ? timeEnd[q.id] - now : null;
  useEffect(() => {
    if (q && qTimeLeft !== null && qTimeLeft <= 0 && idx === qs.length - 1 && autoAdvanced.current !== q.id) {
      autoAdvanced.current = q.id;
      void next();
    }
  }, [q, qTimeLeft, idx, qs.length, next]);

  // Overall test deadline.
  useEffect(() => {
    if (!timesUp) return;
    const h = setTimeout(() => void submit(), 0); // submit() is idempotent-guarded
    return () => clearTimeout(h);
  }, [timesUp, submit]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (review || !q || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (/^[1-9]$/.test(e.key)) {
        const o = q.options[Number(e.key) - 1];
        if (o) void select(o.id);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        void next();
      } else if (e.key === "ArrowLeft") {
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "m" || e.key === "M") void toggleFlag();
      else if (e.key === "Backspace" || e.key === "Delete") void select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [review, q, select, next, toggleFlag]);

  const stats = useMemo(() => {
    const answered = qs.filter((x) => answers[x.id]?.optionId).length;
    const flagged = qs.filter((x) => answers[x.id]?.flagged).length;
    return { answered, flagged, unanswered: total - answered };
  }, [qs, answers, total]);

  // ---------- render ----------
  if (fatal)
    return (
      <Shell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <p className="font-semibold">{fatal === "notfound" ? tt("This test session was not found.", "Энэ тестийн сесс олдсонгүй.") : t("t.error")}</p>
          <Link href="/assessments" className="btn btn-primary mt-5">{t("ov.back")}</Link>
        </div>
      </Shell>
    );

  if (!data || !q)
    return (
      <Shell>
        <div className="mx-auto w-full max-w-2xl space-y-4" aria-busy="true" aria-label={t("common.loading")}>
          <div className="h-6 w-1/3 animate-pulse rounded bg-card" />
          <div className="h-40 animate-pulse rounded-2xl bg-card" />
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />)}</div>
        </div>
      </Shell>
    );

  const stimInfo = stim[q.id];
  const stimLeft = stimInfo ? stimInfo.end - now : 0;
  const stimVisible = !!q.stimulus && stimLeft > 0;
  const stimTotal = stimInfo?.total ?? 1;
  const isLast = idx === total - 1;
  const locked = !!q.timeLimitSec && !!ans?.resolved;
  const saving = pending > 0;
  const mn = lang === "mn";
  const promptText = mn && q.promptMn ? q.promptMn : q.prompt;
  const stimText = mn && q.stimulusMn ? q.stimulusMn : q.stimulus?.text;
  const isReaction = q.stem?.k === "reaction";
  const lit = isReaction && !!q.reaction && litAt[q.id] !== undefined && now >= litAt[q.id];

  return (
    <Shell
      top={
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <LogoMark size={24} />
            <span className="truncate text-sm font-semibold">{lang === "en" ? data.title.en : data.title.mn}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            {deadlineLeft !== null && (
              <span role="group" className="flex items-center gap-1.5 tabular-nums" aria-label={t("t.alltime")}>
                <Clock size={14} className={deadlineLeft < 120_000 ? "text-rose-700 dark:text-rose-400" : "text-cyan-fg"} /> {fmt(deadlineLeft)}
              </span>
            )}
            <span aria-live="polite" className="hidden sm:inline">{saving ? t("t.saving") : t("t.saved")}</span>
            <Link href="/assessments" className="btn btn-ghost !min-h-9 !px-3 text-xs" title={t("t.exit")}><LogOut size={14} /><span className="sr-only">{t("t.exit")}</span></Link>
          </div>
        </div>
      }
    >
      {/* Progress */}
      <div className="mx-auto w-full max-w-3xl overflow-x-clip">
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>{t("t.question")} {idx + 1} {t("t.of")} {total}</span>
          <span className="flex items-center gap-3">
            <span className="rounded-full border border-line px-2.5 py-0.5">{t(`cat.${q.category}` as Key)}</span>
            <span role="img" className="flex items-center gap-1" title={`${t("t.diff")} ${q.difficulty}/5`} aria-label={`${t("t.diff")} ${q.difficulty} / 5`}>
              {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2 w-2 rounded-full ${n <= q.difficulty ? "bg-violet" : "bg-line"}`} />)}
            </span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={`${t("t.question")} ${idx + 1} ${t("t.of")} ${total}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={idx + 1}>
          <motion.div className="h-full rounded-full bg-gradient-to-r from-violet via-blue to-cyan" animate={{ width: `${((idx + 1) / total) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.section key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="card mt-5 p-5 sm:p-8">
            {q.timeLimitSec && !isReaction && !ans?.resolved && qTimeLeft !== null && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-xs text-muted">
                  <span>{t("t.timeleft")}</span>
                  <span className={`tabular-nums ${qTimeLeft < 4000 ? "text-rose-700 dark:text-rose-400" : ""}`}>{fmt(qTimeLeft)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-cyan transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, (qTimeLeft / (q.timeLimitSec * 1000)) * 100))}%` }} /></div>
              </div>
            )}

            {q.stimulus !== null || stimInfo ? (
              <div className="mb-5 rounded-xl border border-line bg-deep p-4 text-center">
                {stimVisible ? (
                  <>
                    <p className="mb-2 text-xs uppercase tracking-wider text-cyan-fg">{t("t.memorize")}</p>
                    {stimText && <p className="font-display text-2xl font-semibold tracking-wider sm:text-3xl">{stimText}</p>}
                    {q.stimulus?.fig && <div className="mx-auto w-fit"><FigureView fig={q.stimulus.fig} size={150} /></div>}
                    <div className="mx-auto mt-3 h-1 max-w-xs overflow-hidden rounded-full bg-line"><div className="h-full bg-cyan" style={{ width: `${Math.min(100, (stimLeft / stimTotal) * 100)}%` }} /></div>
                  </>
                ) : (
                  <p className="py-4 text-sm text-muted">{t("t.hidden")}</p>
                )}
              </div>
            ) : null}

            {q.stem && q.stem.k !== "reaction" && <div className="mb-5"><StemView stem={q.stem} /></div>}
            <h1 className="font-display text-lg font-semibold leading-snug sm:text-xl">{promptText}</h1>
            {isReaction && <p className="sr-only" aria-live="assertive">{lit && !ans?.resolved ? tt("Press the lit pad now", "Асаалттай тэмдгийг одоо дарна уу") : ""}</p>}

            <div className={`mt-6 grid gap-3 ${isReaction ? "mx-auto max-w-md grid-cols-2" : q.options.length === 5 ? "grid-cols-3 sm:grid-cols-5" : q.options.some((o) => o.figure) || q.options.length === 4 ? "grid-cols-2" : "sm:grid-cols-2"}`} role="radiogroup" aria-label={promptText}>
              {q.options.map((o, i) => {
                const chosen = ans?.optionId === o.id;
                const label = mn && o.labelMn ? o.labelMn : o.label;
                const target = isReaction && lit && q.reaction?.targetOptionId === o.id;
                const btnClass = isReaction
                  ? `relative grid min-h-24 place-items-center rounded-2xl border-2 px-4 py-3 font-display text-3xl font-bold transition disabled:cursor-not-allowed ${target ? "border-cyan bg-cyan/30 shadow-[0_0_44px_-4px_var(--cyan)]" : chosen ? "border-violet bg-violet/15" : "border-line bg-deep"}`
                  : `relative flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed ${chosen ? "border-violet bg-violet/15 shadow-[var(--glow)]" : "border-line bg-deep hover:border-violet/60"}`;
                return (
                  <motion.button
                    key={o.id}
                    role="radio"
                    aria-checked={chosen}
                    disabled={locked || timesUp}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => void select(o.id)}
                    className={btnClass}
                  >
                    {!isReaction && <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${chosen ? "bg-violet-700 text-white" : "bg-card text-muted"}`}>{i + 1}</span>}
                    {o.figure ? <span className="mx-auto"><FigureView fig={o.figure} size={q.options.length === 5 ? 56 : 84} /></span> : <span className={isReaction ? "" : "font-medium"}>{label}</span>}
                    {chosen && !isReaction && <Check size={16} className="ml-auto text-violet-fg" />}
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => void toggleFlag()} className={`btn btn-ghost !min-h-10 text-sm ${ans?.flagged ? "!border-cyan text-cyan-fg" : ""}`} aria-pressed={!!ans?.flagged}>
                <Flag size={15} /> {ans?.flagged ? t("t.marked") : t("t.mark")}
              </button>
              <button onClick={() => void select(null)} disabled={!ans?.optionId || locked} className="btn btn-ghost !min-h-10 text-sm disabled:opacity-40">
                <Eraser size={15} /> {t("t.clear")}
              </button>
            </div>
          </motion.section>
        </AnimatePresence>

        <div className="mt-5 flex items-center justify-between">
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="btn btn-ghost disabled:opacity-40"><ArrowLeft size={16} /> {t("t.prev")}</button>
          <span className="text-xs text-muted sm:hidden" aria-live="polite">{saving ? t("t.saving") : t("t.saved")}</span>
          <button onClick={() => void next()} className="btn btn-primary">
            {isLast && idx === qs.length - 1 ? t("t.finish") : t("t.next")} <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>{toast && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="glass fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl px-4 py-3 text-center text-sm">{toast}</motion.div>
      )}</AnimatePresence>

      <AnimatePresence>
        {timesUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
            <div className="card p-8 text-center font-semibold">{t("t.timesup")}</div>
          </motion.div>
        )}
        {review && !timesUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t("t.submit.q")}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="card max-h-[90vh] w-full max-w-lg overflow-auto p-6">
              <div className="flex items-start justify-between">
                <h2 className="font-display text-xl font-bold">{t("t.submit.q")}</h2>
                <button onClick={() => setReview(false)} aria-label={t("t.cancel")} className="text-muted hover:text-ink"><X size={20} /></button>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-xl bg-deep p-3"><dt className="text-xs text-muted">{t("t.answered")}</dt><dd className="font-display text-2xl font-bold text-violet-fg">{stats.answered}</dd></div>
                <div className="rounded-xl bg-deep p-3"><dt className="text-xs text-muted">{t("t.unanswered")}</dt><dd className="font-display text-2xl font-bold">{stats.unanswered}</dd></div>
                <div className="rounded-xl bg-deep p-3"><dt className="text-xs text-muted">{t("t.flagged")}</dt><dd className="font-display text-2xl font-bold text-cyan-fg">{stats.flagged}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: total }, (_, i) => {
                  const x = qs[i];
                  const a = x ? answers[x.id] : undefined;
                  const cls = !x ? "border-line text-muted/50" : a?.flagged ? "border-cyan text-cyan-fg" : a?.optionId ? "border-violet bg-violet/20" : "border-line";
                  return (
                    <button key={i} disabled={!x} title={x ? undefined : t("t.notreached")} onClick={() => { setIdx(i); setReview(false); }} className={`grid h-9 w-9 place-items-center rounded-lg border text-xs font-semibold ${cls}`}>{i + 1}</button>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setReview(false)} className="btn btn-ghost">{t("t.cancel")}</button>
                <button onClick={() => void submit()} className="btn btn-primary">{t("t.confirm")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function Shell({ children, top }: { children: React.ReactNode; top?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">{top ?? <div className="h-14" />}</header>
      <main id="main" className="px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
