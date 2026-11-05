"use client";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { Badge } from "../AchIcon";
import { useApp } from "../Providers";
import type { Bi, levelOf } from "@/lib/gamification";

export type AchItem = { code: string; xp: number; name: Bi; desc: Bi; unlockedAt: string | null; progress: { current: number; target: number } };

export function AchievementsView({ items, level }: { items: AchItem[]; level: ReturnType<typeof levelOf> }) {
  const { tt, lang } = useApp();
  const earned = items.filter((i) => i.unlockedAt).length;
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt("Achievements", "Амжилтууд")}</h1>
        <p className="mt-2 text-muted">{tt("Badges reward practice, consistency and exploration. They are not an intelligence rating.", "Тэмдгүүд дасгал, тогтвортой байдал, судалгааг шагнадаг. Эдгээр нь оюун ухааны үнэлгээ биш.")}</p>
        <div className="glass mt-6 flex flex-wrap items-center gap-6 rounded-2xl p-5">
          <div><p className="font-display text-3xl font-bold">{earned}<span className="text-lg text-muted"> / {items.length}</span></p><p className="text-xs text-muted">{tt("unlocked", "нээгдсэн")}</p></div>
          <div><p className="font-display text-3xl font-bold">{level.level}</p><p className="text-xs text-muted">{tt("level", "түвшин")} · {level.xp} XP</p></div>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={tt("Achievement collection", "Амжилтын цуглуулга")}>
          {items.map((a, i) => {
            const done = !!a.unlockedAt;
            return (
              <motion.li key={a.code} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`card flex gap-4 p-5 ${done ? "" : "opacity-80"}`} data-unlocked={done}>
                <div className="relative shrink-0">
                  <Badge code={a.code} locked={!done} />
                  {!done && <Lock size={14} className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5 text-muted" aria-label={tt("locked", "түгжээтэй")} />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{a.name[lang]}</h2>
                  <p className="mt-1 text-sm text-muted">{a.desc[lang]}</p>
                  {done ? (
                    <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{tt("Unlocked", "Нээсэн")} {a.unlockedAt!.slice(0, 10)} · +{a.xp} XP</p>
                  ) : (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan" style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }} /></div>
                      <p className="mt-1 text-xs text-muted">{Math.round(a.progress.current)} / {a.progress.target} · +{a.xp} XP</p>
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}
