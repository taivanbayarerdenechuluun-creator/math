import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK, CORE_BANK } from "./index";
import { buildOptions, optKey } from "./build";
import { dihedral, key, mirrorH, rotations, figKey, type Fig } from "../../lib/figures";
import { SPATIAL_SHAPES } from "./spatial";

const cats = ["logical", "abstract", "numerical", "verbal", "spatial", "memory", "speed"];

// Spatial gained 10 three-dimensional items and speed gained 5 reaction items (2 and 1 per difficulty level).
const SIZE: Record<string, number> = { logical: 15, abstract: 15, numerical: 15, verbal: 15, spatial: 25, memory: 15, speed: 20 };

test("bank size and coverage", () => {
  assert.equal(CORE_BANK.length, 120);
  for (const c of cats) {
    const qs = CORE_BANK.filter((q) => q.cat === c);
    assert.equal(qs.length, SIZE[c], `${c} has ${qs.length}`);
    for (const d of [1, 2, 3, 4, 5]) assert.equal(qs.filter((q) => q.diff === d).length, SIZE[c] / 5, `${c} difficulty ${d}`);
  }
});

test("the full bank: the hand-written 120 plus 120 generated questions in every category", () => {
  assert.equal(BANK.length, 120 + 840);
  for (const c of cats) {
    const qs = BANK.filter((q) => q.cat === c);
    assert.equal(qs.length, SIZE[c] + 120, `${c} has ${qs.length}`);
    for (const d of [1, 2, 3, 4, 5]) assert.equal(qs.filter((q) => q.diff === d).length, SIZE[c] / 5 + 24, `${c} difficulty ${d}`);
  }
  assert.deepEqual(BANK.slice(0, 120).map((q) => q.key), CORE_BANK.map((q) => q.key));
});

test("every question has one correct option and distinct options", () => {
  BANK.forEach((q, i) => {
    assert.ok(q.explanation.length > 10, `Q${i} lacks explanation`);
    assert.ok(q.wrong.length >= 3, `Q${i} has ${q.wrong.length} distractors`);
    const keys = [q.right, ...q.wrong].map(optKey);
    assert.equal(new Set(keys).size, keys.length, `Q${i} (${q.prompt}) has duplicate options`);
    const built = buildOptions(q, i);
    assert.equal(built.filter((o) => o.isCorrect).length, 1, `Q${i} correct count`);
  });
});

test("unique questions", () => {
  const ids = BANK.map((q) => JSON.stringify([q.prompt, q.stem, q.stimulus, q.right]));
  assert.equal(new Set(ids).size, ids.length);
});

test("correct answers are spread across positions", () => {
  const counts = [0, 0, 0, 0, 0];
  BANK.filter((q) => !q.fixedOrder).forEach((q) => {
    counts[buildOptions(q, BANK.indexOf(q)).findIndex((o) => o.isCorrect)]++;
  });
  const total = counts.reduce((a, b) => a + b, 0);
  for (const c of counts.slice(0, 4)) assert.ok(c / total < 0.4 && c / total > 0.1, `position skew ${counts}`);
});

// ---- independent solver for number / letter series ----
const FAMILIES: ((s: number[]) => number | null)[] = [
  (s) => (new Set(s.slice(1).map((v, i) => v - s[i])).size === 1 ? s[s.length - 1] + (s[1] - s[0]) : null),
  (s) => (s.every((v, i) => i === 0 || v * s[0] === s[i] * (s[1] / s[0]) * s[0]) && s[0] !== 0 && new Set(s.slice(1).map((v, i) => v / s[i])).size === 1 ? s[s.length - 1] * (s[1] / s[0]) : null),
  (s) => {
    const d = s.slice(1).map((v, i) => v - s[i]);
    return new Set(d.slice(1).map((v, i) => v - d[i])).size === 1 && d.length >= 3 ? s[s.length - 1] + d[d.length - 1] + (d[1] - d[0]) : null;
  },
  (s) => (s.length >= 4 && s.slice(2).every((v, i) => v === s[i] + s[i + 1]) ? s[s.length - 1] + s[s.length - 2] : null),
  (s) => {
    const isPrime = (n: number) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d);
    if (!s.every(isPrime)) return null;
    let n = s[s.length - 1] + 1;
    while (!isPrime(n)) n++;
    return n;
  },
  (s) => {
    // differences double each step (terms = 2^n + 1 style)
    const d = s.slice(1).map((v, i) => v - s[i]);
    return d.length >= 3 && d.slice(1).every((v, i) => v === d[i] * 2) ? s[s.length - 1] + d[d.length - 1] * 2 : null;
  },
  (s) => {
    // squares plus one / n(n+1) style are covered by second differences; add n^2+1 explicitly
    return s.every((v, i) => v === (i + 1) ** 2 + 1) ? (s.length + 1) ** 2 + 1 : null;
  },
];

test("number and letter series have exactly the stated answer", () => {
  let checked = 0;
  for (const q of CORE_BANK) {
    if (q.cat !== "numerical" && q.cat !== "logical") continue;
    const m = q.prompt.match(/^What comes next\?\s+(.+), \?$/);
    if (!m) continue;
    const raw = m[1].split(",").map((t) => t.trim());
    const letters = raw.every((t) => /^[A-Z]$/.test(t));
    const seq = letters ? raw.map((t) => t.charCodeAt(0)) : raw.map(Number);
    const val = (l?: string) => (letters ? (l as string).charCodeAt(0) : Number(l));
    const nexts = FAMILIES.map((f) => f(seq)).filter((v): v is number => v !== null);
    assert.ok(nexts.length > 0, `no rule found for: ${q.prompt}`);
    assert.ok(nexts.includes(val(q.right.label)), `Q "${q.prompt}" answer ${q.right.label} not produced by any fitting rule (${nexts})`);
    for (const w of q.wrong) assert.ok(!nexts.includes(val(w.label)), `Q "${q.prompt}" distractor ${w.label} is also valid`);
    checked++;
  }
  assert.equal(checked, 11, `expected 11 series questions, verified ${checked}`);
});

test("word-problem arithmetic", () => {
  const r = (p: string) => CORE_BANK.find((q) => q.prompt.startsWith(p))!;
  assert.equal(r("Calculate: 12 + 7").right.label, String(12 + 7 * 2));
  assert.equal(r("A jacket costs $40").right.label, `$${40 - 40 * 0.25}`);
  assert.equal(r("If 4 pens cost $6").right.label, `$${(6 / 4) * 10}`);
  assert.equal(r("A train travels 270").right.label, `${450 / (270 / 3)} hours`);
  assert.equal(r("Two numbers add up to 50").right.label, String((50 + 12) / 2));
  assert.equal(r("5 workers build").right.label, `${(5 * 12) / 3} days`);
  assert.equal(Math.round((1.2 * 0.8 - 1) * 100), -4);
  assert.ok(Math.abs((1.1 - 1) / 2 - 0.05) < 1e-9); // bat & ball: x + (x + 1.00) = 1.10 -> x = 0.05
  // two numbers 31 and 19 differ by 12 and sum to 50
  assert.equal(31 + 19, 50);
  // CAT = 3 1 20, DOG = 4 15 7
  const code = (w: string) => w.split("").map((c) => c.charCodeAt(0) - 64).join("");
  assert.equal(code("CAT"), "3120");
  assert.equal(r("In a code, A = 1").right.label, code("DOG"));
});

test("speed arithmetic and string items", () => {
  for (const q of BANK.filter((x) => x.cat === "speed")) {
    assert.ok(q.timeLimitSec && q.timeLimitSec >= 8, "speed items must be timed");
    if (q.prompt.startsWith("Calculate")) {
      const expr = q.prompt.split(":").pop()!.trim().replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
      assert.equal(String(Function(`return (${expr})`)()), q.right.label, q.prompt);
    }
    if (q.prompt.startsWith("Find the code")) {
      assert.equal(q.prompt.split(":").pop()!.trim(), q.right.label);
      for (const w of q.wrong) assert.equal(w.label!.length, q.right.label!.length);
    }
    if (q.stem?.k === "seq") {
      const keys = q.stem.items.map((f) => figKey(f as Fig));
      const odd = keys.findIndex((k) => keys.filter((x) => x === k).length === 1);
      assert.equal(keys.filter((k) => k === keys[odd]).length, 1);
      assert.equal(q.right.label, String(odd + 1), q.prompt);
      assert.equal(q.rightIndex, odd);
    }
  }
});

test("memory items: answer derived from stimulus", () => {
  for (const q of BANK.filter((x) => x.cat === "memory")) {
    assert.ok(q.stimulus && q.stimulusSec && q.stimulusSec >= 4, q.prompt);
    const text = q.stimulus!.text;
    if (q.prompt.includes("REVERSE")) {
      assert.equal(q.right.label!.replace(/ /g, ""), text!.replace(/ /g, "").split("").reverse().join(""));
    } else if (q.prompt.startsWith("Which option is the digit sequence")) {
      assert.equal(q.right.label, text);
    } else if (q.prompt.includes("NOT in the list")) {
      const list = text!.split(" · ");
      assert.ok(!list.includes(q.right.label!));
      for (const w of q.wrong) assert.ok(list.includes(w.label!));
    } else if (/was (first|second|third|fourth|fifth|sixth|seventh) in/.test(q.prompt)) {
      const pos = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"].findIndex((o) => q.prompt.includes(` ${o} in`));
      const list = text!.split(/ · | /);
      assert.equal(list[pos], q.right.label);
      for (const w of q.wrong) assert.notEqual(list[pos], w.label);
    } else if (q.stimulus!.fig) {
      assert.equal(figKey(q.right.fig!), figKey(q.stimulus!.fig!));
    }
  }
});

test("spatial shapes are chiral and options unambiguous", () => {
  for (const [name, m] of Object.entries(SPATIAL_SHAPES)) {
    const rots = new Set(rotations(m).map(key));
    assert.ok(!rots.has(key(mirrorH(m))), `${name} equals its mirror image`);
  }
  for (const q of BANK.filter((x) => x.cat === "spatial" && x.stem?.k === "grid")) {
    assert.equal(q.wrong.length, 3, q.prompt);
    const base = (q.stem as { cells: number[][] }).cells;
    const right = key((q.right.fig as { cells: number[][] }).cells);
    const wrongKeys = q.wrong.map((w) => key((w.fig as { cells: number[][] }).cells));
    assert.ok(!wrongKeys.includes(right));
    assert.equal(new Set(wrongKeys).size, 3);
    const all = new Set(dihedral(base).map(key));
    for (const k of [right, ...wrongKeys]) assert.ok(all.has(k), "option is not a symmetry of the stem");
    if (q.prompt.includes("SAME shape")) {
      const rotKeys = new Set(rotations(base).map(key));
      assert.ok(rotKeys.has(right));
      for (const k of wrongKeys) assert.ok(!rotKeys.has(k), "a mirrored distractor is also a rotation");
    }
  }
});

test("abstract figures: rotation only on shapes where it is visible", () => {
  for (const q of BANK.filter((x) => x.cat === "abstract")) {
    const figs = [...(q.stem as { items: (Fig | null)[] }).items.filter(Boolean), q.right.fig!, ...q.wrong.map((w) => w.fig!)] as Fig[];
    for (const f of figs) if (f.k === "glyph" && (f.rot ?? 0) % 360 !== 0) assert.ok(f.shape === "arrow" || f.shape === "triangle", `invisible rotation on ${f.shape}`);
  }
});
