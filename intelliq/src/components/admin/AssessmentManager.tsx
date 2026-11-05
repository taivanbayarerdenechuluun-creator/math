"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Panel } from "./AdminShell";
import { adminApi } from "./api";

export type AssessmentRow = {
  id: string; slug: string; titleEn: string; titleMn: string; descEn: string; descMn: string; questionCount: number;
  durationSec: number | null; adaptive: boolean; categorySlugs: string[]; active: boolean; version: number; sessions: number;
  difficultyMin: number; difficultyMax: number; categoryWeights: Record<string, number>; questionIds: string[];
};
export type PoolQuestion = { id: string; prompt: string; category: string; difficulty: number };

const empty = {
  slug: "", titleEn: "", titleMn: "", descEn: "", descMn: "", questionCount: 10, durationMin: "", adaptive: true,
  categorySlugs: [] as string[], active: true, difficultyMin: 1, difficultyMax: 5,
  weights: {} as Record<string, number>, pool: [] as string[],
};

export function AssessmentManager({ rows, categories, questions }: { rows: AssessmentRow[]; categories: { slug: string; nameEn: string }[]; questions: PoolQuestion[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // assessment id, or null for "new"
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [q, setQ] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function edit(a: AssessmentRow | null) {
    setMsg(null);
    setEditing(a?.id ?? null);
    setF(a ? {
      slug: a.slug, titleEn: a.titleEn, titleMn: a.titleMn, descEn: a.descEn, descMn: a.descMn, questionCount: a.questionCount,
      durationMin: a.durationSec ? String(Math.round(a.durationSec / 60)) : "", adaptive: a.adaptive, categorySlugs: a.categorySlugs, active: a.active,
      difficultyMin: a.difficultyMin, difficultyMax: a.difficultyMax, weights: a.categoryWeights, pool: a.questionIds,
    } : empty);
  }

  async function save() {
    const payload = {
      slug: f.slug, titleEn: f.titleEn, titleMn: f.titleMn, descEn: f.descEn, descMn: f.descMn, questionCount: Number(f.questionCount),
      durationSec: f.durationMin ? Number(f.durationMin) * 60 : null, adaptive: f.adaptive, categorySlugs: f.categorySlugs, active: f.active,
      difficultyMin: Number(f.difficultyMin), difficultyMax: Number(f.difficultyMax), categoryWeights: f.weights, questionIds: f.pool,
    };
    const r = editing ? await adminApi("PUT", `assessments/${editing}`, payload) : await adminApi("POST", "assessments", payload);
    if (!r.ok) return setMsg({ kind: "err", text: r.data.error ?? "Save failed." });
    setMsg({ kind: "ok", text: editing ? `Saved (version ${(r.data as { version: number }).version}).` : "Created." });
    if (!editing) setF(empty);
    router.refresh();
  }

  const toggleCat = (slug: string) => {
    const on = f.categorySlugs.includes(slug);
    setF((s) => ({ ...s, categorySlugs: on ? s.categorySlugs.filter((c) => c !== slug) : [...s.categorySlugs, slug], weights: on ? Object.fromEntries(Object.entries(s.weights).filter(([k]) => k !== slug)) : s.weights }));
  };
  const shownCats = f.categorySlugs.length ? f.categorySlugs : categories.map((c) => c.slug);
  const setWeight = (slug: string, w: string) => setF((s) => ({ ...s, weights: w === "" || Number(w) <= 1 ? Object.fromEntries(Object.entries(s.weights).filter(([k]) => k !== slug)) : { ...s.weights, [slug]: Math.min(5, Math.floor(Number(w))) } }));
  const togglePool = (id: string) => setF((s) => ({ ...s, pool: s.pool.includes(id) ? s.pool.filter((x) => x !== id) : [...s.pool, id] }));

  const visible = useMemo(
    () => questions.filter((x) => shownCats.includes(x.category) && x.difficulty >= f.difficultyMin && x.difficulty <= f.difficultyMax && (!q || x.prompt.toLowerCase().includes(q.toLowerCase()))),
    [questions, shownCats, f.difficultyMin, f.difficultyMax, q],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <Panel title="All assessments">
        <ul className="divide-y divide-line text-sm">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.titleEn} {!a.active && <span className="text-xs text-muted">(inactive)</span>}</p>
                <p className="text-xs text-muted">{a.slug} · {a.questionCount} q · {a.durationSec ? `${a.durationSec / 60} min` : "untimed"} · v{a.version} · {a.sessions} sessions · difficulty {a.difficultyMin}-{a.difficultyMax}{a.questionIds.length ? ` · ${a.questionIds.length}-question pool` : ""} · {a.categorySlugs.length ? a.categorySlugs.join(", ") : "all categories"}</p>
              </div>
              <button onClick={() => edit(a)} className="shrink-0 text-violet-fg underline underline-offset-2 hover:no-underline">Edit</button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={editing ? "Edit assessment" : "New assessment"}>
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1 text-xs text-muted">Slug<input value={f.slug} onChange={(e) => set("slug", e.target.value)} disabled={!!editing} className="input !min-h-9" placeholder="my-assessment" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted">Title (EN)<input value={f.titleEn} onChange={(e) => set("titleEn", e.target.value)} className="input !min-h-9" /></label>
            <label className="grid gap-1 text-xs text-muted">Title (MN)<input value={f.titleMn} onChange={(e) => set("titleMn", e.target.value)} className="input !min-h-9" /></label>
            <label className="grid gap-1 text-xs text-muted">Description (EN)<input value={f.descEn} onChange={(e) => set("descEn", e.target.value)} className="input !min-h-9" /></label>
            <label className="grid gap-1 text-xs text-muted">Description (MN)<input value={f.descMn} onChange={(e) => set("descMn", e.target.value)} className="input !min-h-9" /></label>
            <label className="grid gap-1 text-xs text-muted">Questions<input type="number" min={3} max={60} value={f.questionCount} onChange={(e) => set("questionCount", Number(e.target.value))} className="input !min-h-9" /></label>
            <label className="grid gap-1 text-xs text-muted">Time limit (minutes, empty = none)<input value={f.durationMin} onChange={(e) => set("durationMin", e.target.value)} inputMode="numeric" className="input !min-h-9" /></label>
            <label className="grid gap-1 text-xs text-muted">Easiest difficulty served<select value={f.difficultyMin} onChange={(e) => set("difficultyMin", Number(e.target.value))} className="input !min-h-9">{[1, 2, 3, 4, 5].map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="grid gap-1 text-xs text-muted">Hardest difficulty served<select value={f.difficultyMax} onChange={(e) => set("difficultyMax", Number(e.target.value))} className="input !min-h-9">{[1, 2, 3, 4, 5].map((d) => <option key={d}>{d}</option>)}</select></label>
          </div>
          <fieldset><legend className="mb-1 text-xs text-muted">Categories (none selected = all)</legend><div className="flex flex-wrap gap-2">{categories.map((c) => <label key={c.slug} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${f.categorySlugs.includes(c.slug) ? "border-violet bg-violet/15" : "border-line"}`}><input type="checkbox" className="sr-only" checked={f.categorySlugs.includes(c.slug)} onChange={() => toggleCat(c.slug)} />{c.nameEn}</label>)}</div></fieldset>
          <fieldset>
            <legend className="mb-1 text-xs text-muted">Question distribution: relative share per category (1 = equal, up to 5)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {shownCats.map((slug) => (
                <label key={slug} className="grid gap-1 text-xs text-muted">{categories.find((c) => c.slug === slug)?.nameEn ?? slug}<input type="number" min={1} max={5} value={f.weights[slug] ?? 1} onChange={(e) => setWeight(slug, e.target.value)} className="input !min-h-8" aria-label={`Share for ${slug}`} /></label>
              ))}
            </div>
          </fieldset>
          <details className="rounded-xl border border-line bg-deep p-3" data-testid="pool">
            <summary className="cursor-pointer text-sm font-medium">Choose specific questions ({f.pool.length ? `${f.pool.length} picked` : "all eligible questions"})</summary>
            <p className="mt-2 text-xs text-muted">Leave empty to draw from every active question in the selected categories and difficulty range. Pick questions to restrict the assessment to exactly that pool.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by text" className="input !min-h-8 max-w-[14rem] text-xs" aria-label="Filter questions" />
              <button type="button" onClick={() => setF((s) => ({ ...s, pool: [...new Set([...s.pool, ...visible.map((x) => x.id)])] }))} className="text-xs text-violet-fg underline underline-offset-2 hover:no-underline">Pick all shown</button>
              <button type="button" onClick={() => set("pool", [])} className="text-xs text-violet-fg underline underline-offset-2 hover:no-underline">Clear</button>
            </div>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
              {visible.map((x) => (
                <li key={x.id}><label className="flex cursor-pointer items-start gap-2"><input type="checkbox" checked={f.pool.includes(x.id)} onChange={() => togglePool(x.id)} className="mt-0.5 h-3.5 w-3.5 accent-[var(--violet)]" /><span><span className="text-muted">{x.category} · d{x.difficulty} · </span>{x.prompt.slice(0, 90)}</span></label></li>
              ))}
              {!visible.length && <li className="text-muted">No questions match the current categories and difficulty range.</li>}
            </ul>
          </details>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.adaptive} onChange={(e) => set("adaptive", e.target.checked)} className="h-4 w-4 accent-[var(--violet)]" /> Adaptive difficulty</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-[var(--violet)]" /> Active</label>
          <p className="text-xs text-muted">Changing the question count, categories, adaptivity, difficulty range, shares or question pool bumps the version; rankings only compare results from the same version.</p>
          <div className="flex flex-wrap items-center gap-3"><button onClick={() => void save()} className="btn btn-primary !min-h-10 text-sm">{editing ? "Save" : "Create"}</button>{editing && <button onClick={() => edit(null)} className="btn btn-ghost !min-h-10 text-sm">New instead</button>}{msg && <span role={msg.kind === "err" ? "alert" : "status"} className={`text-sm ${msg.kind === "err" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-400"}`}>{msg.text}</span>}</div>
        </div>
      </Panel>
    </div>
  );
}
