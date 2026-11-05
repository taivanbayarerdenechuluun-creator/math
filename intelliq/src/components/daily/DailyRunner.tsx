"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Flame, X } from "lucide-react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { Badge } from "../AchIcon";
import { FigureView, StemView } from "../FigureView";
import { useApp } from "../Providers";
import type { Fig, Stem } from "@/lib/figures";
import type { Key } from "@/lib/i18n";
import type { Bi } from "@/lib/gamification";

type Q = {
  id: string; category: string; difficulty: number; prompt: string; promptMn: string | null; stem: Stem | null; imageUrl: string | null;
  stimulus: { text?: string; fig?: Fig } | null; stimulusMn: string | null; stimulusSec: number | null; timeLimitSec: number | null;
  options: { id: string; label: string; labelMn: string | null; figure: Fig | null }[];
};
type Review = { questionId: string; correctOptionId: string; chosenOptionId: string | null; correct: boolean; explanation: string; explanationMn: string | null }[];
type Attempt = { correct: number; total: number; xp: number; review: Review };
type Data = { date: string; questions: Q[]; signedIn: boolean; attempt: Attempt | null; weekly: { done: number; target: number; claimed: boolean } | null; streak: number };
type Done = { correct: number; total: number; xp: number; bonus: number; streak: number; unlocked: { code: string; name: Bi; xp: number }[]; review: Review };

export function DailyRunner({ history }: { history: { date: string; correct: number; total: number; xp: number }[] }) {
  const { tt, lang, t, te } = useApp();
  const mn = lang === "mn";
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Record<string, string | null>>({});
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [shown, setShown] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/daily", { cache: "no-store" }).then((r) => r.json()).then(setData).catch(() => setErr(t("t.error")));
  }, [t]);
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, []);

  const q = data?.questions[idx];

  const submit = useCallback(async (finalPicks: Record<string, string | null>) => {
    setBusy(true);
    const r = await fetch("/api/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: finalPicks }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ? te(j.error) : t("t.error"));
    setDone(j);
  }, [t, te]);

  const advance = useCallback((finalPicks: Record<string, string | null>) => {
    if (!data) return;
    if (idx < data.questions.length - 1) {
      setShown((s) => ({ ...s, [data.questions[idx + 1].id]: Date.now() }));
      setIdx(idx + 1);
    }
    else void submit(finalPicks);
  }, [data, idx, submit]);

  // Timed question: auto-advance when the countdown ends.
  const left = q && started && q.timeLimitSec ? q.timeLimitSec * 1000 - (now - (shown[q.id] ?? now)) : null;
  useEffect(() => {
    if (q && left !== null && left <= 0 && !done && !busy) {
      const h = setTimeout(() => advance({ ...picks, [q.id]: picks[q.id] ?? null }), 0);
      return () => clearTimeout(h);
    }
  }, [q, left, done, busy, advance, picks]);

  const body = () => {
    if (err) return <p role="alert" className="card p-6 text-rose-700 dark:text-rose-300">{err}</p>;
    if (!data) return <div className="card h-64 animate-pulse" aria-busy="true" />;

    const review = done?.review ?? data.attempt?.review;
    if (review) {
      const total = done?.total ?? data.attempt!.total;
      const correct = done?.correct ?? data.attempt!.correct;
      return (
        <div>
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">{tt("Today's challenge complete", "Өнөөдрийн сорилт дууссан")}</p>
            <p className="mt-1 font-display text-5xl font-bold">{correct}<span className="text-xl text-muted"> / {total}</span></p>
            <p className="mt-2 text-sm text-violet-fg">+{done ? done.xp + done.bonus : data.attempt!.xp} XP{done?.bonus ? ` (${tt("incl. weekly bonus", "7 хоногийн урамшуулалтай")} +${done.bonus})` : ""}</p>
            <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted"><Flame size={16} className="text-orange-400" /> {done?.streak ?? data.streak} {tt("day streak", "хоногийн цуваа")}</p>
          </div>
          <AnimatePresence>
            {done?.unlocked.map((u) => (
              <motion.div key={u.code} initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 14 }} className="card mt-4 flex items-center gap-4 border-violet p-4" role="status">
                <motion.div initial={{ rotate: -180 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 120 }}><Badge code={u.code} /></motion.div>
                <div><p className="text-xs uppercase tracking-wider text-cyan-fg">{tt("Achievement unlocked", "Амжилт нээгдлээ")}</p><p className="font-semibold">{u.name[lang]}</p><p className="text-xs text-muted">+{u.xp} XP</p></div>
              </motion.div>
            ))}
          </AnimatePresence>
          <h2 className="mt-8 font-display text-xl font-semibold">{tt("Solutions", "Бодолт")}</h2>
          <ol className="mt-4 space-y-4">
            {data.questions.map((qq, i) => {
              const r = review.find((x) => x.questionId === qq.id)!;
              return (
                <li key={qq.id} className="card p-5">
                  <p className="text-xs text-muted">#{i + 1} · {t(`cat.${qq.category}` as Key)}</p>
                  {qq.stem && <div className="mt-3"><StemView stem={qq.stem} /></div>}
                  <p className="mt-2 font-medium">{mn && qq.promptMn ? qq.promptMn : qq.prompt}</p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {qq.options.map((o) => {
                      const right = o.id === r.correctOptionId, chosen = o.id === r.chosenOptionId;
                      return (
                        <li key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${right ? "border-emerald-400 bg-emerald-400/10" : chosen ? "border-rose-400 bg-rose-400/10" : "border-line"}`}>
                          {o.figure ? <FigureView fig={o.figure} size={48} /> : mn && o.labelMn ? o.labelMn : o.label}
                          <span className="ml-auto">{right ? <Check size={14} className="text-emerald-700 dark:text-emerald-400" /> : chosen ? <X size={14} className="text-rose-700 dark:text-rose-400" /> : null}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-sm text-muted"><span className="font-semibold text-ink">{tt("Explanation", "Тайлбар")}: </span>{mn && r.explanationMn ? r.explanationMn : r.explanation}</p>
                </li>
              );
            })}
          </ol>
        </div>
      );
    }

    if (!data.signedIn)
      return (
        <div className="card p-8 text-center">
          <p className="font-semibold">{tt("Sign in to take today's challenge", "Өнөөдрийн сорилтыг өгөхийн тулд нэвтэрнэ үү")}</p>
          <p className="mt-2 text-sm text-muted">{tt("Completion, XP and streaks are saved to your account.", "Дуусгалт, XP, цуваа таны бүртгэлд хадгалагдана.")}</p>
          <div className="mt-5 flex justify-center gap-3"><Link href="/login" className="btn btn-primary">{t("nav.login")}</Link><Link href="/register" className="btn btn-ghost">{t("nav.signup")}</Link></div>
        </div>
      );

    if (!started)
      return (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">{data.date}</p>
          <h2 className="mt-1 font-display text-2xl font-bold">{tt("Five questions. About three minutes.", "Таван асуулт. Ойролцоогоор гурван минут.")}</h2>
          <p className="mt-3 text-sm text-muted">{tt("Logic, number sequence, visual pattern, memory, and one timed exercise. You can only attempt it once per day; solutions are shown afterwards.", "Логик, тооны цуваа, дүрсэн хэв маяг, ой болон нэг хугацаатай дасгал. Өдөрт нэг л удаа өгнө; дараа нь бодолтыг харуулна.")}</p>
          {data.weekly && <p className="mt-3 text-xs text-muted">{tt("This week", "Энэ 7 хоног")}: {data.weekly.done}/{data.weekly.target}</p>}
          <button className="btn btn-primary mt-6" onClick={() => { setShown({ [data.questions[0].id]: Date.now() }); setStarted(true); }}>{tt("Start", "Эхлэх")}</button>
        </div>
      );

    const stimLeft = q?.stimulus && q.stimulusSec ? q.stimulusSec * 1000 - (now - (shown[q.id] ?? now)) : 0;
    return q ? (
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted"><span>{tt("Question", "Асуулт")} {idx + 1} / {data!.questions.length}</span><span className="rounded-full border border-line px-2.5 py-0.5">{t(`cat.${q.category}` as Key)}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line"><motion.div className="h-full bg-gradient-to-r from-violet to-cyan" animate={{ width: `${((idx + 1) / data!.questions.length) * 100}%` }} /></div>
        <AnimatePresence mode="wait">
          <motion.div key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card mt-4 p-5 sm:p-7">
            {left !== null && <p className={`mb-3 text-right text-xs tabular-nums ${left < 4000 ? "text-rose-700 dark:text-rose-400" : "text-muted"}`}>{Math.max(0, Math.ceil(left / 1000))}s</p>}
            {q.stimulus && (
              <div className="mb-4 rounded-xl border border-line bg-deep p-4 text-center">
                {stimLeft > 0 ? (<><p className="mb-1 text-xs uppercase tracking-wider text-cyan-fg">{t("t.memorize")}</p>{q.stimulus.text && <p className="font-display text-2xl font-semibold tracking-wider">{mn && q.stimulusMn ? q.stimulusMn : q.stimulus.text}</p>}{q.stimulus.fig && <div className="mx-auto w-fit"><FigureView fig={q.stimulus.fig} size={130} /></div>}</>) : <p className="py-3 text-sm text-muted">{t("t.hidden")}</p>}
              </div>
            )}
            {q.stem && <div className="mb-4"><StemView stem={q.stem} /></div>}
            <h2 className="font-display text-lg font-semibold">{mn && q.promptMn ? q.promptMn : q.prompt}</h2>
            <div className={`mt-5 grid gap-3 ${q.options.some((o) => o.figure) || q.options.length === 4 ? "grid-cols-2" : "sm:grid-cols-2"}`} role="radiogroup" aria-label={mn && q.promptMn ? q.promptMn : q.prompt}>
              {q.options.map((o, i) => {
                const chosen = picks[q.id] === o.id;
                return (
                  <button key={o.id} role="radio" aria-checked={chosen} onClick={() => setPicks((p) => ({ ...p, [q.id]: o.id }))} className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${chosen ? "border-violet bg-violet/15" : "border-line bg-deep hover:border-violet/60"}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${chosen ? "bg-violet-700 text-white" : "bg-card text-muted"}`}>{i + 1}</span>
                    {o.figure ? <span className="mx-auto"><FigureView fig={o.figure} size={72} /></span> : <span className="font-medium">{mn && o.labelMn ? o.labelMn : o.label}</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button className="btn btn-primary" disabled={busy} onClick={() => advance({ ...picks, [q.id]: picks[q.id] ?? null })}>{idx === data!.questions.length - 1 ? tt("Finish", "Дуусгах") : t("t.next")}</button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    ) : null;
  };

  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt("Daily challenge", "Өдрийн сорилт")}</h1>
        <div className="mt-6">{body()}</div>
        {history.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">{tt("Challenge history", "Сорилтын түүх")}</h2>
            <ul className="card mt-4 divide-y divide-line text-sm">
              {history.map((h) => (<li key={h.date} className="flex items-center justify-between px-5 py-3"><span>{h.date}</span><span className="text-muted">{h.correct}/{h.total} · <span className="font-semibold text-violet-fg">+{h.xp} XP</span></span></li>))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
