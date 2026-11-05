"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, BookmarkCheck, Clock, Layers, Play, ShieldAlert } from "lucide-react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { useApp } from "../Providers";
import type { Key } from "@/lib/i18n";

export type AssessmentItem = {
  slug: string;
  titleEn: string; titleMn: string;
  descEn: string; descMn: string;
  questionCount: number;
  durationSec: number | null;
};
export type CategoryItem = { slug: string; nameEn: string; nameMn: string };

const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

function Meta({ a }: { a: AssessmentItem }) {
  const { t } = useApp();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5"><Layers size={14} className="text-cyan-fg" /> {a.questionCount} {t("as.questions")}</span>
      <span className="flex items-center gap-1.5">
        <Clock size={14} className="text-cyan-fg" />
        {a.durationSec ? `${Math.round(a.durationSec / 60)} ${t("as.min")}` : t("as.untimed")}
      </span>
    </div>
  );
}

export function AssessmentsView({ items }: { items: AssessmentItem[] }) {
  const { t, lang } = useApp();
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        <motion.div {...fade} className="mb-10 max-w-2xl">
          <h1 className="font-display text-4xl font-bold tracking-tight">{t("as.title")}</h1>
          <p className="mt-3 text-muted">{t("as.sub")}</p>
        </motion.div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => (
            <motion.div key={a.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -4 }} className="card flex flex-col p-6">
              <h2 className="font-display text-lg font-semibold">{lang === "en" ? a.titleEn : a.titleMn}</h2>
              <p className="mt-2 flex-1 text-sm text-muted">{lang === "en" ? a.descEn : a.descMn}</p>
              <div className="mt-4"><Meta a={a} /></div>
              <Link href={`/assessments/${a.slug}`} className="btn btn-primary mt-5 w-full">{t("as.view")}</Link>
            </motion.div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

export function OverviewView({
  a, categories, resumeId, signedIn, bookmarked: bm,
}: { a: AssessmentItem; categories: CategoryItem[]; resumeId: string | null; signedIn: boolean; bookmarked: boolean }) {
  const { t, tt, lang } = useApp();
  const [bookmarked, setBookmarked] = useState(bm);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function toggleBookmark() {
    const r = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: a.slug }) });
    if (r.ok) setBookmarked((await r.json()).bookmarked);
  }

  async function begin() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: a.slug }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.push(`/test/${d.sessionId}`);
    } catch {
      setErr(t("t.error"));
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6">
        <Link href="/assessments" className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> {t("ov.back")}</Link>
        <motion.div {...fade}>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{lang === "en" ? a.titleEn : a.titleMn}</h1>
          <p className="mt-3 text-muted">{lang === "en" ? a.descEn : a.descMn}</p>
          <div className="mt-4"><Meta a={a} /></div>
        </motion.div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="card p-6">
            <h2 className="font-semibold">{t("ov.cats")}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {categories.map((c) => (
                <li key={c.slug} className="rounded-full border border-line bg-deep px-3 py-1 text-sm">{lang === "en" ? c.nameEn : c.nameMn}</li>
              ))}
            </ul>
            <h2 className="mt-6 font-semibold">{t("ov.diff")}</h2>
            <p className="mt-2 text-sm text-muted">{t("ov.diff.d")}</p>
          </section>
          <section className="card p-6">
            <h2 className="font-semibold">{t("ov.instr")}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
              {(["ov.i1", "ov.i2", "ov.i3", "ov.i4", "ov.i5", "ov.i6"] as Key[]).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ol>
          </section>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-deep p-4 text-sm text-muted">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-cyan-fg" />
          <p>{t("ov.disclaimer")}</p>
        </div>
        {!signedIn && <p className="mt-3 text-sm text-muted">{t("ov.guest")} <Link href="/register" className="text-violet-fg underline underline-offset-2 hover:no-underline">{t("nav.signup")}</Link></p>}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={begin} disabled={busy} className="btn btn-primary">
            <Play size={18} /> {resumeId ? t("ov.resume") : t("ov.begin")}
          </button>
          {signedIn && (
            <button onClick={() => void toggleBookmark()} aria-pressed={bookmarked} className="btn btn-ghost">
              {bookmarked ? <BookmarkCheck size={18} className="text-violet-fg" /> : <Bookmark size={18} />} {bookmarked ? tt("Bookmarked", "Хадгалсан") : tt("Bookmark", "Хадгалах")}
            </button>
          )}
          {err && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{err}</p>}
        </div>
      </main>
      <Footer />
    </>
  );
}
