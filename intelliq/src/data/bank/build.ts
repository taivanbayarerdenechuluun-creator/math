import { figKey } from "../../lib/figures";
import { rng, shuffle, type Opt, type QDef } from "./types";

export type BuiltOption = { label: string; labelMn: string | null; figure: string | null; isCorrect: boolean };

export const optKey = (o: Opt) => (o.fig ? figKey(o.fig) : `text:${o.label}`);

/** Database columns for a question definition (shared by the seed and the daily-challenge generator). */
export function questionRow(q: QDef, index: number) {
  const figure = q.stem ? JSON.stringify(q.stem) : null;
  return {
    prompt: q.prompt,
    promptMn: q.mn?.prompt ?? null,
    kind: q.stem?.k === "reaction" ? "reaction" : figure ? "figure" : "text",
    figure,
    stimulus: q.stimulus ? JSON.stringify(q.stimulus) : null,
    stimulusMn: q.mn?.stimulus ?? null,
    stimulusSec: q.stimulusSec ?? null,
    timeLimitSec: q.timeLimitSec ?? null,
    difficulty: q.diff,
    explanation: q.explanation,
    explanationMn: q.mn?.explanation ?? null,
    options: buildOptions(q, index).map((o, position) => ({ ...o, position })),
  };
}

/** Deterministic option order (seeded by question index) so answer positions are spread out. */
export function buildOptions(q: QDef, index: number): BuiltOption[] {
  const all = [
    { ...q.right, isCorrect: true, labelMn: q.mn?.right ?? null },
    ...q.wrong.map((w, i) => ({ ...w, isCorrect: false, labelMn: q.mn?.wrong?.[i] ?? null })),
  ];
  let ordered = all;
  if (q.fixedOrder) {
    const wrong = all.filter((o) => !o.isCorrect);
    const at = q.rightIndex ?? 0;
    ordered = [...wrong.slice(0, at), all[0], ...wrong.slice(at)];
  } else {
    ordered = shuffle(all, rng(9001 + index * 17));
  }
  return ordered.map((o) => ({
    label: o.label ?? "",
    labelMn: o.labelMn,
    figure: o.fig ? JSON.stringify(o.fig) : null,
    isCorrect: o.isCorrect,
  }));
}
