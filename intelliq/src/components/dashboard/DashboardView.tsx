"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowRight, Bookmark, CalendarCheck, Flame, History, Lightbulb, Trophy, Zap } from "lucide-react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { Badge } from "../AchIcon";
import { VerifyNotice } from "../auth/VerifyNotice";
import { useApp } from "../Providers";
import { ACHIEVEMENTS } from "@/lib/gamification";
import type { DashboardData } from "@/lib/dashboard";

const RadarPanel = dynamic(() => import("../results/RadarPanel").then((m) => m.RadarPanel), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-xl bg-deep" aria-hidden="true" />,
});

const day = (iso: string) => iso.slice(0, 10);

function Card({ title, icon, children, className = "" }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`card p-5 sm:p-6 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">{icon}{title}</h2>
      {children}
    </motion.section>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm text-muted">{text}</p>
      <Link href={href} className="btn btn-primary mt-4">{cta}</Link>
    </div>
  );
}

export function DashboardView({ d, unverifiedEmail = null }: { d: DashboardData; unverifiedEmail?: string | null }) {
  const { tt, lang, t } = useApp();
  const title = (a: { titleEn: string; titleMn: string }) => (lang === "en" ? a.titleEn : a.titleMn);
  const nextAch = d.achievements.next && ACHIEVEMENTS.find((a) => a.code === d.achievements.next!.code);

  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6">
        {unverifiedEmail && <VerifyNotice email={unverifiedEmail} />}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm text-muted">{tt("Welcome back", "Тавтай морил")}</p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl"><span className="grad-text">{d.name}</span></h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet to-blue font-display text-lg font-bold text-white">{d.level.level}</div>
              <div className="w-40">
                <div className="flex justify-between text-xs text-muted"><span>{tt("Level", "Түвшин")} {d.level.level}</span><span>{d.level.into}/{d.level.span} XP</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(d.level.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="XP progress">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" initial={{ width: 0 }} animate={{ width: `${d.level.progress * 100}%` }} transition={{ duration: 0.9 }} />
                </div>
              </div>
            </div>
            <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3" title={tt("Consecutive days with activity", "Дараалсан идэвхтэй өдрүүд")}>
              <Flame className={d.streak > 0 ? "text-orange-400" : "text-muted"} />
              <div><p className="font-display text-xl font-bold leading-none">{d.streak}</p><p className="text-xs text-muted">{tt("day streak", "хоногийн цуваа")}</p></div>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <Card title={tt("Latest assessment", "Сүүлийн тест")} className="lg:col-span-2">
            {d.latest ? (
              <div className="grid items-center gap-4 md:grid-cols-[1fr_1.1fr]">
                <div>
                  <p className="text-sm text-muted">{title(d.latest)} · {day(d.latest.createdAt)}</p>
                  <p className="mt-2 font-display text-5xl font-bold">{d.latest.performance}<span className="text-lg text-muted"> /100</span></p>
                  <p className="mt-1 text-sm text-muted">{tt("Cognitive performance", "Танин мэдэхүйн гүйцэтгэл")} · {d.latest.correct}/{d.latest.total} · {d.latest.accuracy}%</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/results/${d.latest.id}`} className="btn btn-primary !min-h-10 text-sm">{tt("Open results", "Үр дүн нээх")} <ArrowRight size={16} /></Link>
                    <Link href="/history" className="btn btn-ghost !min-h-10 text-sm"><History size={16} /> {tt("History & trends", "Түүх, хандлага")}</Link>
                  </div>
                </div>
                {d.latest.categories.length >= 3 ? <RadarPanel cats={d.latest.categories} /> : <p className="text-sm text-muted">{t("r.radar.min")}</p>}
              </div>
            ) : (
              <Empty text={tt("You have not completed an assessment yet. Your cognitive radar will appear here.", "Та тест дуусгаагүй байна. Танин мэдэхүйн радар энд гарна.")} href="/assessments/quick-check" cta={tt("Take the Quick Check", "Хурдан шалгалт өгөх")} />
            )}
          </Card>

          <Card title={tt("Daily challenge", "Өдрийн сорилт")} icon={<CalendarCheck size={18} className="text-cyan-fg" />}>
            <p className="text-sm text-muted">{d.challengeDoneToday ? tt("Done for today. Come back tomorrow to keep your streak.", "Өнөөдөр дууссан. Цувраагаа үргэлжлүүлэхээр маргааш ирээрэй.") : tt("Five short questions: logic, numbers, patterns, memory and speed.", "Таван богино асуулт: логик, тоо, хэв маяг, ой, хурд.")}</p>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted"><span>{tt("Weekly challenge", "7 хоногийн сорилт")}</span><span>{d.weekly.done}/{d.weekly.target}</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${(Math.min(d.weekly.done, d.weekly.target) / d.weekly.target) * 100}%` }} /></div>
              <p className="mt-1 text-xs text-muted">{d.weekly.claimed ? tt("Bonus claimed this week.", "Энэ 7 хоногийн урамшуулал авсан.") : tt(`Complete ${d.weekly.target} daily challenges this week for a bonus.`, `Урамшуулалд энэ 7 хоногт ${d.weekly.target} өдрийн сорилт хий.`)}</p>
            </div>
            <Link href="/daily" className="btn btn-primary mt-5 w-full">{d.challengeDoneToday ? tt("Review solutions", "Бодолтыг харах") : tt("Start today's challenge", "Өнөөдрийн сорилт эхлэх")}</Link>
          </Card>

          <Card title={tt("Achievements", "Амжилтууд")} icon={<Trophy size={18} className="text-violet-fg" />}>
            <p className="text-sm text-muted">{d.achievements.earned} / {d.achievements.total} {tt("unlocked", "нээгдсэн")}</p>
            <div className="mt-3 flex gap-3">
              {d.achievements.recent.length ? d.achievements.recent.map((r) => <Badge key={r.code} code={r.code} size={48} />) : <p className="text-sm text-muted">{tt("Your first badge is one assessment away.", "Таны анхны тэмдэг нэг тестийн зайтай.")}</p>}
            </div>
            {nextAch && d.achievements.next && (
              <div className="mt-4 rounded-xl border border-line bg-deep p-3">
                <p className="text-xs text-muted">{tt("Closest to unlocking", "Нээхэд хамгийн ойр")}</p>
                <p className="mt-0.5 text-sm font-semibold">{lang === "en" ? nextAch.name.en : nextAch.name.mn}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" style={{ width: `${(d.achievements.next.current / d.achievements.next.target) * 100}%` }} /></div>
              </div>
            )}
            <Link href="/achievements" className="btn btn-ghost mt-4 w-full !min-h-10 text-sm">{tt("View all achievements", "Бүх амжилтыг харах")}</Link>
          </Card>

          <Card title={tt("Recommended next", "Дараагийн зөвлөмж")} icon={<Zap size={18} className="text-cyan-fg" />}>
            <ul className="space-y-3">
              {d.recommendations.map((r) => (
                <li key={r.slug}>
                  <Link href={`/assessments/${r.slug}`} className="block rounded-xl border border-line bg-deep p-3 transition hover:border-violet">
                    <p className="text-sm font-semibold">{title(r)}</p>
                    <p className="mt-0.5 text-xs text-muted">{r.reason[lang]}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={tt("Learning suggestions", "Суралцахуйн зөвлөмж")} icon={<Lightbulb size={18} className="text-amber-700 dark:text-amber-400" />}>
            {d.suggestions.length ? (
              <ul className="space-y-3 text-sm text-muted">{d.suggestions.map((s, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{s[lang]}</li>)}</ul>
            ) : (
              <p className="text-sm text-muted">{tt("Suggestions appear once an assessment gives enough data to find a weaker domain.", "Тест хангалттай өгөгдөл өгч сул чадварыг тодорхойлсны дараа зөвлөмж гарна.")}</p>
            )}
          </Card>

          <Card title={tt("Recent activity", "Сүүлийн үйл ажиллагаа")}>
            {d.activity.length ? (
              <ul className="space-y-2.5 text-sm">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3"><span className="min-w-0 truncate text-muted">{a.label[lang]}</span><span className="shrink-0 font-semibold text-violet-fg">+{a.amount} XP</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">{tt("No activity yet.", "Үйл ажиллагаа алга.")}</p>}
          </Card>

          <Card title={tt("Test history", "Тестийн түүх")} icon={<History size={18} className="text-blue" />} className="lg:col-span-2">
            {d.history.length ? (
              <>
                <ul className="divide-y divide-line text-sm">
                  {d.history.map((h) => (
                    <li key={h.id}><Link href={`/results/${h.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-violet-fg"><span className="truncate">{title(h)}</span><span className="shrink-0 text-muted">{day(h.createdAt)} · <span className="font-semibold text-ink">{h.performance}</span></span></Link></li>
                  ))}
                </ul>
                <Link href="/history" className="mt-3 inline-flex items-center gap-1 text-sm text-violet-fg underline underline-offset-2 hover:no-underline">{tt(`All ${d.historyCount} attempts`, `Бүх ${d.historyCount} оролдлого`)} <ArrowRight size={14} /></Link>
              </>
            ) : <p className="text-sm text-muted">{tt("Completed assessments will be listed here.", "Дууссан тестүүд энд жагсана.")}</p>}
          </Card>

          <Card title={tt("Bookmarked assessments", "Хадгалсан тестүүд")} icon={<Bookmark size={18} className="text-violet-fg" />}>
            {d.bookmarks.length ? (
              <ul className="space-y-2 text-sm">{d.bookmarks.map((b) => <li key={b.slug}><Link href={`/assessments/${b.slug}`} className="hover:text-violet-fg">{title(b)}</Link></li>)}</ul>
            ) : <p className="text-sm text-muted">{tt("Use the bookmark button on an assessment to save it here.", "Тестийн хуудсан дээрх тэмдэглэгээг ашиглан энд хадгал.")}</p>}
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
