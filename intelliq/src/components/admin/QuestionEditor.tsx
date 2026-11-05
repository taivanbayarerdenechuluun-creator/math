"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FigureView, StemView } from "../FigureView";
import { Panel } from "./AdminShell";
import { adminApi, adminUpload } from "./api";
import type { Fig, Stem } from "@/lib/figures";

type Opt = { id?: string; label: string; labelMn?: string | null; figure: Fig | null; isCorrect: boolean };
export type EditorInitial = {
  id: string; version: number; inUse: boolean; answers: number; accuracy: number | null;
  categorySlug: string; prompt: string; difficulty: number; explanation: string; timeLimitSec: number | null;
  promptMn: string | null; explanationMn: string | null; stimulusMn: string | null;
  stimulus: { text?: string; fig?: Fig } | null; stimulusSec: number | null; figure: Stem | null; imageUrl: string | null; active: boolean;
  options: Opt[]; versions: { version: number; at: string }[];
};

const pretty = (v: unknown) => (v ? JSON.stringify(v) : "");
function parseJson(s: string): { ok: true; value: unknown } | { ok: false } {
  if (!s.trim()) return { ok: true, value: null };
  try { return { ok: true, value: JSON.parse(s) }; } catch { return { ok: false }; }
}

export function QuestionEditor({ categories, initial }: { categories: { slug: string; nameEn: string }[]; initial: EditorInitial | null }) {
  const router = useRouter();
  const locked = !!initial?.inUse;
  const [f, setF] = useState({
    categorySlug: initial?.categorySlug ?? categories[0]?.slug ?? "logical", prompt: initial?.prompt ?? "", difficulty: initial?.difficulty ?? 3,
    explanation: initial?.explanation ?? "", promptMn: initial?.promptMn ?? "", explanationMn: initial?.explanationMn ?? "", stimulusMn: initial?.stimulusMn ?? "", timeLimitSec: initial?.timeLimitSec?.toString() ?? "", stimulusText: initial?.stimulus?.text ?? "",
    stimulusFig: pretty(initial?.stimulus?.fig), stimulusSec: initial?.stimulusSec?.toString() ?? "", figure: pretty(initial?.figure), imageUrl: initial?.imageUrl ?? null, active: initial?.active ?? true,
  });
  const [opts, setOpts] = useState<(Omit<Opt, "figure"> & { figure: string })[]>(
    initial?.options.map((o) => ({ ...o, figure: pretty(o.figure) })) ?? [0, 1, 2, 3].map((i) => ({ label: "", figure: "", isCorrect: i === 0 })),
  );
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const built = useMemo(() => {
    const figure = parseJson(f.figure);
    const sFig = parseJson(f.stimulusFig);
    const oFigs = opts.map((o) => parseJson(o.figure));
    if (!figure.ok || !sFig.ok || oFigs.some((x) => !x.ok)) return { error: "A figure field is not valid JSON." } as const;
    const stim = f.stimulusText.trim() || sFig.value ? { ...(f.stimulusText.trim() ? { text: f.stimulusText.trim() } : {}), ...(sFig.value ? { fig: sFig.value } : {}) } : null;
    return {
      payload: {
        categorySlug: f.categorySlug, prompt: f.prompt, difficulty: Number(f.difficulty), explanation: f.explanation,
        promptMn: f.promptMn.trim() || null, explanationMn: f.explanationMn.trim() || null, stimulusMn: f.stimulusMn.trim() || null,
        timeLimitSec: f.timeLimitSec ? Number(f.timeLimitSec) : null, stimulus: stim, stimulusSec: f.stimulusSec ? Number(f.stimulusSec) : null,
        figure: figure.value, imageUrl: f.imageUrl, active: f.active,
        options: opts.map((o, i) => ({ ...(o.id ? { id: o.id } : {}), label: o.label, labelMn: o.labelMn?.trim() || null, figure: (oFigs[i] as { value: unknown }).value, isCorrect: o.isCorrect })),
      },
    } as const;
  }, [f, opts]);

  async function save() {
    if ("error" in built) return setMsg({ kind: "err", text: built.error as string });
    setBusy(true); setMsg(null);
    const r = initial ? await adminApi("PUT", `questions/${initial.id}`, built.payload) : await adminApi<{ id?: string }>("POST", "questions", built.payload);
    setBusy(false);
    if (!r.ok) return setMsg({ kind: "err", text: r.data.error ?? "Save failed." });
    if (!initial) return router.push(`/admin/questions/${(r.data as { id: string }).id}`);
    setMsg({ kind: "ok", text: `Saved (now version ${(r.data as { version: number }).version}).` });
    router.refresh();
  }

  async function remove() {
    if (!initial || !confirm("Delete this question? If it has been used it will be retired (deactivated) instead.")) return;
    const r = await adminApi<{ retired?: boolean }>("DELETE", `questions/${initial.id}`);
    if (!r.ok) return setMsg({ kind: "err", text: r.data.error ?? "Failed." });
    if (r.data.retired) { setMsg({ kind: "ok", text: "This question has history, so it was retired (set inactive) instead of deleted." }); router.refresh(); }
    else router.push("/admin/questions");
  }

  async function restore(version: number) {
    if (!initial || !confirm(`Restore version ${version}? The current state is saved as a new version first.`)) return;
    const r = await adminApi("POST", `questions/${initial.id}/restore`, { version });
    setMsg(r.ok ? { kind: "ok", text: `Restored version ${version}.` } : { kind: "err", text: r.data.error ?? "Restore failed." });
    if (r.ok) router.refresh();
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    const r = await adminUpload(file);
    if (r.ok && r.data.url) set("imageUrl", r.data.url);
    else setMsg({ kind: "err", text: r.data.error ?? "Upload failed." });
  }

  const stemPrev = (() => { const p = parseJson(f.figure); return p.ok && p.value ? (p.value as Stem) : null; })();
  const lock = locked ? { disabled: true, title: "Locked: this question has answers on record" } : {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{initial ? `Edit question` : "New question"}{initial && <span className="ml-2 text-base font-normal text-muted">v{initial.version}</span>}</h1>
        <Link href="/admin/questions" className="text-sm text-muted hover:text-ink">← All questions</Link>
      </div>
      {initial && <Panel><p className="text-sm text-muted">{initial.answers} answers recorded{initial.accuracy !== null ? ` · ${initial.accuracy}% correct` : ""}.</p>{locked && <p className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-700 dark:text-amber-300">This question has answers on record. You can edit the prompt, explanation, difficulty, active state and option wording. The answer key, options, figures, timing and category are locked so past scores stay valid. To change them, deactivate this question and create a new one.</p>}</Panel>}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Panel title="Content">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted">Category<select value={f.categorySlug} onChange={(e) => set("categorySlug", e.target.value)} className="input" {...lock}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.nameEn}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-muted">Difficulty (1–5)<select value={f.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))} className="input">{[1, 2, 3, 4, 5].map((d) => <option key={d}>{d}</option>)}</select></label>
            </div>
            <label className="mt-3 grid gap-1 text-xs text-muted">Prompt<textarea value={f.prompt} onChange={(e) => set("prompt", e.target.value)} rows={3} maxLength={1000} className="input !py-2" /></label>
            <label className="mt-3 grid gap-1 text-xs text-muted">Explanation (shown after the test)<textarea value={f.explanation} onChange={(e) => set("explanation", e.target.value)} rows={3} maxLength={2000} className="input !py-2" /></label>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-[var(--violet)]" /> Active (can be served in assessments)</label>
          </Panel>

          <Panel title="Options">
            <p className="mb-2 text-xs text-muted">Mark exactly one correct option. Figures use the JSON figure format (optional).</p>
            <ul className="space-y-3">
              {opts.map((o, i) => (
                <li key={i} className="rounded-xl border border-line bg-deep p-3">
                  <div className="flex items-center gap-2">
                    <input type="radio" name="correct" checked={o.isCorrect} onChange={() => setOpts((a) => a.map((x, k) => ({ ...x, isCorrect: k === i })))} aria-label={`Option ${i + 1} is correct`} className="h-4 w-4 accent-[var(--violet)]" {...lock} />
                    <input value={o.label} onChange={(e) => setOpts((a) => a.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} placeholder={`Option ${i + 1} text`} maxLength={200} className="input !min-h-9 flex-1" aria-label={`Option ${i + 1} text`} />
                    {!locked && opts.length > 2 && <button type="button" onClick={() => setOpts((a) => a.filter((_, k) => k !== i))} aria-label={`Remove option ${i + 1}`} className="text-muted hover:text-rose-400"><Trash2 size={16} /></button>}
                  </div>
                  <input value={o.figure} onChange={(e) => setOpts((a) => a.map((x, k) => (k === i ? { ...x, figure: e.target.value } : x)))} placeholder='figure JSON, e.g. {"k":"glyph","shape":"arrow","rot":90}' className="input !min-h-8 mt-2 font-mono text-xs" aria-label={`Option ${i + 1} figure`} {...lock} />
                </li>
              ))}
            </ul>
            {!locked && opts.length < 6 && <button type="button" onClick={() => setOpts((a) => [...a, { label: "", figure: "", isCorrect: false }])} className="btn btn-ghost mt-3 !min-h-9 text-sm"><Plus size={14} /> Add option</button>}
          </Panel>

          <Panel title="Mongolian text (optional)">
            <p className="mb-2 text-xs text-muted">Shown instead of the English text when the learner uses Mongolian. Leave blank to fall back to English. Wording fixes stay possible even after the question has answers.</p>
            <label className="grid gap-1 text-xs text-muted">Prompt (Mongolian)<textarea value={f.promptMn} onChange={(e) => set("promptMn", e.target.value)} rows={2} maxLength={1000} className="input !py-2" /></label>
            <label className="mt-3 grid gap-1 text-xs text-muted">Explanation (Mongolian)<textarea value={f.explanationMn} onChange={(e) => set("explanationMn", e.target.value)} rows={2} maxLength={2000} className="input !py-2" /></label>
            <label className="mt-3 grid gap-1 text-xs text-muted">Memory stimulus text (Mongolian, word lists only)<input value={f.stimulusMn} onChange={(e) => set("stimulusMn", e.target.value)} maxLength={300} className="input !min-h-9" /></label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {opts.map((o, i) => (
                <label key={i} className="grid gap-1 text-xs text-muted">Option {i + 1} (Mongolian)<input value={o.labelMn ?? ""} onChange={(e) => setOpts((a) => a.map((x, k) => (k === i ? { ...x, labelMn: e.target.value } : x)))} maxLength={200} className="input !min-h-9" /></label>
              ))}
            </div>
          </Panel>

          <Panel title="Visuals & timing (optional)">
            <label className="grid gap-1 text-xs text-muted">Stem figure JSON<textarea value={f.figure} onChange={(e) => set("figure", e.target.value)} rows={2} className="input !py-2 font-mono text-xs" placeholder='{"k":"seq","items":[{"k":"glyph","shape":"circle","n":1},null]}' {...lock} /></label>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <label className="grid gap-1 text-xs text-muted">Image (PNG, JPEG, WebP or GIF, max 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void upload(e.target.files?.[0])} className="text-xs" {...lock} /></label>
              {f.imageUrl && <><span className="text-xs text-muted">{f.imageUrl.slice(-20)}</span>{!locked && <button type="button" onClick={() => set("imageUrl", null)} className="text-xs text-rose-700 dark:text-rose-400 hover:underline">remove</button>}</>}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-muted">Time limit (s)<input value={f.timeLimitSec} onChange={(e) => set("timeLimitSec", e.target.value)} inputMode="numeric" className="input !min-h-9" {...lock} /></label>
              <label className="grid gap-1 text-xs text-muted">Stimulus text (memory)<input value={f.stimulusText} onChange={(e) => set("stimulusText", e.target.value)} className="input !min-h-9" {...lock} /></label>
              <label className="grid gap-1 text-xs text-muted">Stimulus shown (s)<input value={f.stimulusSec} onChange={(e) => set("stimulusSec", e.target.value)} inputMode="numeric" className="input !min-h-9" {...lock} /></label>
            </div>
            <label className="mt-3 grid gap-1 text-xs text-muted">Stimulus figure JSON<input value={f.stimulusFig} onChange={(e) => set("stimulusFig", e.target.value)} className="input !min-h-9 font-mono text-xs" {...lock} /></label>
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => void save()} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : initial ? "Save changes" : "Create question"}</button>
            {initial && <button onClick={() => void remove()} className="btn btn-ghost text-rose-700 dark:text-rose-400">{locked ? "Retire" : "Delete"}</button>}
            {msg && <p role={msg.kind === "err" ? "alert" : "status"} className={`text-sm ${msg.kind === "err" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-400"}`}>{msg.text}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="Preview" className="lg:sticky lg:top-20">
            {f.imageUrl && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={f.imageUrl} alt="" className="mx-auto mb-3 max-h-40 rounded-lg" />)}
            {stemPrev && <div className="mb-3"><StemView stem={stemPrev} /></div>}
            <p className="font-medium">{f.prompt || <span className="text-muted">Prompt appears here</span>}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {opts.map((o, i) => { const fg = parseJson(o.figure); return (
                <li key={i} className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${o.isCorrect ? "border-emerald-400 bg-emerald-400/10" : "border-line"}`}>
                  <span className="text-xs text-muted">{i + 1}</span>{fg.ok && fg.value ? <FigureView fig={fg.value as Fig} size={48} /> : null}{o.label}
                </li>); })}
            </ul>
            <p className="mt-3 text-xs text-muted">Correct option highlighted (admin only).</p>
          </Panel>
          {initial && initial.versions.length > 0 && (
            <Panel title="Version history">
              <ul className="divide-y divide-line text-sm">
                {initial.versions.map((v) => (<li key={v.version} className="flex items-center justify-between py-2"><span>v{v.version} <span className="text-xs text-muted">{v.at.slice(0, 16).replace("T", " ")}</span></span><button onClick={() => void restore(v.version)} className="text-violet-fg underline underline-offset-2 hover:no-underline">Restore</button></li>))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
