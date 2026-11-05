"use client";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import {
  Activity, ArrowRight, Award, BrainCircuit, Brain, Clock, Compass, Flame, Gauge, Languages, Layers, ListChecks, Lock, Radar,
  ShieldCheck, SlidersHorizontal, Sparkles, Star, Target, Timer, Trophy, MemoryStick,
} from "lucide-react";
import { useApp } from "../Providers";
import { HeroVisual } from "./HeroVisual";
import { SampleQuestions } from "./SampleQuestions";
import { Faq, type FaqItem } from "./Faq";
import { Section, reveal } from "./parts";
import { DOMAINS, DOMAIN_SHORT, type Domain } from "./domains";
import type { Key } from "@/lib/i18n";

// The charting library is only needed below the fold, so it is loaded lazily.
const ExampleRadar = dynamic(() => import("./ExampleRadar"), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-xl bg-deep" aria-hidden="true" /> });

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.11, delayChildren: 0.05 } } };
const rise: Variants = { hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } };

const vars = (c1: string, c2: string) => ({ "--c1": c1, "--c2": c2 }) as CSSProperties;

// A few fixed points of light for the hero (computed, not random, so server and browser render the same).
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  x: ((i * 37.7) % 100).toFixed(1),
  y: ((i * 61.8 + 11) % 100).toFixed(1),
  s: 1.5 + (i % 3),
  d: ((i % 7) * 0.9).toFixed(1),
}));

type Featured = { slug: string; en: string; mn: string; de: string; dm: string; mins: number; count: number; icon: typeof Layers; c1: string; c2: string; cats: Domain["k"][] | "all" };
const FEATURED: Featured[] = [
  { slug: "full-battery", en: "Full Cognitive Battery", mn: "Бүрэн танин мэдэхүйн багц", de: "Balanced across all seven domains", dm: "Долоон чадварыг тэнцвэртэй хамарна", mins: 35, count: 28, icon: Layers, c1: "var(--blue)", c2: "var(--mag)", cats: "all" },
  { slug: "reasoning-core", en: "Reasoning Core", mn: "Сэтгэлгээний цөм", de: "Logical, abstract and numerical", dm: "Логик, хийсвэр, тооллын", mins: 20, count: 18, icon: BrainCircuit, c1: "var(--violet)", c2: "var(--cyan)", cats: ["logical", "abstract", "numerical"] },
  { slug: "memory-speed", en: "Memory & Speed", mn: "Ой ба хурд", de: "Working memory and processing speed", dm: "Ажлын ой ба боловсруулах хурд", mins: 10, count: 12, icon: Gauge, c1: "var(--mag)", c2: "var(--blue)", cats: ["memory", "speed"] },
  { slug: "quick-check", en: "Quick Check", mn: "Хурдан шалгалт", de: "Ten adaptive questions", dm: "Арван дасан зохицох асуулт", mins: 5, count: 10, icon: Timer, c1: "var(--cyan)", c2: "var(--violet)", cats: "all" },
];

// The XP is each achievement's real reward; the level (1-4 stars) follows from it.
const BADGES = [
  { icon: Sparkles, en: "First Assessment", mn: "Анхны тест", xp: 50, c1: "var(--cyan)", c2: "var(--blue)" },
  { icon: Brain, en: "Logical Thinker", mn: "Логик сэтгэгч", xp: 100, c1: "var(--blue)", c2: "var(--violet)" },
  { icon: MemoryStick, en: "Memory Champion", mn: "Ойн аварга", xp: 100, c1: "var(--blue)", c2: "var(--violet)" },
  { icon: Target, en: "Perfect Accuracy", mn: "Төгс нарийвчлал", xp: 150, c1: "var(--violet)", c2: "var(--mag)" },
  { icon: Compass, en: "Cognitive Explorer", mn: "Танин мэдэхүйн судлаач", xp: 150, c1: "var(--violet)", c2: "var(--mag)" },
  { icon: Flame, en: "Seven-Day Streak", mn: "7 хоногийн цуваа", xp: 200, c1: "var(--mag)", c2: "var(--lav)" },
];
const levelOf = (xp: number) => (xp >= 200 ? 4 : xp >= 150 ? 3 : xp >= 100 ? 2 : 1);

const FAQ: FaqItem[] = [
  {
    q: { en: "Is this a real IQ test?", mn: "Энэ жинхэнэ IQ тест мөн үү?" },
    a: {
      en: "No. INTELLIQ is a cognitive practice and self-reflection tool. A valid IQ score needs a professionally administered, norm-referenced test. We never present an invented IQ number.",
      mn: "Үгүй. INTELLIQ нь танин мэдэхүйн дасгал болон өөрийгөө таних хэрэгсэл. Хүчинтэй IQ оноо нь мэргэжлийн хүн хөтөлсөн, норм-д суурилсан тестээр гарна. Бид зохиомол IQ тоо харуулдаггүй.",
    },
  },
  {
    q: { en: "How does adaptive difficulty work?", mn: "Хүндрэл хэрхэн дасан зохицдог вэ?" },
    a: {
      en: "A staircase rule moves difficulty up after two consecutive correct answers and down after an incorrect one, while keeping coverage across categories. Scores are weighted by the difficulty of each question you actually saw.",
      mn: "Дараалан хоёр зөв хариулбал хүндрэл нэмэгдэж, нэг буруу хариулбал буурна. Мөн ангилал бүрийг тэнцвэртэй хамарна. Оноо нь таны харсан асуулт бүрийн хүндрэлээр жинлэгдэнэ.",
    },
  },
  {
    q: { en: "Do I need an account?", mn: "Бүртгэл шаардлагатай юу?" },
    a: {
      en: "No. You can take an assessment as a guest. An account saves history, XP, achievements and reports.",
      mn: "Үгүй. Зочноор тест өгч болно. Бүртгэл нь түүх, XP, амжилт, тайланг хадгална.",
    },
  },
  {
    q: { en: "Are my answers checked fairly?", mn: "Хариултыг шударгаар шалгадаг уу?" },
    a: {
      en: "Answer keys stay on the server and are never sent to your browser during a test. Scores are computed server-side.",
      mn: "Зөв хариулт сервер дээр хадгалагдаж, тест үед хөтөч рүү хэзээ ч илгээгддэггүй. Оноог сервер тооцдог.",
    },
  },
  {
    q: { en: "Can I hide from leaderboards?", mn: "Тэргүүлэгчдийн жагсаалтаас нуугдаж болох уу?" },
    a: {
      en: "Yes. Rankings are opt-in and you can hide your profile at any time. We never expose personal information publicly.",
      mn: "Тийм. Жагсаалт нь сайн дурын бөгөөд профайлаа хүссэн үедээ нууж болно. Хувийн мэдээллийг олон нийтэд ил болгохгүй.",
    },
  },
];

// Clearly an illustration, not user data. Same order as DOMAINS.
const EXAMPLE = [78, 64, 71, 82, 58, 69, 75];

export function Landing() {
  const { t, tt, lang } = useApp();
  const example = DOMAINS.map((d, i) => ({ name: DOMAIN_SHORT[d.k][lang], value: EXAMPLE[i] }));
  const exampleLabel = lang === "en" ? "Illustrative example profile — not real user data" : "Жишээ профайл — жинхэнэ хэрэглэгчийн өгөгдөл биш";
  const best = example.reduce((a, b) => (b.value > a.value ? b : a));
  const worst = example.reduce((a, b) => (b.value < a.value ? b : a));
  const avg = Math.round(example.reduce((s, e) => s + e.value, 0) / example.length);

  const proof = [
    { icon: Brain, text: tt("7 cognitive domains", "7 танин мэдэхүйн чадвар") },
    { icon: Activity, text: tt("Adaptive difficulty", "Дасан зохицох хүндрэл") },
    { icon: ShieldCheck, text: tt("Scored on the server", "Оноог сервер тооцдог") },
    { icon: Languages, text: tt("English & Mongolian", "Англи ба Монгол хэл") },
  ];
  const steps = [
    { icon: ListChecks, c1: "var(--blue)", c2: "var(--violet)" },
    { icon: SlidersHorizontal, c1: "var(--violet)", c2: "var(--mag)" },
    { icon: Radar, c1: "var(--mag)", c2: "var(--cyan)" },
  ];
  const pillars = [
    { icon: Lock, text: tt("Answer keys never leave the server", "Зөв хариулт серверээс хэзээ ч гардаггүй") },
    { icon: Activity, text: tt("Difficulty adapts to you", "Хүндрэл танд дасан зохицно") },
    { icon: ShieldCheck, text: tt("No invented IQ score", "Зохиомол IQ оноо байхгүй") },
  ];

  return (
    <main id="main">
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-40 top-6 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--blue)_26%,transparent),transparent)]" />
          <div className="absolute -right-32 top-28 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--mag)_22%,transparent),transparent)]" />
          {SPARKS.map((p, i) => (
            <span key={i} className="twinkle absolute rounded-full bg-lav" style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDelay: `${p.d}s` }} />
          ))}
        </div>
        <div className="relative mx-auto grid min-h-[100svh] max-w-7xl items-center gap-10 px-4 pb-20 pt-28 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.span variants={rise} className="glass inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-medium text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan" style={{ animation: "pulse-ring 2.4s ease-out infinite" }} />
                <span className="relative h-2 w-2 rounded-full bg-cyan" />
              </span>
              {t("hero.badge")}
            </motion.span>
            <motion.h1 variants={rise} className="mt-7 text-balance font-display text-[clamp(2.6rem,7.4vw,5.6rem)] font-bold leading-[1.02] tracking-tight">
              {t("hero.title1")} <span className="grad-text-flow">{t("hero.title2")}</span>
            </motion.h1>
            <motion.p variants={rise} className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted sm:text-xl">{t("hero.sub")}</motion.p>
            <motion.div variants={rise} className="mt-9 flex flex-wrap gap-3">
              <Link href="/assessments/quick-check" data-magnetic className="btn btn-primary btn-lg group">
                {t("hero.cta1")} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/assessments" data-magnetic className="btn btn-ghost btn-lg">{t("hero.cta2")}</Link>
            </motion.div>
            <motion.p variants={rise} className="mt-6 flex items-center gap-2 text-sm text-muted">
              <Clock size={16} className="shrink-0 text-cyan-fg" /> {t("hero.meta")}
            </motion.p>
            <motion.ul variants={rise} className="mt-10 grid max-w-xl grid-cols-2 gap-3">
              {proof.map((p) => (
                <li key={p.text} className="flex items-center gap-2.5 rounded-xl border border-line bg-[var(--card-glass)] px-3.5 py-2.5 text-sm">
                  <p.icon size={16} className="shrink-0 text-violet-fg" />
                  <span>{p.text}</span>
                </li>
              ))}
            </motion.ul>
          </motion.div>
          <HeroVisual />
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <Section id="how" eyebrow={tt("Process", "Явц")} title={t("how.title")} sub={t("how.sub")}>
        <div className="relative">
          {/* the line that joins the three steps: horizontal on wide screens, vertical on narrow ones */}
          <div className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-8 hidden h-px md:block" aria-hidden="true">
            <div className="h-full w-full bg-gradient-to-r from-blue via-violet to-mag opacity-60" />
            <span className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-cyan shadow-[0_0_12px_var(--cyan)]" style={{ animation: "travel 5s linear infinite" }} />
          </div>
          <div className="pointer-events-none absolute bottom-8 left-8 top-8 w-px bg-gradient-to-b from-blue via-violet to-mag opacity-50 md:hidden" aria-hidden="true" />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
            {([1, 2, 3] as const).map((n, i) => {
              const s = steps[i];
              return (
                <motion.li key={n} {...reveal(i)} className="flex gap-4 md:flex-col md:items-center md:text-center">
                  <span
                    className="relative z-10 grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-transparent font-display text-xl font-bold shadow-[0_0_34px_-6px_var(--c1)]"
                    style={{ ...vars(s.c1, s.c2), background: "linear-gradient(var(--bg-deep), var(--bg-deep)) padding-box, linear-gradient(135deg, var(--c1), var(--c2)) border-box" }}
                  >
                    0{n}
                  </span>
                  <div className="panel gb spot group flex-1 p-6 md:w-full" style={vars(s.c1, s.c2)}>
                    <motion.div
                      className="grid h-12 w-12 place-items-center rounded-2xl border border-line md:mx-auto"
                      style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--c1) 26%, transparent), color-mix(in srgb, var(--c2) 12%, transparent))", color: "var(--c1)" }}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3.4 + i * 0.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <s.icon size={22} />
                    </motion.div>
                    <h3 className="mt-4 font-display text-lg font-semibold">{t(`how.${n}.t` as Key)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{t(`how.${n}.d` as Key)}</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </Section>

      {/* ---------------- Seven domains ---------------- */}
      <Section id="categories" band eyebrow={tt("Domains", "Чадварууд")} title={t("cat.title")} sub={t("cat.sub")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {DOMAINS.map((d, i) => (
            <motion.div key={d.k} {...reveal(i)} className={`${d.span} ${i === 0 ? "sm:col-span-2" : ""}`}>
              <article className="panel gb spot group h-full min-h-[18.5rem] p-6" style={vars(d.c1, d.c2)}>
                <div className={`pointer-events-none absolute -bottom-2 -right-1 max-w-[17rem] opacity-70 transition duration-500 ease-out group-hover:-rotate-2 group-hover:scale-105 group-hover:opacity-100 ${i === 0 ? "w-[46%]" : "w-[48%]"}`} aria-hidden="true">{d.art}</div>
                <div className="relative flex items-start justify-between">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-2xl border border-line"
                    style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--c1) 28%, transparent), color-mix(in srgb, var(--c2) 14%, transparent))", color: "var(--c1)" }}
                  >
                    <d.icon size={22} />
                  </div>
                  <span className="font-display text-sm font-semibold tabular-nums text-muted">0{i + 1}</span>
                </div>
                <h3 className="relative mt-5 font-display text-xl font-semibold">{t(`cat.${d.k}` as Key)}</h3>
                <p className="relative mt-1.5 max-w-[16rem] text-sm leading-relaxed text-muted">{t(`cat.${d.k}.d` as Key)}</p>
              </article>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---------------- Featured assessments ---------------- */}
      <Section id="assessments" eyebrow={tt("Assessments", "Тестүүд")} title={t("feat.title")} sub={t("feat.sub")}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED.map((a, i) => (
            <motion.div key={a.slug} {...reveal(i)}>
              <article className="panel gb spot group flex h-full flex-col p-5" style={vars(a.c1, a.c2)}>
                <div
                  className="relative grid h-28 place-items-center overflow-hidden rounded-xl border border-line"
                  style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--c1) 30%, transparent), color-mix(in srgb, var(--c2) 12%, transparent) 70%)" }}
                  aria-hidden="true"
                >
                  <span className="absolute h-36 w-36 rounded-full border border-white/10 [background:radial-gradient(closest-side,color-mix(in_srgb,var(--c2)_35%,transparent),transparent)]" />
                  <span className="absolute h-20 w-20 rounded-full border border-white/10 transition-transform duration-700 group-hover:scale-125" />
                  <a.icon size={34} className="relative transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:rotate-6" style={{ color: "var(--c1)" }} />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{a[lang]}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{lang === "en" ? a.de : a.dm}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {a.cats === "all" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-deep/60 px-2.5 py-1 text-[11px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-blue to-mag" />{tt("All seven domains", "Долоон чадвар бүгд")}
                    </span>
                  ) : (
                    a.cats.map((k) => {
                      const d = DOMAINS.find((x) => x.k === k)!;
                      return (
                        <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-deep/60 px-2.5 py-1 text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.c1 }} />{DOMAIN_SHORT[k][lang]}
                        </span>
                      );
                    })
                  )}
                </div>
                <p className="mt-4 flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><Clock size={14} className="text-cyan-fg" />~{a.mins} {tt("min", "мин")}</span>
                  <span aria-hidden="true">·</span>
                  <span>{a.count} {tt("questions", "асуулт")}</span>
                </p>
                <Link href={`/assessments/${a.slug}`} className={`btn mt-5 w-full group/cta ${i === 0 ? "btn-primary" : "btn-ghost"}`}>
                  {t("hero.cta1")} <ArrowRight size={16} className="transition-transform group-hover/cta:translate-x-1" />
                </Link>
              </article>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---------------- Sample questions ---------------- */}
      <Section band eyebrow={tt("Try it", "Туршаад үз")} title={t("sample.title")} sub={t("sample.sub")}>
        <motion.div {...reveal()}>
          <SampleQuestions />
        </motion.div>
      </Section>

      {/* ---------------- Insights ---------------- */}
      <Section eyebrow={tt("Insights", "Дүн шинжилгээ")} title={t("analytics.title")} sub={t("analytics.sub")}>
        <div className="grid items-stretch gap-6 lg:grid-cols-[1.25fr_1fr]">
          <motion.div {...reveal()} className="panel gb p-4 sm:p-8" style={vars("var(--cyan)", "var(--mag)")}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{tt("Cognitive radar", "Танин мэдэхүйн радар")}</span>
              <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">{tt("Example", "Жишээ")}</span>
            </div>
            <div className="h-72 w-full drop-shadow-[0_0_22px_rgba(146,92,255,0.35)] sm:h-[26rem]">
              <ExampleRadar data={example} />
            </div>
            <p className="mt-2 text-center text-xs text-muted">{exampleLabel}</p>
          </motion.div>

          <div className="flex flex-col gap-5">
            <motion.dl {...reveal(1)} className="panel divide-y divide-line">
              {[
                { l: tt("Strongest domain", "Хамгийн хүчтэй чадвар"), v: `${best.name} · ${best.value}`, tone: "grad-text-cog" },
                { l: tt("Average", "Дундаж"), v: `${avg}`, tone: "grad-text" },
                { l: tt("Room to grow", "Хөгжүүлэх чадвар"), v: `${worst.name} · ${worst.value}`, tone: "grad-text" },
              ].map((s) => (
                <div key={s.l} className="flex items-center justify-between gap-4 px-5 py-4">
                  <dt className="text-sm text-muted">{s.l}</dt>
                  <dd className={`font-display text-xl font-bold ${s.tone}`}>{s.v}</dd>
                </div>
              ))}
            </motion.dl>
            <motion.div {...reveal(2)} className="panel flex-1 p-5">
              <p className="mb-4 text-sm font-semibold">{tt("Score by domain", "Чадвар тус бүрийн оноо")}</p>
              <ul className="space-y-3.5">
                {example.map((e, i) => {
                  const d = DOMAINS[i];
                  // The row is what scrolls into view (a zero-width bar would never intersect); it starts the bar's growth.
                  return (
                    <motion.li key={d.k} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }}>
                      <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">{e.name}</span><span className="font-semibold tabular-nums">{e.value}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                        <motion.div
                          className="h-full origin-left rounded-full"
                          style={{ width: "100%", background: `linear-gradient(90deg, ${d.c1}, ${d.c2})` }}
                          variants={{ hidden: { scaleX: 0 }, show: { scaleX: e.value / 100, transition: { duration: 1, delay: 0.1 + i * 0.07, ease: EASE } } }}
                        />
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ---------------- Achievements ---------------- */}
      <Section band eyebrow={tt("Progress", "Ахиц дэвшил")} title={t("ach.title")} sub={t("ach.sub")}>
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
          {BADGES.map((b, i) => {
            const level = levelOf(b.xp);
            return (
              <motion.div key={b.en} {...reveal(i)}>
                <div className="panel gb spot group flex h-full flex-col items-center p-6 text-center" style={vars(b.c1, b.c2)}>
                  <div className="relative h-20 w-20">
                    <span
                      className="absolute inset-0 rounded-full shadow-[0_0_34px_-6px_var(--c1)] transition-transform duration-[900ms] ease-out group-hover:rotate-180"
                      style={{ background: "conic-gradient(from 0deg, var(--c1), var(--c2), var(--c1))" }}
                      aria-hidden="true"
                    />
                    <span className="absolute inset-[3px] grid place-items-center rounded-full bg-[var(--bg-deep)]">
                      <b.icon size={30} className="transition-transform duration-300 group-hover:scale-110" style={{ color: "var(--c1)" }} />
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold">{b[lang]}</p>
                  <div className="mt-2 flex items-center gap-1" aria-hidden="true">
                    {[1, 2, 3, 4].map((s) => (
                      <Star key={s} size={12} className={s <= level ? "fill-current" : "opacity-30"} style={{ color: "var(--c1)" }} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs font-medium tabular-nums text-muted">+{b.xp} XP</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* ---------------- Methodology ---------------- */}
      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6 sm:py-28">
        <motion.div {...reveal()} className="panel gb grid gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-[1.3fr_1fr]" style={vars("var(--cyan)", "var(--violet)")}>
          <div className="relative">
            <span className="eyebrow">{tt("Methodology", "Арга зүй")}</span>
            <div className="mt-5 flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--cyan) 26%, transparent), color-mix(in srgb, var(--violet) 14%, transparent))", color: "var(--cyan)" }}>
                <ShieldCheck size={24} />
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("trust.title")}</h2>
                <p className="mt-3 leading-relaxed text-muted">{t("trust.body")}</p>
              </div>
            </div>
          </div>
          <ul className="space-y-3 self-center">
            {pillars.map((p) => (
              <li key={p.text} className="flex items-center gap-3 rounded-xl border border-line bg-deep/50 px-4 py-3.5 text-sm font-medium">
                <p.icon size={18} className="shrink-0 text-cyan-fg" />{p.text}
              </li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <Section id="faq" band eyebrow={tt("Questions", "Асуултууд")} title={t("faq.title")}>
        <Faq items={FAQ} />
      </Section>

      {/* ---------------- Final call to action ---------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pb-32">
        <motion.div {...reveal()} className="panel gb relative overflow-hidden px-6 py-16 text-center sm:py-24" style={{ ...vars("var(--blue)", "var(--mag)"), borderRadius: "2rem" }}>
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_50%_0%,color-mix(in_srgb,var(--violet)_38%,transparent),transparent_70%),radial-gradient(40%_60%_at_100%_100%,color-mix(in_srgb,var(--mag)_26%,transparent),transparent),radial-gradient(40%_60%_at_0%_100%,color-mix(in_srgb,var(--blue)_28%,transparent),transparent)]" />
            <div className="atmos-grid opacity-70" />
            <svg viewBox="0 0 600 300" className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-60" fill="none">
              <g className="spin-cw" style={{ animationDuration: "140s" }}>
                <circle cx="300" cy="150" r="130" stroke="var(--violet)" strokeOpacity=".35" strokeDasharray="2 9" strokeLinecap="round" />
                <circle cx="300" cy="150" r="210" stroke="var(--blue)" strokeOpacity=".25" />
                <circle cx="430" cy="150" r="5" style={{ fill: "var(--cyan)" }} />
                <circle cx="190" cy="258" r="4" style={{ fill: "var(--mag)" }} />
              </g>
            </svg>
            {["∑", "π", "∞", "√"].map((s, i) => (
              <span key={s} className="float absolute font-display text-3xl font-semibold text-lav/60" style={{ left: `${[8, 88, 80, 14][i]}%`, top: `${[22, 16, 72, 74][i]}%`, animationDelay: `${i * 0.9}s` }}>{s}</span>
            ))}
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-balance font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              {tt("Ready to see how your", "Оюун ухаан чинь хэрхэн ажилладгийг")} <span className="grad-text-flow">{tt("mind works?", "харахад бэлэн үү?")}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-muted sm:text-lg">{t("hero.meta")}</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/assessments/quick-check" data-magnetic className="btn btn-primary btn-lg group">
                <Award size={18} /> {t("hero.cta1")} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/assessments" data-magnetic className="btn btn-ghost btn-lg"><Trophy size={18} className="text-violet-fg" /> {t("hero.cta2")}</Link>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
