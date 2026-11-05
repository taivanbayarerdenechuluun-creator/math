"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { useApp } from "../Providers";
import type { Key } from "@/lib/i18n";

const RadarPanel = dynamic(() => import("./RadarPanel").then((m) => m.RadarPanel), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-xl bg-deep" /> });

export type SharedData = {
  titleEn: string; titleMn: string; date: string; performance: number; accuracy: number; total: number; correct: number;
  categories: { slug: string; total: number; correct: number; performance: number; prev: null }[];
};

export function SharedView({ d }: { d: SharedData }) {
  const { tt, lang, t } = useApp();
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <p className="text-sm text-muted">{tt("Shared INTELLIQ result", "Хуваалцсан INTELLIQ үр дүн")} · {d.date}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{lang === "en" ? d.titleEn : d.titleMn}</h1>
        <section className="card mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-end gap-6">
            <div><p className="font-display text-6xl font-bold">{d.performance}<span className="text-xl text-muted"> /100</span></p><p className="text-sm text-muted">{t("r.perf")}</p></div>
            <div className="text-sm text-muted"><p>{t("r.raw")}: <span className="font-semibold text-ink">{d.correct}/{d.total}</span></p><p>{t("r.accuracy")}: <span className="font-semibold text-ink">{d.accuracy}%</span></p></div>
          </div>
          {d.categories.length >= 3 ? <RadarPanel cats={d.categories} /> : null}
          <ul className="mt-4 space-y-3">
            {d.categories.map((c) => (
              <li key={c.slug}>
                <div className="flex justify-between text-sm"><span>{t(`cat.${c.slug}` as Key)}</span><span className="text-muted">{c.correct}/{c.total} · {c.performance}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" style={{ width: `${c.performance}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-5 rounded-xl border border-line bg-deep p-4 text-sm text-muted">{t("r.limits")}</p>
        <div className="mt-6"><Link href="/assessments" className="btn btn-primary">{tt("Try an assessment", "Тест өгөх")}</Link></div>
      </main>
      <Footer />
    </>
  );
}
