import { predictNext } from "../../../lib/daily-gen";
import { L, rng, shuffle, type QDef } from "../types";
import { DIFFS, collect, int, pick, wrongNumbers, type Diff, type R } from "./util";

/*
 * 120 generated numerical-reasoning questions: 24 per difficulty level. Three kinds:
 *  - number sequences (60): every one is checked with predictNext so no other simple rule gives a different next term;
 *  - arithmetic with operator precedence (25);
 *  - word problems (35): percentages, fractions, speed/distance, ratios, averages, equations, ages, work rates.
 * The correct answer is always computed, never typed in. generated.test.ts re-solves every question independently.
 */

// ------------------------------------------------------------------ sequences

type Seq = { shown: number[]; next: number; en: string; mn: string; certified?: boolean };

const arithUp = (r: R, lo: number, hi: number): Seq => {
  const s = int(r, 1, 60), d = int(r, lo, hi), t = (i: number) => s + d * i;
  return { shown: [0, 1, 2, 3, 4].map(t), next: t(5), en: `The series adds ${d} each time, so ${t(4)} + ${d} = ${t(5)}.`, mn: `Алхам бүрт +${d}: ${t(4)} + ${d} = ${t(5)}.`, certified: true };
};
const arithDown = (r: R, lo: number, hi: number): Seq => {
  const d = int(r, lo, hi), s = int(r, 5 * d + 1, 5 * d + 60), t = (i: number) => s - d * i;
  return { shown: [0, 1, 2, 3, 4].map(t), next: t(5), en: `The series subtracts ${d} each time, so ${t(4)} − ${d} = ${t(5)}.`, mn: `Алхам бүрт −${d}: ${t(4)} − ${d} = ${t(5)}.`, certified: true };
};
const geometric = (r: R, m: number, maxStart: number): Seq => {
  const s = int(r, 1, maxStart), t = (i: number) => s * m ** i;
  return { shown: [0, 1, 2, 3, 4].map(t), next: t(5), en: `Each term is ${m} times the previous one: ${t(4)} × ${m} = ${t(5)}.`, mn: `Гишүүн бүр өмнөхөөсөө ${m} дахин их: ${t(4)} × ${m} = ${t(5)}.`, certified: true };
};
const alternating = (r: R): Seq => {
  const s = int(r, 1, 30), x = int(r, 2, 8), y = int(r, x + 1, 11), t = [s];
  for (let i = 0; i < 6; i++) t.push(t[i] + (i % 2 === 0 ? x : y));
  return { shown: t.slice(0, 6), next: t[6], en: `The steps alternate +${x}, +${y}, +${x}, +${y}, +${x}, so the next step is +${y}: ${t[5]} + ${y} = ${t[6]}.`, mn: `Алхмууд ээлжлэн +${x}, +${y}, +${x}, +${y}, +${x} болж байгаа тул дараагийн алхам +${y}: ${t[5]} + ${y} = ${t[6]}.`, certified: true };
};
const squares = (r: R, n0lo: number, n0hi: number): Seq => {
  const k = int(r, 0, 30), n0 = int(r, n0lo, n0hi), t = (i: number) => (n0 + i) ** 2 + k;
  return { shown: [0, 1, 2, 3, 4, 5].map(t), next: t(6), en: `The terms are n² + ${k} (n = ${n0}, ${n0 + 1}, …), so the next is ${n0 + 6}² + ${k} = ${t(6)}.`, mn: `Гишүүд нь n² + ${k} (n = ${n0}, ${n0 + 1}, …) тул дараагийнх нь ${n0 + 6}² + ${k} = ${t(6)}.`, certified: true };
};
const doublePlus = (r: R): Seq => {
  const m = pick(r, [2, 2, 3]), c = pick(r, [-3, -2, -1, 1, 2, 3, 4, 5]), s = int(r, 2, 9), t = [s];
  for (let i = 0; i < 5; i++) t.push(m * t[i] + c);
  const sign = c >= 0 ? `+ ${c}` : `− ${-c}`;
  const times = m === 2 ? ["double", "хоёр дахин"] : ["triple", "гурав дахин"];
  return { shown: t.slice(0, 5), next: t[5], en: `Each term is ${times[0]} the previous one ${sign}: ${m} × ${t[4]} ${sign} = ${t[5]}.`, mn: `Гишүүн бүр өмнөхийнхөө ${times[1]} ${sign}: ${m} × ${t[4]} ${sign} = ${t[5]}.`, certified: true };
};
const growingGaps = (r: R, down: boolean): Seq => {
  const d0 = int(r, 1, 6), e = int(r, 1, 3), sgn = down ? -1 : 1, t: number[] = [];
  let cur = down ? int(r, 150, 400) : int(r, 1, 30);
  t.push(cur);
  for (let i = 0; i < 6; i++) { cur += sgn * (d0 + e * i); t.push(cur); }
  const gap = d0 + 5 * e, sign = down ? "−" : "+";
  return { shown: t.slice(0, 6), next: t[6], en: `The gaps grow by ${e} each time (${sign}${d0}, ${sign}${d0 + e}, ${sign}${d0 + 2 * e}, …), so the next gap is ${sign}${gap}: ${t[5]} ${sign} ${gap} = ${t[6]}.`, mn: `Зөрүү бүр өмнөхөөсөө ${e} их болж байна (${sign}${d0}, ${sign}${d0 + e}, ${sign}${d0 + 2 * e}, …), иймд дараагийн зөрүү ${sign}${gap}: ${t[5]} ${sign} ${gap} = ${t[6]}.`, certified: true };
};
const fibonacci = (r: R): Seq => {
  const a = int(r, 1, 12), b = int(r, 1, 12), t = [a, b];
  for (let i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2]);
  return { shown: t.slice(0, 6), next: t[6], en: `Each term is the sum of the previous two: ${t[4]} + ${t[5]} = ${t[6]}.`, mn: `Гишүүн бүр өмнөх хоёрынхоо нийлбэр: ${t[4]} + ${t[5]} = ${t[6]}.`, certified: true };
};
const cubes = (r: R): Seq => {
  const n0 = int(r, 1, 3), k = int(r, 0, 20), t = (i: number) => (n0 + i) ** 3 + k;
  return { shown: [0, 1, 2, 3, 4].map(t), next: t(5), en: `The terms are n³ + ${k} (n = ${n0}, ${n0 + 1}, …), so the next is ${n0 + 5}³ + ${k} = ${t(5)}.`, mn: `Гишүүд нь n³ + ${k} (n = ${n0}, ${n0 + 1}, …) тул дараагийнх нь ${n0 + 5}³ + ${k} = ${t(5)}.` };
};
const interleaved = (r: R): Seq => {
  const a = int(r, 1, 20), b = int(r, 30, 60), da = int(r, 2, 7), db = int(r, 1, 6);
  if (da === db) return interleaved(r);
  const t: number[] = [];
  for (let i = 0; i < 4; i++) t.push(a + da * i, b + db * i);
  const next = a + da * 4;
  return { shown: t, next, en: `Two series are woven together. Every other term goes up by ${da} (${a}, ${a + da}, …) and the terms in between go up by ${db} (${b}, ${b + db}, …). The next term continues the first series: ${a + da * 3} + ${da} = ${next}.`, mn: `Хоёр цуваа ээлжлэн орсон. Сондгой байрлалын гишүүд алхам бүрт +${da} (${a}, ${a + da}, …), тэгш байрлалын гишүүд алхам бүрт +${db} (${b}, ${b + db}, …) болно. Дараагийн гишүүн эхний цувааг үргэлжлүүлнэ: ${a + da * 3} + ${da} = ${next}.` };
};
const altOps = (r: R): Seq => {
  const s = int(r, 1, 5), m = pick(r, [2, 3]), k = int(r, 1, 5), t = [s];
  for (let i = 0; i < 6; i++) t.push(i % 2 === 0 ? t[i] * m : t[i] + k);
  return { shown: t.slice(0, 6), next: t[6], en: `The operations alternate: × ${m}, + ${k}, × ${m}, + ${k}, … so the next step is + ${k}: ${t[5]} + ${k} = ${t[6]}.`, mn: `Үйлдлүүд ээлжилнэ: × ${m}, + ${k}, × ${m}, + ${k}, … иймд дараагийн алхам + ${k}: ${t[5]} + ${k} = ${t[6]}.` };
};
const squareGaps = (r: R): Seq => {
  const s = int(r, 0, 12), t = [s];
  for (let i = 0; i < 6; i++) t.push(t[i] + (i + 1) ** 2);
  return { shown: t.slice(0, 6), next: t[6], en: `The gaps are the square numbers 1, 4, 9, 16, 25, so the next gap is 36: ${t[5]} + 36 = ${t[6]}.`, mn: `Зөрүүнүүд нь 1, 4, 9, 16, 25 гэсэн квадрат тоонууд тул дараагийн зөрүү 36: ${t[5]} + 36 = ${t[6]}.` };
};

const SEQ_BY_DIFF: Record<Diff, ((r: R) => Seq)[]> = {
  1: [(r) => arithUp(r, 2, 5), (r) => arithUp(r, 2, 5), (r) => arithDown(r, 2, 5)],
  2: [(r) => arithUp(r, 6, 15), (r) => arithDown(r, 6, 14), (r) => geometric(r, 2, 8)],
  3: [alternating, (r) => squares(r, 1, 6), doublePlus, (r) => geometric(r, 3, 3)],
  4: [(r) => growingGaps(r, false), (r) => growingGaps(r, true), fibonacci, (r) => squares(r, 7, 14), cubes],
  5: [interleaved, altOps, squareGaps, interleaved, altOps],
};

function seqQuestion(r: R, diff: Diff): QDef | null {
  const f = pick(r, SEQ_BY_DIFF[diff])(r);
  const all = [...f.shown, f.next];
  if (all.some((v) => !Number.isInteger(v) || v < 0 || v > 999)) return null;
  const pred = predictNext(f.shown);
  // No simple recurrence may predict a different next term (and for the certified families exactly this one must).
  if (pred.some((p) => p !== f.next) || (f.certified && pred.length !== 1)) return null;
  const last = f.shown[f.shown.length - 1], prev = f.shown[f.shown.length - 2];
  const wrong = wrongNumbers(r, f.next, [last + (last - prev), last * 2, last + 1], 0);
  if (!wrong) return null;
  const seq = f.shown.join(", ");
  return {
    cat: "numerical", diff,
    prompt: `What comes next?  ${seq}, ?`,
    right: L(String(f.next)), wrong: wrong.map((v) => L(String(v))),
    explanation: f.en,
    mn: { prompt: `Дараагийн тоо юу вэ?  ${seq}, ?`, explanation: f.mn },
  };
}

// ------------------------------------------------------------------ arithmetic with precedence

function exprQuestion(r: R, diff: Diff): QDef | null {
  let expr = "", value = 0, trap = NaN, en = "", mn = "";
  const a = int(r, 2, 30), b = int(r, 2, 9), c = int(r, 2, 9), d = int(r, 2, 9), e = int(r, 2, 6);
  switch (diff) {
    case 1:
      if (r() < 0.5) {
        value = a + b * c; trap = (a + b) * c; expr = `${a} + ${b} × ${c}`;
        en = `Multiplication comes first: ${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${value}.`;
        mn = `Эхлээд үржүүлнэ: ${b} × ${c} = ${b * c}, дараа нь ${a} + ${b * c} = ${value}.`;
      } else {
        if (a <= b * c) return null;
        value = a - b * c; trap = (a - b) * c; expr = `${a} − ${b} × ${c}`;
        en = `Multiplication comes first: ${b} × ${c} = ${b * c}, then ${a} − ${b * c} = ${value}.`;
        mn = `Эхлээд үржүүлнэ: ${b} × ${c} = ${b * c}, дараа нь ${a} − ${b * c} = ${value}.`;
      }
      break;
    case 2:
      if (r() < 0.5) {
        value = (a + b) * c; trap = a + b * c; expr = `(${a} + ${b}) × ${c}`;
        en = `Brackets first: ${a} + ${b} = ${a + b}, then ${a + b} × ${c} = ${value}.`;
        mn = `Эхлээд хаалтыг бодно: ${a} + ${b} = ${a + b}, дараа нь ${a + b} × ${c} = ${value}.`;
      } else {
        if (a + b * c - d < 1) return null;
        value = a + b * c - d; trap = (a + b) * c - d; expr = `${a} + ${b} × ${c} − ${d}`;
        en = `Multiplication first: ${b} × ${c} = ${b * c}; then ${a} + ${b * c} − ${d} = ${value}.`;
        mn = `Эхлээд үржүүлнэ: ${b} × ${c} = ${b * c}; дараа нь ${a} + ${b * c} − ${d} = ${value}.`;
      }
      break;
    case 3:
      if (r() < 0.5) {
        if (b * c - d * e < 1) return null;
        value = b * c - d * e; trap = (b * c - d) * e; expr = `${b} × ${c} − ${d} × ${e}`;
        en = `Both products first: ${b} × ${c} = ${b * c} and ${d} × ${e} = ${d * e}; then ${b * c} − ${d * e} = ${value}.`;
        mn = `Эхлээд хоёр үржвэрийг бодно: ${b} × ${c} = ${b * c}, ${d} × ${e} = ${d * e}; дараа нь ${b * c} − ${d * e} = ${value}.`;
      } else {
        if (a <= b) return null;
        value = (a - b) * c + d; trap = a - b * c + d; expr = `(${a} − ${b}) × ${c} + ${d}`;
        en = `Brackets first: ${a} − ${b} = ${a - b}; then ${a - b} × ${c} = ${(a - b) * c}, and ${(a - b) * c} + ${d} = ${value}.`;
        mn = `Эхлээд хаалтыг бодно: ${a} − ${b} = ${a - b}; дараа нь ${a - b} × ${c} = ${(a - b) * c}, ${(a - b) * c} + ${d} = ${value}.`;
      }
      break;
    case 4:
      if (r() < 0.5) {
        const q = int(r, 2, 9), div = int(r, 2, 6), num = q * div;
        value = b * c + q; trap = (b * c + num) / div; expr = `${b} × ${c} + ${num} ÷ ${div}`;
        en = `Multiplication and division first: ${b} × ${c} = ${b * c} and ${num} ÷ ${div} = ${q}; then ${b * c} + ${q} = ${value}.`;
        mn = `Эхлээд үржих, хуваахыг бодно: ${b} × ${c} = ${b * c}, ${num} ÷ ${div} = ${q}; дараа нь ${b * c} + ${q} = ${value}.`;
      } else {
        const x = int(r, 3, 9), y = int(r, 2, x - 1);
        value = (a + b) * (x - y); trap = a + b * x - y; expr = `(${a} + ${b}) × (${x} − ${y})`;
        en = `Both brackets first: ${a} + ${b} = ${a + b} and ${x} − ${y} = ${x - y}; then ${a + b} × ${x - y} = ${value}.`;
        mn = `Эхлээд хоёр хаалтыг бодно: ${a} + ${b} = ${a + b}, ${x} − ${y} = ${x - y}; дараа нь ${a + b} × ${x - y} = ${value}.`;
      }
      break;
    default:
      if (r() < 0.5) {
        const div = int(r, 2, 7), inner = int(r, 3, 12) * div, f = int(r, 2, 9);
        // (f × b − k) ÷ div where the numerator is a multiple of div
        const num = inner, k = f * b - num;
        if (k < 1) return null;
        value = num / div; trap = f * b - k / div; expr = `(${f} × ${b} − ${k}) ÷ ${div}`;
        en = `Inside the bracket: ${f} × ${b} = ${f * b}, then ${f * b} − ${k} = ${num}; ${num} ÷ ${div} = ${value}.`;
        mn = `Хаалтан дотор: ${f} × ${b} = ${f * b}, дараа нь ${f * b} − ${k} = ${num}; ${num} ÷ ${div} = ${value}.`;
      } else {
        if (a * b - (c + d) * e < 1) return null;
        value = a * b - (c + d) * e; trap = (a * b - c + d) * e; expr = `${a} × ${b} − (${c} + ${d}) × ${e}`;
        en = `Bracket first: ${c} + ${d} = ${c + d}; products: ${a} × ${b} = ${a * b} and ${c + d} × ${e} = ${(c + d) * e}; then ${a * b} − ${(c + d) * e} = ${value}.`;
        mn = `Эхлээд хаалт: ${c} + ${d} = ${c + d}; үржвэрүүд: ${a} × ${b} = ${a * b}, ${c + d} × ${e} = ${(c + d) * e}; дараа нь ${a * b} − ${(c + d) * e} = ${value}.`;
      }
  }
  if (!Number.isInteger(value) || value < 1 || value > 600) return null;
  const wrong = wrongNumbers(r, value, Number.isInteger(trap) ? [trap] : [], 1);
  if (!wrong) return null;
  return {
    cat: "numerical", diff,
    prompt: `Calculate: ${expr}`,
    right: L(String(value)), wrong: wrong.map((v) => L(String(v))),
    explanation: en, mn: { prompt: `Бод: ${expr}`, explanation: mn },
  };
}

// ------------------------------------------------------------------ word problems

type WP = { en: string; mn: string; value: number; traps?: number[]; ee: string; me: string; fmt?: (n: number) => string };
function wp(r: R, diff: Diff, v: WP): QDef | null {
  if (!Number.isInteger(v.value) || v.value < 1) return null;
  const wrong = wrongNumbers(r, v.value, v.traps, 1);
  if (!wrong) return null;
  const f = v.fmt ?? String;
  return {
    cat: "numerical", diff, prompt: v.en,
    right: L(f(v.value)), wrong: wrong.map((w) => L(f(w))),
    explanation: v.ee, mn: { prompt: v.mn, explanation: v.me },
  };
}
const pct = (n: number) => `${n}%`;

const percentOf = (r: R, d: Diff) => {
  const p = pick(r, [10, 20, 25, 50, 75, 5]), n = pick(r, [40, 60, 80, 120, 160, 200, 240, 300, 400, 480, 600]);
  const v = (n * p) / 100;
  return wp(r, d, { en: `What is ${p}% of ${n}?`, mn: `Нийт ${n} байна. Түүний ${p} хувь нь хэд вэ?`, value: v, traps: [n - v, p, (n * p) / 10], ee: `${p}% of ${n} is ${n} × ${p} ÷ 100 = ${v}.`, me: `${p} хувь = ${n} × ${p} ÷ 100 = ${v}.` });
};
const fractionOf = (r: R, d: Diff) => {
  const den = pick(r, [2, 3, 4, 5, 6, 8]), num = int(r, 1, den - 1), unit = int(r, 3, 15), n = den * unit;
  if (num === 1 && den === 2 && r() < 0.5) return null;
  const v = unit * num;
  return wp(r, d, { en: `What is ${num}/${den} of ${n}?`, mn: `Нийт ${n} байна. Түүний ${num}/${den} нь хэд вэ?`, value: v, traps: [n - v, unit, n / den + num], ee: `One ${den}th of ${n} is ${unit}, so ${num}/${den} is ${unit} × ${num} = ${v}.`, me: `Нийтийг ${den} тэнцүү хэсэгт хуваавал нэг хэсэг ${n} ÷ ${den} = ${unit}, иймд ${num}/${den} нь ${unit} × ${num} = ${v}.` });
};
const rectangle = (r: R, d: Diff) => {
  const l = int(r, 4, 25), w = int(r, 2, l - 1), area = r() < 0.5;
  const v = area ? l * w : 2 * (l + w);
  return wp(r, d, area
    ? { en: `A rectangle is ${l} long and ${w} wide. What is its area?`, mn: `Тэгш өнцөгтийн урт нь ${l}, өргөн нь ${w}. Түүний талбай хэд вэ?`, value: v, traps: [2 * (l + w), l + w], ee: `Area = length × width = ${l} × ${w} = ${v}.`, me: `Талбай = урт × өргөн = ${l} × ${w} = ${v}.` }
    : { en: `A rectangle is ${l} long and ${w} wide. What is its perimeter?`, mn: `Тэгш өнцөгтийн урт нь ${l}, өргөн нь ${w}. Түүний периметр хэд вэ?`, value: v, traps: [l * w, l + w], ee: `Perimeter = 2 × (length + width) = 2 × (${l} + ${w}) = ${v}.`, me: `Периметр = 2 × (урт + өргөн) = 2 × (${l} + ${w}) = ${v}.` });
};
const eqSimple = (r: R, d: Diff) => {
  const x = int(r, 2, 30), a = int(r, 3, 40);
  return r() < 0.5
    ? wp(r, d, { en: `If x + ${a} = ${x + a}, what is x?`, mn: `x + ${a} = ${x + a} бол x хэд вэ?`, value: x, traps: [x + a + a, a], ee: `Subtract ${a} from both sides: x = ${x + a} − ${a} = ${x}.`, me: `Хоёр талаас ${a} хасвал: x = ${x + a} − ${a} = ${x}.` })
    : wp(r, d, { en: `If ${x + a} − x = ${a}, what is x?`, mn: `${x + a} − x = ${a} бол x хэд вэ?`, value: x, traps: [x + a + a, a], ee: `x = ${x + a} − ${a} = ${x}.`, me: `x = ${x + a} − ${a} = ${x}.` });
};
const eqLinear = (r: R, d: Diff) => {
  const a = int(r, 2, 9), x = int(r, 2, 15), b = int(r, 1, 30), c = a * x + b;
  return wp(r, d, { en: `If ${a}x + ${b} = ${c}, what is x?`, mn: `${a}x + ${b} = ${c} бол x хэд вэ?`, value: x, traps: [c - b, (c + b) / a, c - b - a], ee: `${a}x = ${c} − ${b} = ${c - b}, so x = ${c - b} ÷ ${a} = ${x}.`, me: `${a}x = ${c} − ${b} = ${c - b}, иймд x = ${c - b} ÷ ${a} = ${x}.` });
};
const eqBoth = (r: R, d: Diff) => {
  const c = int(r, 1, 5), a = c + int(r, 1, 6), x = int(r, 2, 15), b = int(r, 0, 20), e = a * x + b - c * x;
  return wp(r, d, { en: `If ${a}x + ${b} = ${c}x + ${e}, what is x?`, mn: `${a}x + ${b} = ${c}x + ${e} бол x хэд вэ?`, value: x, traps: [e + b, (e + b) / (a + c)], ee: `Move the x terms to one side: ${a - c}x = ${e} − ${b} = ${e - b}, so x = ${x}.`, me: `x-тэй гишүүдийг нэг тал руу шилжүүлнэ: ${a - c}x = ${e} − ${b} = ${e - b}, иймд x = ${x}.` });
};
const discount = (r: R, d: Diff) => {
  const p = pick(r, [10, 20, 25, 30, 40, 50]), n = pick(r, [40, 60, 80, 120, 150, 200, 240, 300]);
  const off = (n * p) / 100, v = n - off;
  return wp(r, d, { en: `A coat costs $${n} and is discounted by ${p}%. What is the sale price?`, mn: `Хүрэмний анхны үнэ $${n}. Хөнгөлөлт: ${p} хувь. Хөнгөлсний дараах үнэ хэд вэ?`, value: v, traps: [off, n + off], fmt: (x) => `$${x}`, ee: `${p}% of $${n} is $${off}, so the price is $${n} − $${off} = $${v}.`, me: `Хөнгөлөлт: ${n} × ${p} ÷ 100 = ${off}, иймд үнэ ${n} − ${off} = ${v}.` });
};
const distance = (r: R, d: Diff) => {
  const s = int(r, 30, 120), t = int(r, 2, 6), kind = pick(r, ["dist", "time", "speed"] as const);
  if (kind === "dist" || d <= 2) {
    return wp(r, d, { en: `A train travels at ${s} kilometres per hour for ${t} hours. How many kilometres does it cover?`, mn: `Галт тэрэг цагт ${s} километрийн хурдтайгаар ${t} цаг явна. Хэдэн километр туулах вэ?`, value: s * t, traps: [s + t, s * (t + 1)], ee: `Distance = speed × time = ${s} × ${t} = ${s * t}.`, me: `Зам = хурд × хугацаа = ${s} × ${t} = ${s * t}.` });
  }
  if (kind === "time") {
    return wp(r, d, { en: `A bus travels at ${s} kilometres per hour. How many hours does it need for ${s * t} kilometres?`, mn: `Автобус цагт ${s} километрийн хурдтай. ${s * t} километр явахад хэдэн цаг шаардлагатай вэ?`, value: t, traps: [s * t * s, s], ee: `Time = distance ÷ speed = ${s * t} ÷ ${s} = ${t}.`, me: `Хугацаа = зам ÷ хурд = ${s * t} ÷ ${s} = ${t}.` });
  }
  return wp(r, d, { en: `A car covers ${s * t} kilometres in ${t} hours. What is its average speed in kilometres per hour?`, mn: `Машин ${s * t} километрийг ${t} цагт туулав. Цагт дунджаар хэдэн километрийн хурдтай явсан бэ?`, value: s, traps: [s * t * t, s * t - t], ee: `Speed = distance ÷ time = ${s * t} ÷ ${t} = ${s}.`, me: `Хурд = зам ÷ хугацаа = ${s * t} ÷ ${t} = ${s}.` });
};
const average3 = (r: R, d: Diff) => {
  const m = int(r, 6, 40), a = m - int(r, 1, 5), b = m + int(r, 1, 5), c = 3 * m - a - b, list = shuffle([a, b, c], r);
  return wp(r, d, { en: `What is the average of ${list.join(", ")}?`, mn: `Эдгээр тооны дундаж хэд вэ?  ${list.join(", ")}`, value: m, traps: [(a + b + c) / 2, Math.max(a, b, c)], ee: `The sum is ${a + b + c}; divided by 3 it is ${m}.`, me: `Нийлбэр нь ${a + b + c}; дундаж = ${a + b + c} ÷ 3 = ${m}.` });
};
const averageMissing = (r: R, d: Diff) => {
  const m = int(r, 8, 40), a = m - int(r, 1, 6), b = m + int(r, 1, 6), c = m - int(r, 0, 4), x = 4 * m - a - b - c;
  return wp(r, d, { en: `The average of four numbers is ${m}. Three of them are ${a}, ${b} and ${c}. What is the fourth?`, mn: `Дөрвөн тооны дундаж ${m}. Гурав нь ${a}, ${b}, ${c} бол дөрөв дэх тоо хэд вэ?`, value: x, traps: [m, 4 * m], ee: `The four numbers add up to 4 × ${m} = ${4 * m}. The fourth is ${4 * m} − ${a} − ${b} − ${c} = ${x}.`, me: `Дөрвөн тооны нийлбэр 4 × ${m} = ${4 * m}. Дөрөв дэх нь ${4 * m} − ${a} − ${b} − ${c} = ${x}.` });
};
const ratio = (r: R, d: Diff) => {
  const a = int(r, 1, 5), b = int(r, a + 1, 8), unit = int(r, 3, 15), n = (a + b) * unit;
  const first = r() < 0.5;
  return wp(r, d, { en: `Share ${n} in the ratio ${a}:${b}. How much is the ${first ? "first" : "second"} part?`, mn: `Нийт нь ${n}. Үүнийг ${a}:${b} харьцаагаар хуваавал ${first ? "эхний" : "хоёр дахь"} хэсэг нь хэд болох вэ?`, value: unit * (first ? a : b), traps: [unit * (first ? b : a), n / 2, a * b], ee: `There are ${a} + ${b} = ${a + b} equal parts of ${n} ÷ ${a + b} = ${unit} each, so the ${first ? "first" : "second"} part is ${unit} × ${first ? a : b} = ${unit * (first ? a : b)}.`, me: `${a} + ${b} = ${a + b} тэнцүү хэсэг, нэг нь ${n} ÷ ${a + b} = ${unit}, иймд ${first ? "эхний" : "хоёр дахь"} хэсэг ${unit} × ${first ? a : b} = ${unit * (first ? a : b)}.` });
};
const ITEMS: [string, string][] = [["pens", "үзэг"], ["notebooks", "дэвтэр"], ["apples", "алим"], ["candles", "лаа"], ["pencils", "харандаа"]];
const unitPrice = (r: R, d: Diff) => {
  const [en, mn] = pick(r, ITEMS), a = int(r, 2, 8), each = int(r, 2, 9), b = a * int(r, 2, 5) + (r() < 0.5 ? 0 : a);
  const total = a * each, v = each * b;
  return wp(r, d, { en: `If ${a} ${en} cost $${total}, how much do ${b} ${en} cost?`, mn: `Хэрэв ${a} ${mn} $${total} бол ${b} ${mn} хэдэн доллар вэ?`, value: v, traps: [total + b, total * b], fmt: (x) => `$${x}`, ee: `One costs $${total} ÷ ${a} = $${each}, so ${b} cost ${b} × $${each} = $${v}.`, me: `Нэгийн үнэ $${total} ÷ ${a} = $${each}, иймд ${b} нь ${b} × $${each} = $${v}.` });
};
const work = (r: R, d: Diff) => {
  const a = int(r, 2, 8), days = int(r, 3, 12), total = a * days;
  const divisors = Array.from({ length: total }, (_, i) => i + 1).filter((x) => total % x === 0 && x !== a && x <= 24);
  if (divisors.length === 0) return null;
  const b = pick(r, divisors), v = total / b;
  return wp(r, d, { en: `${a} workers finish a job in ${days} days. How many days would ${b} workers at the same pace need?`, mn: `${a} ажилтан нэг ажлыг ${days} хоногт дуусгана. Адил хурдтай ${b} ажилтан хэдэн хоногт дуусгах вэ?`, value: v, traps: [days + (b - a), days * b / a], ee: `The job is ${a} × ${days} = ${total} worker-days, so ${b} workers need ${total} ÷ ${b} = ${v} days.`, me: `Ажил нийт ${a} × ${days} = ${total} хүн-хоног, иймд ${b} ажилтан ${total} ÷ ${b} = ${v} хоногт дуусгана.` });
};
const percentChange = (r: R, d: Diff) => {
  const p = pick(r, [10, 20, 25, 50]), base = pick(r, [40, 60, 80, 120, 200]), up = r() < 0.5;
  const to = up ? base + (base * p) / 100 : base - (base * p) / 100;
  return wp(r, d, { en: `A price changes from ${base} to ${to}. By what percent did it ${up ? "rise" : "fall"}?`, mn: `Анхны үнэ ${base}, шинэ үнэ ${to}. Үнэ хэдэн хувиар ${up ? "өссөн" : "буурсан"} бэ?`, value: p, traps: [Math.round((Math.abs(to - base) / to) * 100), Math.abs(to - base)], fmt: pct, ee: `The change is ${Math.abs(to - base)}, and ${Math.abs(to - base)} ÷ ${base} = ${p}%.`, me: `Өөрчлөлт нь ${Math.abs(to - base)}, ${Math.abs(to - base)} ÷ ${base} = ${p}%.` });
};
const NAMES: [string, string][] = [["Ann", "Ану"], ["Ben", "Бат"], ["Cara", "Цэцэг"], ["Dan", "Дорж"]];
const ages = (r: R, d: Diff) => {
  const [[e1, m1], [e2, m2]] = shuffle(NAMES, r).slice(0, 2), ben = int(r, 5, 20), diff = int(r, 2, 9), n = int(r, 2, 8);
  const sum = 2 * ben + diff + 2 * n;
  return wp(r, d, { en: `${e1} is ${diff} years older than ${e2}. In ${n} years the sum of their ages will be ${sum}. How old is ${e2} now?`, mn: `${m1} ба ${m2} хоёрын насны зөрүү ${diff} бөгөөд ${m1} нь ах. ${n} жилийн дараа тэдний насны нийлбэр ${sum} болно. ${m2} одоо хэдтэй вэ?`, value: ben, traps: [ben + n, sum / 2, ben + diff], ee: `Now the ages add up to ${sum} − 2 × ${n} = ${sum - 2 * n}. If ${e2} is x then ${e1} is x + ${diff}: 2x + ${diff} = ${sum - 2 * n}, so x = ${ben}.`, me: `Одоо тэдний насны нийлбэр ${sum} − 2 × ${n} = ${sum - 2 * n}. ${m2} x настай бол ${m1} x + ${diff}: 2x + ${diff} = ${sum - 2 * n}, иймд x = ${ben}.` });
};
const percentOfPercent = (r: R, d: Diff) => {
  const p1 = pick(r, [50, 25, 20, 10]), p2 = pick(r, [50, 20, 10, 40]), n = pick(r, [200, 400, 600, 800, 1000, 300, 500]);
  const mid = (n * p1) / 100, v = (mid * p2) / 100;
  return wp(r, d, { en: `What is ${p2}% of ${p1}% of ${n}?`, mn: `Нийт ${n} байна. Эхлээд түүний ${p1} хувийг ав, дараа нь гарсан хэмжээний ${p2} хувийг ол. Хариу хэд вэ?`, value: v, traps: [(n * (p1 + p2)) / 100, mid], ee: `${p1}% of ${n} is ${mid}, and ${p2}% of ${mid} is ${v}.`, me: `Эхний алхам: ${n} × ${p1} ÷ 100 = ${mid}; хоёр дахь алхам: ${mid} × ${p2} ÷ 100 = ${v}.` });
};

const WP_BY_DIFF: Record<Diff, ((r: R, d: Diff) => QDef | null)[]> = {
  1: [percentOf, percentOf, fractionOf, fractionOf, rectangle, rectangle, eqSimple],
  2: [discount, discount, distance, distance, average3, average3, eqLinear],
  3: [ratio, ratio, unitPrice, unitPrice, work, distance, distance],
  4: [averageMissing, averageMissing, percentChange, percentChange, eqBoth, eqBoth, work],
  5: [ages, ages, ages, ratio, ratio, percentOfPercent, percentOfPercent],
};
// Questions per difficulty: 12 sequences + 5 arithmetic + 7 word problems = 24.

/** 120 questions, grouped by difficulty (24 each), deterministic. */
export function generateNumerical(seen: Set<string> = new Set()): QDef[] {
  const r = rng(0x4e554d31); // "NUM1"
  const out: QDef[] = [];
  for (const diff of DIFFS) {
    out.push(...collect(12, seen, () => seqQuestion(r, diff), `numerical ${diff} sequences`));
    out.push(...collect(5, seen, () => exprQuestion(r, diff), `numerical ${diff} arithmetic`));
    // the word problems of a level, one of each listed kind (in a stable order), with fresh numbers
    const makers = WP_BY_DIFF[diff];
    makers.forEach((make, i) => out.push(...collect(1, seen, () => make(r, diff), `numerical ${diff} word problem ${i}`)));
  }
  return out;
}
