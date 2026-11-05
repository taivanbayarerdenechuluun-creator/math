/**
 * Procedural daily-challenge generator (pure). The same date always yields the same five questions, and different
 * dates yield different ones, so the daily challenge does not run out. Every item is generated together with its
 * answer and is verified before use: number sequences must have exactly one next value under every recurrence of
 * the families below (`predictNext`), orderings and syllogisms are decided by construction (see daily-gen.test.ts,
 * which re-checks a year of days with independent solvers).
 */
import type { Fig, Fill, Glyph, Matrix, Shape } from "./figures";
import { FILL_MN, SHAPE_MN, figKey } from "./figures";
import { L, rng, shuffle, type Opt, type QDef } from "../data/bank/types";
import { ORD_MN, WORD_MN } from "../data/bank/mn";

export const DAILY_SLOTS = ["logical", "numerical", "abstract", "memory", "speed"] as const;
export type Slot = (typeof DAILY_SLOTS)[number];
export type Generated = { slot: Slot; q: QDef };

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type R = () => number;
const int = (r: R, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pick = <T,>(r: R, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
const spaced = (s: string) => s.split("").join(" ");

// ------------------------------------------------------------------ number sequences

/**
 * Every value that the sequence's next term could take under an order-2 affine recurrence
 * t[i] = a·t[i-1] + b·t[i-2] + c (small coefficients) or an order-3 homogeneous one (which fits polynomials).
 * A generated sequence is only used when this set is exactly {intended next}.
 */
export function predictNext(t: number[]): number[] {
  const out = new Set<number>();
  const n = t.length;
  for (let a = -3; a <= 3; a++) {
    for (let b = -3; b <= 3; b++) {
      const c = t[2] - a * t[1] - b * t[0];
      if (Math.abs(c) > 8) continue;
      let ok = true;
      for (let i = 3; i < n && ok; i++) ok = t[i] === a * t[i - 1] + b * t[i - 2] + c;
      if (ok) out.add(a * t[n - 1] + b * t[n - 2] + c);
    }
  }
  if (n >= 6) {
    for (let p = -3; p <= 3; p++) for (let q = -3; q <= 3; q++) for (let s = -3; s <= 3; s++) {
      let ok = true;
      for (let i = 3; i < n && ok; i++) ok = t[i] === p * t[i - 1] + q * t[i - 2] + s * t[i - 3];
      if (ok) out.add(p * t[n - 1] + q * t[n - 2] + s * t[n - 3]);
    }
  }
  return [...out];
}

type Seq = { shown: number[]; next: number; en: string; mn: string };

const arithmeticUp = (r: R): Seq => {
  const s = int(r, 2, 99), d = int(r, 2, 12), t = (i: number) => s + d * i;
  return { shown: [0, 1, 2, 3, 4].map(t), next: t(5), en: `The series adds ${d} each time, so ${t(4)} + ${d} = ${t(5)}.`, mn: `Цуваа тутамд ${d}-өөр нэмэгдэж байна, иймд ${t(4)} + ${d} = ${t(5)}.` };
};
const arithmeticDown = (r: R): Seq => {
  const d = int(r, 2, 12), s = int(r, 5 * d + 1, 150), t = (i: number) => s - d * i;
  return { shown: [0, 1, 2, 3, 4].map(t), next: t(5), en: `The series subtracts ${d} each time, so ${t(4)} − ${d} = ${t(5)}.`, mn: `Цуваа тутамд ${d}-өөр буурч байна, иймд ${t(4)} − ${d} = ${t(5)}.` };
};
const geometric = (r: R): Seq => {
  const m = pick(r, [2, 2, 2, 3]), s = int(r, 1, m === 2 ? 30 : 4), t = (i: number) => s * m ** i;
  return { shown: [0, 1, 2, 3, 4].map(t), next: t(5), en: `Each term is ${m} times the previous one: ${t(4)} × ${m} = ${t(5)}.`, mn: `Гишүүн бүр өмнөхөөсөө ${m} дахин их: ${t(4)} × ${m} = ${t(5)}.` };
};
const squares = (r: R): Seq => {
  const k = int(r, 0, 30), n0 = int(r, 1, 9), t = (i: number) => (n0 + i) ** 2 + k;
  return { shown: [0, 1, 2, 3, 4, 5].map(t), next: t(6), en: `The terms are n² + ${k} (n = ${n0}, ${n0 + 1}, …), so the next is ${n0 + 6}² + ${k} = ${t(6)}.`, mn: `Гишүүд нь n² + ${k} (n = ${n0}, ${n0 + 1}, …) тул дараагийнх нь ${n0 + 6}² + ${k} = ${t(6)}.` };
};
const growingGaps = (r: R): Seq => {
  const s = int(r, 1, 30), d0 = int(r, 1, 6), e = int(r, 1, 3), t = [s];
  for (let i = 0; i < 6; i++) t.push(t[i] + d0 + e * i);
  const gap = d0 + 5 * e;
  return { shown: t.slice(0, 6), next: t[6], en: `The gaps grow by ${e} each time (+${d0}, +${d0 + e}, +${d0 + 2 * e}, …), so the next gap is +${gap}: ${t[5]} + ${gap} = ${t[6]}.`, mn: `Зөрүү тутамд ${e}-ээр нэмэгдэж байна (+${d0}, +${d0 + e}, +${d0 + 2 * e}, …), иймд дараагийн зөрүү +${gap}: ${t[5]} + ${gap} = ${t[6]}.` };
};
const fibonacci = (r: R): Seq => {
  const a = int(r, 1, 12), b = int(r, 1, 12), t = [a, b];
  for (let i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2]);
  return { shown: t.slice(0, 6), next: t[6], en: `Each term is the sum of the previous two: ${t[4]} + ${t[5]} = ${t[6]}.`, mn: `Гишүүн бүр өмнөх хоёрынхоо нийлбэр: ${t[4]} + ${t[5]} = ${t[6]}.` };
};
const alternating = (r: R): Seq => {
  const s = int(r, 1, 30), x = int(r, 2, 8), y = int(r, x + 1, 11), t = [s];
  for (let i = 0; i < 6; i++) t.push(t[i] + (i % 2 === 0 ? x : y));
  return { shown: t.slice(0, 6), next: t[6], en: `The steps alternate +${x}, +${y}, +${x}, +${y}, +${x}, so the next step is +${y}: ${t[5]} + ${y} = ${t[6]}.`, mn: `Алхмууд ээлжлэн +${x}, +${y}, +${x}, +${y}, +${x} болж байгаа тул дараагийн алхам +${y}: ${t[5]} + ${y} = ${t[6]}.` };
};
const doublePlus = (r: R): Seq => {
  const m = pick(r, [2, 2, 3]), c = pick(r, [-3, -2, -1, 1, 2, 3, 4, 5]), s = int(r, 2, 9), t = [s];
  for (let i = 0; i < 5; i++) t.push(m * t[i] + c);
  const sign = c >= 0 ? `+ ${c}` : `− ${-c}`;
  const times = m === 2 ? ["double", "хоёр дахин"] : ["triple", "гурав дахин"];
  return { shown: t.slice(0, 5), next: t[5], en: `Each term is ${times[0]} the previous one ${sign}: ${m} × ${t[4]} ${sign} = ${t[5]}.`, mn: `Гишүүн бүр өмнөхийнхөө ${times[1]} ${sign}: ${m} × ${t[4]} ${sign} = ${t[5]}.` };
};

/** Several entries = proportionally more days; families with a small parameter space are rare so a year rarely repeats. */
const FAMILIES: ((r: R) => Seq)[] = [
  arithmeticUp, arithmeticUp, arithmeticUp, arithmeticUp,
  arithmeticDown, arithmeticDown, arithmeticDown,
  alternating, alternating, alternating, alternating,
  squares, squares,
  growingGaps, growingGaps,
  fibonacci, geometric, doublePlus,
];

function genNumerical(r: R): QDef {
  for (let attempt = 0; attempt < 60; attempt++) {
    const f = pick(r, FAMILIES)(r);
    const pred = predictNext(f.shown);
    if (pred.length !== 1 || pred[0] !== f.next || f.shown.concat(f.next).some((v) => !Number.isInteger(v) || v < 0 || v > 999)) continue;
    const last = f.shown[f.shown.length - 1], prev = f.shown[f.shown.length - 2];
    const cands = shuffle([f.next + 1, f.next - 1, f.next + 2, f.next - 2, f.next + 10, f.next - 10, last + (last - prev), last * 2], r)
      .filter((v, i, a) => Number.isInteger(v) && v >= 0 && v !== f.next && a.indexOf(v) === i);
    if (cands.length < 3) continue;
    const seq = f.shown.join(", ");
    return {
      cat: "numerical", diff: 3,
      prompt: `What comes next?  ${seq}, ?`,
      right: L(String(f.next)), wrong: cands.slice(0, 3).map((v) => L(String(v))),
      explanation: f.en,
      mn: { prompt: `Дараагийн тоо юу вэ?  ${seq}, ?`, explanation: f.mn },
    };
  }
  throw new Error("could not generate an unambiguous number sequence");
}

// ------------------------------------------------------------------ logic

const NAMES_EN = ["Ann", "Ben", "Cara", "Dan", "Eve", "Fay", "Gus", "Hal"];
const NAMES_MN = ["Ану", "Бат", "Цэцэг", "Дорж", "Сараа", "Хулан", "Ганаа", "Болд"];
const DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_MN = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];
const NONSENSE_EN = ["Blorps", "Zinks", "Quibs", "Murks", "Delps", "Tarks", "Fengs", "Jumbs"];
const NONSENSE_MN = ["Блорп", "Зинк", "Квиб", "Мүрх", "Дэлп", "Тарк", "Фэнг", "Жумб"];

function genLogical(r: R): QDef {
  const kind = int(r, 0, 2);
  if (kind === 0) {
    // ordering: a chain of "taller than" clues over four people
    const idx = shuffle(NAMES_EN.map((_, i) => i), r).slice(0, 4); // tallest -> shortest
    const clues = shuffle([0, 1, 2], r);
    const askTallest = r() < 0.5;
    const answer = idx[askTallest ? 0 : 3];
    const en = clues.map((c) => `${NAMES_EN[idx[c]]} is taller than ${NAMES_EN[idx[c + 1]]}.`).join(" ");
    const mn = clues.map((c) => `${NAMES_MN[idx[c]]} ба ${NAMES_MN[idx[c + 1]]} хоёрын дундаас ${NAMES_MN[idx[c]]} илүү өндөр.`).join(" ");
    const others = idx.filter((i) => i !== answer);
    return {
      cat: "logical", diff: 2,
      prompt: `${en} Who is the ${askTallest ? "tallest" : "shortest"}?`,
      right: L(NAMES_EN[answer]), wrong: others.map((i) => L(NAMES_EN[i])),
      explanation: `From tallest to shortest the order is ${idx.map((i) => NAMES_EN[i]).join(", ")}.`,
      mn: {
        prompt: `${mn} ${askTallest ? "Хамгийн өндөр нь хэн бэ?" : "Хамгийн намхан нь хэн бэ?"}`,
        right: NAMES_MN[answer], wrong: others.map((i) => NAMES_MN[i]),
        explanation: `Өндрөөс нам руу эрэмбэлбэл: ${idx.map((i) => NAMES_MN[i]).join(", ")}.`,
      },
    };
  }
  if (kind === 1) {
    // weekday arithmetic
    const today = int(r, 0, 6), n = pick(r, [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13]), future = r() < 0.5; // never a whole number of weeks
    const ans = (today + (future ? n : -n) + 7 * 3) % 7;
    const wrong = shuffle([0, 1, 2, 3, 4, 5, 6].filter((d) => d !== ans), r).slice(0, 3);
    return {
      cat: "logical", diff: 2,
      prompt: `If today is ${DAYS_EN[today]}, what day ${future ? `will it be in ${n} days` : `was it ${n} days ago`}?`,
      right: L(DAYS_EN[ans]), wrong: wrong.map((d) => L(DAYS_EN[d])),
      explanation: `Counting ${future ? "forward" : "back"} ${n} days from ${DAYS_EN[today]} gives ${DAYS_EN[ans]}.`,
      mn: {
        prompt: `Өнөөдөр ${DAYS_MN[today]} гараг бол ${n} хоногийн ${future ? "дараа ямар гараг болох вэ" : "өмнө ямар гараг байсан бэ"}?`,
        right: DAYS_MN[ans], wrong: wrong.map((d) => DAYS_MN[d]),
        explanation: `${DAYS_MN[today]} гарагаас ${n} хоног ${future ? "урагш" : "хойш"} тоолбол ${DAYS_MN[ans]} гарагт хүрнэ.`,
      },
    };
  }
  // syllogisms over invented words, so general knowledge cannot help
  const [a, b, c] = shuffle(NONSENSE_EN.map((_, i) => i), r).slice(0, 3);
  const E = (i: number) => NONSENSE_EN[i], M = (i: number) => NONSENSE_MN[i];
  if (r() < 0.5) {
    // No A are B. All C are A.  =>  No C are B
    return {
      cat: "logical", diff: 3,
      prompt: `No ${E(a)} are ${E(b)}. All ${E(c)} are ${E(a)}. Which statement must be true?`,
      right: L(`No ${E(c)} are ${E(b)}`),
      wrong: [L(`All ${E(c)} are ${E(b)}`), L(`Some ${E(c)} are ${E(b)}`), L(`All ${E(a)} are ${E(c)}`)],
      explanation: `All ${E(c)} are ${E(a)}, and no ${E(a)} are ${E(b)}, so no ${E(c)} can be ${E(b)}. The other statements need not hold.`,
      mn: {
        prompt: `Ямар ч ${M(a)} ${M(b)} биш. Бүх ${M(c)} нь ${M(a)}. Аль нь заавал үнэн вэ?`,
        right: `Ямар ч ${M(c)} ${M(b)} биш`,
        wrong: [`Бүх ${M(c)} нь ${M(b)}`, `Зарим ${M(c)} нь ${M(b)}`, `Бүх ${M(a)} нь ${M(c)}`],
        explanation: `${M(c)} бүр ${M(a)}, мөн ямар ч ${M(a)} ${M(b)} биш тул ямар ч ${M(c)} ${M(b)} байж чадахгүй. Бусад мэдэгдэл заавал биелэхгүй.`,
      },
    };
  }
  // All A are B. All B are C.  =>  All A are C
  return {
    cat: "logical", diff: 3,
    prompt: `All ${E(a)} are ${E(b)}. All ${E(b)} are ${E(c)}. Which statement must be true?`,
    right: L(`All ${E(a)} are ${E(c)}`),
    wrong: [L(`All ${E(c)} are ${E(a)}`), L(`No ${E(a)} are ${E(c)}`), L(`Some ${E(c)} are not ${E(b)}`)],
    explanation: `All ${E(a)} are ${E(b)} and all ${E(b)} are ${E(c)}, so all ${E(a)} must be ${E(c)}. The other statements need not hold.`,
    mn: {
      prompt: `Бүх ${M(a)} нь ${M(b)}. Бүх ${M(b)} нь ${M(c)}. Аль нь заавал үнэн вэ?`,
      right: `Бүх ${M(a)} нь ${M(c)}`,
      wrong: [`Бүх ${M(c)} нь ${M(a)}`, `Ямар ч ${M(a)} ${M(c)} биш`, `Зарим ${M(c)} нь ${M(b)} биш`],
      explanation: `${M(a)} бүр ${M(b)}, ${M(b)} бүр ${M(c)} тул ${M(a)} бүр ${M(c)}. Бусад мэдэгдэл заавал биелэхгүй.`,
    },
  };
}

// ------------------------------------------------------------------ visual pattern

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

const FILL_CYCLES: Fill[][] = [
  ["solid", "light", "outline"], ["solid", "outline", "light"], ["light", "solid", "outline"],
  ["light", "outline", "solid"], ["outline", "solid", "light"], ["outline", "light", "solid"],
  ["solid", "outline"], ["outline", "solid"], ["solid", "light"], ["light", "solid"], ["light", "outline"], ["outline", "light"],
];

type Attr = { shape: Shape; rot: number; fill: Fill; n: number };
type RuleName = "rot" | "count" | "fill" | "shape";
// Each attribute follows its own rule; combining rules makes a harder puzzle. Pairs and triples are listed twice so
// they come up more often than the single-rule warm-ups, which have far fewer variants.
const RULE_SETS: RuleName[][] = [
  ["rot"], ["count"], ["fill"], ["shape"],
  ["rot", "count"], ["rot", "fill"], ["shape", "count"], ["shape", "fill"], ["count", "fill"],
  ["rot", "count"], ["rot", "fill"], ["shape", "count"], ["shape", "fill"], ["count", "fill"],
  ["rot", "count", "fill"], ["shape", "count", "fill"], ["rot", "count", "fill"], ["shape", "count", "fill"],
];
const g = (a: Attr): Glyph => ({ k: "glyph", shape: a.shape, rot: a.rot, fill: a.fill, n: a.n });

function genAbstract(r: R): QDef {
  for (let attempt = 0; attempt < 50; attempt++) {
    const out = tryAbstract(r);
    if (out) return out;
  }
  throw new Error("could not generate a visual pattern with three distinct distractors");
}

function tryAbstract(r: R): QDef | null {
  const SHAPES: Shape[] = ["square", "circle", "triangle", "diamond", "star", "cross"];
  const rules = pick(r, RULE_SETS);
  const has = (x: RuleName) => rules.includes(x);
  const step = pick(r, [45, 90, -90, -45]);
  const rot0 = int(r, 0, 7) * 45;
  const delta = pick(r, [1, -1]);
  const fills = pick(r, FILL_CYCLES);
  const f0 = int(r, 0, fills.length - 1);
  const cycle = shuffle(SHAPES, r).slice(0, 3);
  const n0 = delta === 1 ? int(r, 1, 2) : int(r, 5, 6);
  const nConst = pick(r, [1, 1, 2, 3]);
  const fillConst = pick(r, ["solid", "solid", "light", "outline"] as Fill[]);
  // only the arrow and the triangle visibly rotate
  const baseShape: Shape = has("rot") ? pick(r, ["arrow", "triangle"] as Shape[]) : pick(r, ["square", "circle", "diamond", "star", "cross"] as Shape[]);
  const at = (i: number): Attr => ({
    shape: has("shape") ? cycle[i % 3] : baseShape,
    rot: has("rot") ? (((rot0 + step * i) % 360) + 360) % 360 : 0,
    fill: has("fill") ? fills[(f0 + i) % fills.length] : fillConst,
    n: has("count") ? n0 + delta * i : nConst,
  });
  const items = [0, 1, 2, 3].map((i) => g(at(i)));
  const ans = at(4);
  const answer = g(ans);

  const variants: Attr[] = [];
  const vary = (patch: Partial<Attr>) => variants.push({ ...ans, ...patch });
  if (has("rot")) { vary({ rot: (ans.rot + Math.abs(step)) % 360 }); vary({ rot: (ans.rot - Math.abs(step) + 360) % 360 }); vary({ rot: (ans.rot + 180) % 360 }); }
  if (has("count")) { vary({ n: ans.n + 1 }); vary({ n: Math.max(1, ans.n - 1) }); }
  if (has("fill")) for (const f of ["solid", "light", "outline"] as Fill[]) if (f !== ans.fill) vary({ fill: f });
  if (has("shape")) for (const sh of cycle) if (sh !== ans.shape) vary({ shape: sh });
  vary({ n: ans.n + 2 }); vary({ fill: ans.fill === "solid" ? "outline" : "solid" });
  const seen = new Set([figKey(answer)]);
  const wrong: Opt[] = [];
  for (const v of shuffle(variants, r)) {
    const f = g(v);
    const k = figKey(f);
    if (seen.has(k) || (f.n ?? 1) > 6) continue; // more copies than this are hard to count at a glance
    seen.add(k);
    wrong.push({ fig: f });
    if (wrong.length === 3) break;
  }
  if (wrong.length < 3) return null;

  const dir = step > 0 ? ["clockwise", "цагийн зүүний дагуу"] : ["counter-clockwise", "цагийн зүүний эсрэг"];
  const parts: Record<RuleName, [string, string]> = {
    rot: [`The ${baseShape} turns ${Math.abs(step)}° ${dir[0]} at each step.`, `${cap(SHAPE_MN[baseShape])} алхам бүрт ${dir[1]} ${Math.abs(step)}°-аар эргэнэ.`],
    count: [delta === 1 ? "One more copy is added at each step." : "One copy is removed at each step.", delta === 1 ? "Алхам бүрт нэг хувь нэмэгдэнэ." : "Алхам бүрт нэг хувь хасагдана."],
    fill: [`The fill cycles through ${fills.join(" → ")}.`, `Будалт ${fills.map((x) => FILL_MN[x]).join(" → ")} дарааллаар давтагдана.`],
    shape: [`The shapes repeat in a cycle of three: ${cycle.join(", ")}.`, `Дүрсүүд гурваар давтагдана: ${cycle.map((x) => SHAPE_MN[x]).join(", ")}.`],
  };
  return {
    cat: "abstract", diff: rules.length === 1 ? 2 : rules.length === 2 ? 3 : 4,
    prompt: "Which figure completes the sequence?",
    stem: { k: "seq", items: [...items, null] },
    right: { fig: answer }, wrong,
    explanation: rules.map((x) => parts[x][0]).join(" "),
    mn: { prompt: "Дараалал аль дүрсээр гүйцэх вэ?", explanation: rules.map((x) => parts[x][1]).join(" ") },
  };
}

// ------------------------------------------------------------------ memory

const WORDS = Object.keys(WORD_MN);

function genMemory(r: R): QDef {
  const kind = int(r, 0, 3);
  const digitsOf = (n: number) => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 0], r).slice(0, n).join("");
  const digitWrong = (correct: string): Opt[] => {
    const out = new Set<string>();
    for (let guard = 0; out.size < 3 && guard < 100; guard++) {
      const a = correct.split("");
      if (out.size % 2 === 0) { const i = int(r, 0, a.length - 2); [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
      else { const i = int(r, 0, a.length - 1); a[i] = String((Number(a[i]) + int(r, 1, 8)) % 10); }
      const s = a.join("");
      if (s !== correct) out.add(s);
    }
    return [...out].map((s) => L(spaced(s)));
  };
  if (kind === 0 || kind === 1) {
    const reverse = kind === 1, n = reverse ? 4 : 5, d = digitsOf(n), ans = reverse ? [...d].reverse().join("") : d;
    return {
      cat: "memory", diff: reverse ? 3 : 2,
      prompt: reverse ? "Which option is the digit sequence in REVERSE order?" : "Which option is the digit sequence you saw, in the same order?",
      stimulus: { text: spaced(d) }, stimulusSec: n + 3,
      right: L(spaced(ans)), wrong: digitWrong(ans),
      explanation: reverse ? `The sequence was ${spaced(d)}. Reversed it is ${spaced(ans)}.` : `The sequence was ${spaced(d)}.`,
      mn: {
        prompt: reverse ? "Цифрүүдийн дарааллыг ЭСРЭГ дарааллаар нь үзүүлж буй сонголтыг ол." : "Харсан цифрүүдийн дарааллыг ижил дарааллаар нь үзүүлж буй сонголтыг ол.",
        explanation: reverse ? `Дараалал ${spaced(d)} байсан. Урвуугаар нь ${spaced(ans)}.` : `Дараалал ${spaced(d)} байсан.`,
      },
    };
  }
  if (kind === 2) {
    const ORD = ["first", "second", "third", "fourth", "fifth"];
    const list = shuffle(WORDS, r).slice(0, 5), pos = int(r, 1, 5), ans = list[pos - 1];
    const others = shuffle(list.filter((w) => w !== ans), r).slice(0, 3);
    const mnList = list.map((w) => WORD_MN[w]);
    return {
      cat: "memory", diff: 2,
      prompt: `Which word was ${ORD[pos - 1]} in the list?`,
      stimulus: { text: list.join(" · ") }, stimulusSec: 8,
      right: L(ans), wrong: others.map(L),
      explanation: `The list was: ${list.join(", ")}. The ${ORD[pos - 1]} word was “${ans}”.`,
      mn: {
        prompt: `Жагсаалтын ${ORD_MN[pos - 1]} үг аль байсан бэ?`, stimulus: mnList.join(" · "),
        right: WORD_MN[ans], wrong: others.map((w) => WORD_MN[w]),
        explanation: `Жагсаалт: ${mnList.join(", ")}. ${ORD_MN[pos - 1]} үг нь “${WORD_MN[ans]}” байсан.`,
      },
    };
  }
  // A 3x3 grid with four lit squares or a 4x4 grid with five; wrong grids move one lit square elsewhere.
  const size = pick(r, [3, 4]), count = size === 3 ? 4 : 5;
  const grid = (cells: number[]): Matrix => Array.from({ length: size }, (_, rr) => Array.from({ length: size }, (_, c) => (cells.includes(rr * size + c) ? 1 : 0)));
  const lit = shuffle(Array.from({ length: size * size }, (_, i) => i), r).slice(0, count);
  const seen = new Set([[...lit].sort().join()]);
  const wrong: Opt[] = [];
  for (let guard = 0; wrong.length < 3 && guard < 200; guard++) {
    const m = [...lit];
    const out = int(r, 0, count - 1);
    const into = int(r, 0, size * size - 1);
    if (m.includes(into)) continue;
    m[out] = into;
    const k = [...m].sort().join();
    if (seen.has(k)) continue;
    seen.add(k);
    wrong.push({ fig: { k: "grid", cells: grid(m), full: true } });
  }
  const gridFig: Fig = { k: "grid", cells: grid(lit), full: true };
  return {
    cat: "memory", diff: 3,
    prompt: "Which grid matches the pattern of highlighted squares you saw?",
    stimulus: { fig: gridFig }, stimulusSec: 8,
    right: { fig: gridFig }, wrong,
    explanation: "The correct grid has exactly the squares that were highlighted; each wrong option moves one square.",
    mn: { prompt: "Харсан тодруулсан нүднүүдийн хэв маяг аль торонд тохирч байна вэ?", explanation: "Зөв тор нь тодруулсан нүднүүдтэй яг ижил; буруу сонголт бүр нэг нүдийг зөөсөн." },
  };
}

// ------------------------------------------------------------------ speed

function genSpeed(r: R): QDef {
  if (r() < 0.5) {
    let a: number, b: number, c: number, plus: boolean, value: number;
    do {
      a = int(r, 3, 9); b = int(r, 3, 9); c = int(r, 2, 20); plus = r() < 0.5;
      value = plus ? a * b + c : a * b - c;
    } while (value < 12); // keeps every distractor (value ± 1, 2, 10) positive
    const expr = `${a} × ${b} ${plus ? "+" : "−"} ${c}`;
    const wrong = shuffle([value + 1, value - 1, value + 10, value - 10, value + 2, value - 2], r).slice(0, 3);
    return {
      cat: "speed", diff: 2, timeLimitSec: 12,
      prompt: `Calculate quickly:  ${expr}`, right: L(String(value)), wrong: wrong.map((v) => L(String(v))),
      explanation: `${expr} = ${value}.`,
      mn: { prompt: `Хурдан бод:  ${expr}`, explanation: `${expr} = ${value}.` },
    };
  }
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const target = Array.from({ length: 6 }, () => ALPHA[int(r, 0, ALPHA.length - 1)]).join("");
  const wrong = new Set<string>();
  for (let guard = 0; wrong.size < 3 && guard < 500; guard++) {
    const a = target.split("");
    const i = int(r, 0, a.length - 2);
    if (r() < 0.5 && a[i] !== a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]];
    else a[i] = ALPHA[int(r, 0, ALPHA.length - 1)];
    const s = a.join("");
    if (s !== target) wrong.add(s);
  }
  return {
    cat: "speed", diff: 2, timeLimitSec: 14,
    prompt: `Find the code that is IDENTICAL to the target:  ${target}`, right: L(target), wrong: [...wrong].map(L),
    explanation: `The target was ${target}; each other option differs by one character or one swapped pair.`,
    mn: { prompt: `Зорилтот кодтой ЯГ ИЖИЛ кодыг ол:  ${target}`, explanation: `Зорилтот код ${target} байсан; бусад сонголт бүр нэг тэмдэгтээр эсвэл нэг хос солигдсоноор ялгаатай.` },
  };
}

/** The five questions for a date (YYYY-MM-DD): logic, number sequence, visual pattern, memory, timed exercise. */
export function generateDaily(day: string): Generated[] {
  const r = rng(hashStr(`intelliq-daily-v2-${day}`));
  return [
    { slot: "logical", q: genLogical(r) },
    { slot: "numerical", q: genNumerical(r) },
    { slot: "abstract", q: genAbstract(r) },
    { slot: "memory", q: genMemory(r) },
    { slot: "speed", q: genSpeed(r) },
  ];
}
