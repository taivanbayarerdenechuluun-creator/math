"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { useApp } from "../Providers";

type Q = { cat: { en: string; mn: string }; prompt: { en: string; mn: string }; options: { en: string; mn: string }[]; answer: number };

// Landing-page demo questions only. The real bank lives in the database and
// answers are verified on the server; these are public by design.
const SAMPLES: Q[] = [
  {
    cat: { en: "Numerical", mn: "Тооллын" },
    prompt: { en: "What comes next?  2, 6, 18, 54, ?", mn: "Дараагийн тоо юу вэ?  2, 6, 18, 54, ?" },
    options: [
      { en: "108", mn: "108" }, { en: "162", mn: "162" }, { en: "148", mn: "148" }, { en: "72", mn: "72" },
    ],
    answer: 1,
  },
  {
    cat: { en: "Verbal", mn: "Хэл зүйн" },
    prompt: { en: "Book is to Reading as Fork is to …", mn: "Ном нь Унших-тай адил Сэрээ нь …" },
    options: [
      { en: "Eating", mn: "Идэх" }, { en: "Cooking", mn: "Хоол хийх" }, { en: "Metal", mn: "Төмөр" }, { en: "Kitchen", mn: "Гал тогоо" },
    ],
    answer: 0,
  },
  {
    cat: { en: "Logical", mn: "Логик" },
    prompt: {
      en: "All Bloops are Razzies. All Razzies are Lazzies. Which statement must be true?",
      mn: "Бүх Блүүп нь Раззи. Бүх Раззи нь Лаззи. Аль мэдэгдэл заавал үнэн вэ?",
    },
    options: [
      { en: "All Bloops are Lazzies", mn: "Бүх Блүүп нь Лаззи" },
      { en: "All Lazzies are Bloops", mn: "Бүх Лаззи нь Блүүп" },
      { en: "No Bloops are Lazzies", mn: "Ямар ч Блүүп Лаззи биш" },
      { en: "Some Razzies are not Lazzies", mn: "Зарим Раззи нь Лаззи биш" },
    ],
    answer: 0,
  },
];

const LETTERS = ["A", "B", "C", "D"];

export function SampleQuestions() {
  const { t, tt, lang } = useApp();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState<number[]>([]);
  const q = SAMPLES[i];
  const right = picked === q.answer;

  function go(n: number) {
    setI(n);
    setPicked(null);
  }
  function pick(n: number) {
    setPicked(n);
    if (n === q.answer) setSolved((s) => (s.includes(i) ? s : [...s, i]));
  }

  return (
    <div className="panel gb mx-auto max-w-3xl p-5 sm:p-8" style={{ "--c1": "var(--blue)", "--c2": "var(--mag)" } as React.CSSProperties}>
      {/* a light behind the "screen" */}
      <div className="pointer-events-none absolute inset-x-0 -top-16 h-40 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--violet)_26%,transparent),transparent)]" aria-hidden="true" />

      <div className="relative">
        <div className="flex items-center justify-between gap-4 text-xs text-muted">
          <span className="rounded-full border border-line bg-deep px-3 py-1 font-medium text-ink">{q.cat[lang]}</span>
          <span className="tabular-nums">{i + 1} / {SAMPLES.length}</span>
        </div>

        {/* progress: one segment per question, lit when solved, outlined on the current one */}
        <div className="mt-4 flex gap-2" aria-hidden="true">
          {SAMPLES.map((_, n) => (
            <div key={n} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <motion.div
                className="h-full origin-left rounded-full bg-gradient-to-r from-blue via-violet to-mag"
                initial={false}
                animate={{ scaleX: solved.includes(n) ? 1 : n === i ? 0.18 : 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <h3 className="mt-7 text-balance font-display text-xl font-semibold leading-snug sm:text-2xl">{q.prompt[lang]}</h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={q.prompt[lang]}>
              {q.options.map((o, n) => {
                const chosen = picked === n;
                const good = chosen && n === q.answer;
                const bad = chosen && n !== q.answer;
                const state = good
                  ? "border-emerald-400/80 bg-emerald-400/10 shadow-[0_0_34px_-10px_rgba(52,211,153,0.8)]"
                  : bad
                    ? "border-rose-400/80 bg-rose-400/10"
                    : "border-line bg-deep/70 hover:-translate-y-0.5 hover:border-violet hover:bg-violet/10";
                return (
                  <motion.button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    onClick={() => pick(n)}
                    animate={bad ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`group flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 ${state}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-bold transition-colors ${good ? "border-emerald-400 bg-emerald-400/20 text-emerald-700 dark:text-emerald-300" : bad ? "border-rose-400 bg-rose-400/20 text-rose-700 dark:text-rose-300" : "border-line text-muted group-hover:border-violet group-hover:text-violet-fg"}`}>{LETTERS[n]}</span>
                    <span className="flex-1">{o[lang]}</span>
                    <AnimatePresence>
                      {chosen && (
                        <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
                          {good ? <Check size={20} className="text-emerald-700 dark:text-emerald-400" /> : <X size={20} className="text-rose-700 dark:text-rose-400" />}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex min-h-11 flex-wrap items-center justify-between gap-3">
          <p className={`text-sm font-semibold ${picked === null ? "invisible" : right ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`} role="status">
            {right ? t("sample.correct") : t("sample.wrong")}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {SAMPLES.map((_, n) => (
                <button key={n} type="button" onClick={() => go(n)} aria-label={tt(`Question ${n + 1}`, `Асуулт ${n + 1}`)} aria-current={n === i} className={`h-2.5 rounded-full transition-all ${n === i ? "w-7 bg-violet" : "w-2.5 bg-line hover:bg-muted"}`} />
              ))}
            </div>
            <button type="button" onClick={() => go((i + 1) % SAMPLES.length)} className="btn btn-ghost !min-h-10 !px-4 text-sm">
              {tt("Next question", "Дараагийн асуулт")} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
