"use client";
import Link from "next/link";
import { Crown, Medal } from "lucide-react";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { useApp } from "../Providers";
import type { Board } from "@/lib/leaderboard.server";
import type { Scope } from "@/lib/leaderboard";
import type { Key } from "@/lib/i18n";

export function LeaderboardView({ board, scope, slug, category, signedIn, enabled }: { board: Board; scope: Scope; slug: string; category: string | null; signedIn: boolean; enabled: boolean }) {
  const { tt, lang, t } = useApp();
  const href = (o: { scope?: Scope; a?: string; c?: string | null }) => {
    const p = new URLSearchParams({ scope: o.scope ?? scope, a: o.a ?? slug });
    const c = o.c === undefined ? category : o.c;
    if (c) p.set("c", c);
    return `/leaderboard?${p}`;
  };
  const current = board.assessments.find((a) => a.slug === slug);
  const scopes: [Scope, string][] = [["global", tt("All time", "Бүх цаг")], ["weekly", tt("Last 7 days", "Сүүлийн 7 хоног")], ["monthly", tt("Last 30 days", "Сүүлийн 30 хоног")]];
  const pill = (active: boolean) => `rounded-full border px-4 py-1.5 text-sm transition ${active ? "border-violet bg-violet/15 font-semibold" : "border-line text-muted hover:border-violet/60"}`;

  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt("Leaderboard", "Тэргүүлэгчид")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{tt("Rankings compare only results from the same assessment and scoring version, with at least 8 questions. They show practice performance, not IQ. Participation is optional.", "Жагсаалт нь зөвхөн ижил тест, ижил онооны хувилбартай, 8-аас доошгүй асуулттай үр дүнг харьцуулна. Энэ нь IQ биш, дасгалын гүйцэтгэлийг харуулна. Оролцох нь сайн дурын.")}</p>

        {!enabled ? (
          <div className="card mt-8 p-8 text-center text-muted">{tt("Leaderboards are currently turned off.", "Тэргүүлэгчдийн жагсаалтыг одоогоор унтраасан.")}</div>
        ) : (
          <>
            <nav className="mt-6 flex flex-wrap gap-2" aria-label={tt("Period", "Хугацаа")}>
              {scopes.map(([s, label]) => <Link key={s} href={href({ scope: s })} className={pill(s === scope)} aria-current={s === scope ? "page" : undefined}>{label}</Link>)}
            </nav>
            <nav className="mt-3 flex flex-wrap gap-2" aria-label={tt("Assessment", "Тест")}>
              {board.assessments.map((a) => <Link key={a.slug} href={href({ a: a.slug, c: null })} className={pill(a.slug === slug)} aria-current={a.slug === slug ? "page" : undefined}>{lang === "en" ? a.titleEn : a.titleMn}</Link>)}
            </nav>
            {current && (
              <nav className="mt-3 flex flex-wrap gap-2" aria-label={tt("Domain", "Чадвар")}>
                <Link href={href({ c: null })} className={pill(!category)}>{tt("Overall", "Нийт")}</Link>
                {current.categories.map((c) => <Link key={c} href={href({ c })} className={pill(category === c)}>{t(`cat.${c}` as Key)}</Link>)}
              </nav>
            )}

            {signedIn && !board.viewerOptedIn && (
              <p className="mt-5 rounded-xl border border-line bg-deep p-4 text-sm text-muted">{tt("You are not ranked. Rankings are opt-in: ", "Та жагсаалтад ороогүй. Жагсаалт нь сайн дурын: ")}<Link href="/settings" className="text-violet-fg underline underline-offset-2 hover:no-underline">{tt("enable it in Settings", "Тохиргоонд идэвхжүүл")}</Link>.</p>
            )}
            {!signedIn && <p className="mt-5 text-sm text-muted"><Link href="/login" className="text-violet-fg underline underline-offset-2 hover:no-underline">{t("nav.login")}</Link> {tt("to appear on the leaderboard.", "тэргүүлэгчдийн жагсаалтад орно уу.")}</p>}

            {board.rows.length === 0 ? (
              <div className="card mt-6 grid place-items-center px-6 py-14 text-center">
                <p className="font-semibold">{tt("No ranked results yet", "Жагсаалтад үр дүн алга")}</p>
                <p className="mt-2 max-w-sm text-sm text-muted">{tt("Be the first: complete this assessment with rankings enabled.", "Эхний нь бол: жагсаалтыг идэвхжүүлээд энэ тестийг дуусга.")}</p>
                <Link href={`/assessments/${slug}`} className="btn btn-primary mt-5">{tt("Take this assessment", "Энэ тестийг өгөх")}</Link>
              </div>
            ) : (
              <div className="card mt-6 overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <caption className="sr-only">{tt("Leaderboard", "Тэргүүлэгчид")}</caption>
                  <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-3 font-normal">#</th><th className="font-normal">{tt("Player", "Тоглогч")}</th><th className="font-normal">{tt("Level", "Түвшин")}</th><th className="font-normal">{tt("Badges", "Тэмдэг")}</th><th className="px-4 text-right font-normal">{category ? t(`cat.${category}` as Key) : t("r.perf")}</th></tr></thead>
                  <tbody>
                    {board.rows.map((r) => (
                      <tr key={`${r.rank}-${r.name}-${r.value}-${r.profileId ?? r.attempts}`} className={`border-b border-line last:border-0 ${r.me ? "bg-violet/10" : ""}`}>
                        <td className="px-4 py-3 font-semibold">{r.rank <= 3 ? <span className="inline-flex items-center gap-1">{r.rank === 1 ? <Crown size={14} className="text-amber-700 dark:text-amber-400" /> : <Medal size={14} className={r.rank === 2 ? "text-slate-300" : "text-orange-400"} />}{r.rank}</span> : r.rank}</td>
                        <td>{r.profileId ? <Link href={`/u/${r.profileId}`} className="hover:text-violet-fg underline underline-offset-2 hover:no-underline">{r.name}</Link> : r.name}{r.me && <span className="ml-2 text-xs text-violet-fg">({tt("you", "та")})</span>}</td>
                        <td className="text-muted">{r.level}</td><td className="text-muted">{r.badges}</td>
                        <td className="px-4 text-right font-display font-bold">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {board.me && !board.rows.some((r) => r.me) && <p className="mt-3 text-sm text-muted">{tt("Your rank", "Таны байр")}: #{board.me.rank} · {board.me.value}</p>}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
