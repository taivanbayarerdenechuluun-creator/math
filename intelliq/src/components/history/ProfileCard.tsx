"use client";
import { Navbar } from "../Navbar";
import { Footer } from "../Footer";
import { Badge } from "../AchIcon";
import { useApp } from "../Providers";
import { ACHIEVEMENTS } from "@/lib/gamification";

export function ProfileCard({ id, name, level, xp, since, hasImage, badges }: { id: string; name: string; level: number; xp: number; since: string; hasImage: boolean; badges: string[] }) {
  const { tt, lang } = useApp();
  return (
    <>
      <Navbar />
      <main id="main" className="mx-auto max-w-2xl px-4 pb-20 pt-28 sm:px-6">
        <section className="card p-6 text-center sm:p-10">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/avatar/${id}`} alt="" width={96} height={96} className="mx-auto h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-violet to-cyan font-display text-4xl font-bold text-white" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
          )}
          <h1 className="mt-4 font-display text-3xl font-bold">{name}</h1>
          <p className="mt-1 text-sm text-muted">{tt("Level", "Түвшин")} {level} · {xp} XP · {tt("member since", "гишүүн болсон")} {since}</p>
          <h2 className="mt-8 font-display text-lg font-semibold">{tt("Achievement showcase", "Амжилтын үзүүлэн")}</h2>
          {badges.length ? (
            <ul className="mt-4 flex flex-wrap justify-center gap-5">
              {badges.map((code) => { const a = ACHIEVEMENTS.find((x) => x.code === code); return a ? <li key={code} className="flex w-24 flex-col items-center text-center"><Badge code={code} /><span className="mt-2 text-xs">{a.name[lang]}</span></li> : null; })}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">{tt("No badges yet.", "Тэмдэг алга.")}</p>}
        </section>
      </main>
      <Footer />
    </>
  );
}
