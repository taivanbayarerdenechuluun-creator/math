import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK } from "../index";
import { GENERATED } from "./index";
import { generateMemory } from "./memory";
import { generateNumerical } from "./numerical";
import { CONDITIONAL_RULES, UNKNOWN } from "./logical";
import { pathsFor } from "./abstract";
import { ANTONYMS, CAPITALS, CATEGORIES, PART_WHOLE, TOOL_USER, YOUNG } from "./lexicon";
import { cubeCount, dihedral, figKey, isVisibleStack, key, mirrorH, rotateCW, rotations, type Fig, type Glyph, type Matrix } from "../../../lib/figures";
import type { QDef } from "../types";

/*
 * Independent checks of the generated questions. Nothing here calls a generator's own logic: every question is parsed
 * back from its text and re-solved with separate code (series solvers, a small-model checker for syllogisms, truth
 * tables for if-then reasoning, lexicon lookups, matrix algebra), so a bug in a generator cannot hide itself.
 */

const gen = (cat: string) => GENERATED.filter((q) => q.cat === cat);
const right = (q: QDef) => q.right.label!;
const wrongs = (q: QDef) => q.wrong.map((w) => w.label!);

test("the generated bank is deterministic and has no repeats", () => {
  assert.deepEqual(JSON.stringify(generateNumerical()), JSON.stringify(generateNumerical()));
  assert.deepEqual(JSON.stringify(generateMemory()), JSON.stringify(generateMemory()));
  const ids = BANK.map((q) => JSON.stringify([q.prompt, q.stem, q.stimulus, q.right]));
  assert.equal(new Set(ids).size, BANK.length);
});

test("Mongolian text never attaches a case suffix to a number or a variable word", () => {
  // Suffixes such as «5-аар» depend on how the number is pronounced, so the generated text avoids them
  // (ordinals like «5-р» are fine).
  const bad = /\d-(?!р(?![а-яөү]))[а-яөү]+/;
  for (const q of GENERATED) {
    for (const s of [q.mn!.prompt, q.mn!.explanation, ...(q.mn!.wrong ?? []), q.mn!.right ?? ""]) assert.ok(!bad.test(s), `${q.key ?? q.prompt}: ${s}`);
  }
});

// ------------------------------------------------------------------ numerical

/** Every value the next term could take under the simple rules a test-taker could reasonably find. */
function nextTerms(t: number[]): Set<number> {
  const out = new Set<number>(), n = t.length, d = t.slice(1).map((v, i) => v - t[i]);
  const same = (a: number[]) => a.length > 0 && a.every((v) => v === a[0]);
  if (same(d)) out.add(t[n - 1] + d[0]); // arithmetic
  for (const m of [2, 3]) for (let c = -5; c <= 5; c++) if (t.slice(0, -1).every((v, i) => t[i + 1] === m * v + c)) out.add(m * t[n - 1] + c); // x m + c
  if (d.length >= 4 && d.every((v, i) => i < 2 || v === d[i - 2]) && d[0] !== d[1]) out.add(t[n - 1] + d[d.length - 2]); // alternating steps
  const dd = d.slice(1).map((v, i) => v - d[i]);
  if (dd.length >= 2 && same(dd) && dd[0] !== 0) out.add(t[n - 1] + d[d.length - 1] + dd[0]); // growing gaps
  if (n >= 4 && t.every((v, i) => i < 2 || v === t[i - 1] + t[i - 2])) out.add(t[n - 1] + t[n - 2]); // Fibonacci-like
  for (let n0 = 0; n0 <= 30; n0++) {
    const k2 = t[0] - n0 ** 2, k3 = t[0] - n0 ** 3;
    if (t.every((v, i) => v === (n0 + i) ** 2 + k2)) out.add((n0 + n) ** 2 + k2);
    if (t.every((v, i) => v === (n0 + i) ** 3 + k3)) out.add((n0 + n) ** 3 + k3);
  }
  const ev = t.filter((_, i) => i % 2 === 0), od = t.filter((_, i) => i % 2 === 1);
  const dEv = ev.slice(1).map((v, i) => v - ev[i]), dOd = od.slice(1).map((v, i) => v - od[i]);
  if (n >= 6 && same(dEv) && same(dOd) && dEv[0] !== dOd[0]) out.add(n % 2 === 0 ? ev[ev.length - 1] + dEv[0] : od[od.length - 1] + dOd[0]); // two woven series
  for (const m of [2, 3]) for (let k = 1; k <= 9; k++) if (t.slice(0, -1).every((v, i) => t[i + 1] === (i % 2 === 0 ? v * m : v + k))) out.add((n - 1) % 2 === 0 ? t[n - 1] * m : t[n - 1] + k); // alternating operations
  if (n >= 5 && d.every((v, i) => v === (i + 1) ** 2)) out.add(t[n - 1] + n ** 2); // gaps are squares
  return out;
}

const WP: [RegExp, (m: RegExpMatchArray) => number, "plain" | "$" | "%"][] = [
  [/^What is (\d+)% of (\d+)\?$/, (m) => (+m[2] * +m[1]) / 100, "plain"],
  [/^What is (\d+)\/(\d+) of (\d+)\?$/, (m) => (+m[3] * +m[1]) / +m[2], "plain"],
  [/^A rectangle is (\d+) long and (\d+) wide\. What is its area\?$/, (m) => +m[1] * +m[2], "plain"],
  [/^A rectangle is (\d+) long and (\d+) wide\. What is its perimeter\?$/, (m) => 2 * (+m[1] + +m[2]), "plain"],
  [/^If x \+ (\d+) = (\d+), what is x\?$/, (m) => +m[2] - +m[1], "plain"],
  [/^If (\d+) − x = (\d+), what is x\?$/, (m) => +m[1] - +m[2], "plain"],
  [/^If (\d+)x \+ (\d+) = (\d+), what is x\?$/, (m) => (+m[3] - +m[2]) / +m[1], "plain"],
  [/^If (\d+)x \+ (\d+) = (\d+)x \+ (\d+), what is x\?$/, (m) => (+m[4] - +m[2]) / (+m[1] - +m[3]), "plain"],
  [/^A coat costs \$(\d+) and is discounted by (\d+)%\. What is the sale price\?$/, (m) => +m[1] - (+m[1] * +m[2]) / 100, "$"],
  [/^A train travels at (\d+) kilometres per hour for (\d+) hours\. How many kilometres does it cover\?$/, (m) => +m[1] * +m[2], "plain"],
  [/^A bus travels at (\d+) kilometres per hour\. How many hours does it need for (\d+) kilometres\?$/, (m) => +m[2] / +m[1], "plain"],
  [/^A car covers (\d+) kilometres in (\d+) hours\. What is its average speed in kilometres per hour\?$/, (m) => +m[1] / +m[2], "plain"],
  [/^What is the average of ([\d, ]+)\?$/, (m) => { const v = m[1].split(",").map(Number); return v.reduce((a, b) => a + b, 0) / v.length; }, "plain"],
  [/^The average of four numbers is (\d+)\. Three of them are (\d+), (\d+) and (\d+)\. What is the fourth\?$/, (m) => 4 * +m[1] - +m[2] - +m[3] - +m[4], "plain"],
  [/^Share (\d+) in the ratio (\d+):(\d+)\. How much is the (first|second) part\?$/, (m) => (+m[1] * (m[4] === "first" ? +m[2] : +m[3])) / (+m[2] + +m[3]), "plain"],
  [/^If (\d+) (\w+) cost \$(\d+), how much do (\d+) \2 cost\?$/, (m) => (+m[3] / +m[1]) * +m[4], "$"],
  [/^(\d+) workers finish a job in (\d+) days\. How many days would (\d+) workers at the same pace need\?$/, (m) => (+m[1] * +m[2]) / +m[3], "plain"],
  [/^A price changes from (\d+) to (\d+)\. By what percent did it (rise|fall)\?$/, (m) => (Math.abs(+m[2] - +m[1]) / +m[1]) * 100, "%"],
  [/^(\w+) is (\d+) years older than (\w+)\. In (\d+) years the sum of their ages will be (\d+)\. How old is \3 now\?$/, (m) => (+m[5] - +m[2] - 2 * +m[4]) / 2, "plain"],
  [/^What is (\d+)% of (\d+)% of (\d+)\?$/, (m) => (((+m[3] * +m[2]) / 100) * +m[1]) / 100, "plain"],
];

test("numerical: sequences have exactly one answer, expressions and word problems re-solve to the stated answer", () => {
  let seq = 0, expr = 0, word = 0;
  for (const q of gen("numerical")) {
    const m = q.prompt.match(/^What comes next\?\s+(.+), \?$/);
    if (m) {
      const t = m[1].split(",").map((v) => Number(v.trim()));
      const preds = nextTerms(t);
      assert.ok(preds.size >= 1, `no rule found for ${q.prompt}`);
      assert.deepEqual([...preds], [Number(right(q))], `${q.prompt}: rules predict ${[...preds]}`);
      assert.ok(wrongs(q).every((w) => !preds.has(Number(w))), q.prompt);
      seq++;
      continue;
    }
    if (q.prompt.startsWith("Calculate: ")) {
      const js = q.prompt.slice(11).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
      const v = Function(`return (${js})`)() as number;
      assert.equal(String(v), right(q), q.prompt);
      assert.ok(!wrongs(q).includes(String(v)), q.prompt);
      expr++;
      continue;
    }
    const hit = WP.map(([re, f, fmt]) => ({ m: q.prompt.match(re), f, fmt })).filter((x) => x.m);
    assert.equal(hit.length, 1, `word problem not recognised (or ambiguous): ${q.prompt}`);
    const v = hit[0].f(hit[0].m!);
    assert.ok(Number.isInteger(v) && v >= 1, `${q.prompt}: ${v}`);
    const fmt = (x: number | string) => (hit[0].fmt === "$" ? `$${x}` : hit[0].fmt === "%" ? `${x}%` : String(x));
    assert.equal(right(q), fmt(v), q.prompt);
    assert.ok(!wrongs(q).includes(fmt(v)), q.prompt);
    word++;
  }
  assert.deepEqual([seq, expr, word], [60, 25, 35]);
});

// ------------------------------------------------------------------ logical

const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function entails(premises: string[], conclusion: string): boolean {
  const parse = (s: string) => { const m = s.match(/^(All|No|Some) (\w+) are (not )?(\w+)$/)!; return { q: m[1] + (m[3] ? "Not" : ""), x: m[2], y: m[4] }; };
  const ps = premises.map(parse), c = parse(conclusion);
  const terms = [...new Set([...ps, c].flatMap((s) => [s.x, s.y]))];
  const idx = (t: string) => terms.indexOf(t);
  const holds = (s: { q: string; x: string; y: string }, model: number[]) => {
    const x = idx(s.x), y = idx(s.y), has = (e: number, i: number) => ((e >> i) & 1) === 1;
    switch (s.q) {
      case "All": return model.every((e) => !has(e, x) || has(e, y));
      case "No": return model.every((e) => !(has(e, x) && has(e, y)));
      case "Some": return model.some((e) => has(e, x) && has(e, y));
      default: return model.some((e) => has(e, x) && !has(e, y)); // SomeNot
    }
  };
  const types = 1 << terms.length;
  let valid = true;
  for (let size = 1; size <= 4 && valid; size++) {
    const total = types ** size;
    for (let code = 0; code < total && valid; code++) {
      const model: number[] = [];
      for (let i = 0, c2 = code; i < size; i++, c2 = Math.floor(c2 / types)) model.push(c2 % types);
      if (ps.every((p) => holds(p, model)) && !holds(c, model)) valid = false;
    }
  }
  return valid;
}

test("logical: orderings, calendar questions, codes and groups re-solve to the stated answer", () => {
  const HI = ["taller", "older", "faster", "heavier", "richer", "stronger"];
  const SUP_HI = ["tallest", "oldest", "fastest", "heaviest", "richest", "strongest"];
  const done = { order: 0, day: 0, month: 0, code: 0, club: 0, letters: 0 };
  for (const q of gen("logical")) {
    let m: RegExpMatchArray | null;
    if ((m = q.prompt.match(/^What comes next\?\s+(.+), \?$/))) {
      const c = m[1].split(",").map((s) => A.indexOf(s.trim()));
      const d = c.slice(1).map((v, i) => v - c[i]);
      const preds = new Set<number>();
      if (d.every((v) => v === d[0])) preds.add(c[c.length - 1] + d[0]);
      const ev = c.filter((_, i) => i % 2 === 0), od = c.filter((_, i) => i % 2 === 1);
      if (c.length >= 6 && ev[1] - ev[0] === ev[2] - ev[1] && od[1] - od[0] === od[2] - od[1]) preds.add(c.length % 2 === 0 ? ev[ev.length - 1] + (ev[1] - ev[0]) : od[od.length - 1] + (od[1] - od[0]));
      assert.deepEqual([...preds].map((x) => A[x]), [right(q)], q.prompt);
      assert.ok(!wrongs(q).some((w) => preds.has(A.indexOf(w))), q.prompt);
      done.letters++;
    } else if (/ than \w+\./.test(q.prompt)) {
      const edges = [...q.prompt.matchAll(/(\w+) is (\w+) than (\w+)\./g)].map((e) => (HI.includes(e[2]) ? [e[1], e[3]] : [e[3], e[1]]));
      const people = [...new Set(edges.flat())];
      const beats = (x: string): Set<string> => { const s = new Set<string>(); const go = (p: string) => edges.filter((e) => e[0] === p).forEach((e) => { if (!s.has(e[1])) { s.add(e[1]); go(e[1]); } }); go(x); return s; };
      const rank = people.map((p) => [p, beats(p).size] as const).sort((a, b) => b[1] - a[1]).map((r) => r[0]);
      assert.deepEqual(people.map((p) => beats(p).size).sort(), people.map((_, i) => i).sort(), `clues do not fix a single order: ${q.prompt}`);
      const sup = q.prompt.match(/Who is the (\w+)\?$/)?.[1];
      const expected = sup ? (SUP_HI.includes(sup) ? rank[0] : rank[rank.length - 1]) : rank[2];
      assert.equal(right(q), expected, q.prompt);
      assert.ok(sup || /who is third\?$/.test(q.prompt));
      assert.ok(!wrongs(q).includes(expected));
      done.order++;
    } else if ((m = q.prompt.match(/^If today is (\w+), what day (?:will it be in|was it) (\d+) days? ?(ago)?\?$/))) {
      const future = !m[3], n = +m[2];
      assert.equal(right(q), DAY[(((DAY.indexOf(m[1]) + (future ? n : -n)) % 7) + 7) % 7], q.prompt);
      done.day++;
    } else if ((m = q.prompt.match(/^If this month is (\w+), which month (?:comes (\d+) months later|was it (\d+) months ago)\?$/))) {
      const n = Number(m[2] ?? m[3]), future = m[2] !== undefined;
      assert.equal(right(q), MON[(((MON.indexOf(m[1]) + (future ? n : -n)) % 12) + 12) % 12], q.prompt);
      done.month++;
    } else if ((m = q.prompt.match(/replaced by the letter (\d+) places? after it in the alphabet\. (?:How is the word (\w+) written in this code\?|What word does (\w+) stand for\?)$/))) {
      const k = +m[1], shift = (w: string, by: number) => w.split("").map((ch) => A[A.indexOf(ch) + by]).join("");
      assert.equal(right(q), m[2] ? shift(m[2], k) : shift(m[3], -k), q.prompt);
      assert.ok(wrongs(q).every((w) => w !== right(q)));
      done.code++;
    } else if ((m = q.prompt.match(/^In a group of (\d+) students, (\d+) are in the (\w+) club, (\d+) are in the (\w+) club and (\d+) are in neither\. (How many are in both clubs\?|How many are only in the (\w+) club\?)$/))) {
      const [total, a, b, none] = [+m[1], +m[2], +m[4], +m[6]], both = a + b - (total - none);
      assert.equal(right(q), String(m[8] ? a - both : both), q.prompt);
      assert.ok(m[8] === undefined || m[8] === m[3]);
      done.club++;
    }
  }
  assert.deepEqual(done, { order: 25, day: 13, month: 4, code: 17, club: 12, letters: 16 });
});

test("logical: syllogisms follow from their premises (and each distractor does not)", () => {
  let n = 0;
  for (const q of gen("logical")) {
    const m = q.prompt.match(/^(.+)\. Which statement must be true\?$/);
    if (!m) continue;
    const premises = m[1].split(". ");
    assert.ok(entails(premises, right(q)), `${q.prompt}: "${right(q)}" is not entailed`);
    for (const w of wrongs(q)) assert.ok(!entails(premises, w), `${q.prompt}: distractor "${w}" is entailed`);
    n++;
  }
  assert.equal(n, 18);
});

test("logical: if-then questions agree with a truth table", () => {
  let n = 0;
  for (const q of gen("logical")) {
    const m = q.prompt.match(/^If (.+?), (.+?)\. (.+?) What can be concluded\?$/);
    if (!m) continue;
    const rule = CONDITIONAL_RULES.find((r) => r.ifEn === m[1] && r.thenEn === m[2]);
    assert.ok(rule, q.prompt);
    const lit: Record<string, [string, boolean]> = { [rule!.p.en]: ["P", true], [rule!.np.en]: ["P", false], [rule!.q.en]: ["Q", true], [rule!.nq.en]: ["Q", false] };
    const fact = lit[m[3]];
    assert.ok(fact, q.prompt);
    const worlds = [[true, true], [true, false], [false, true], [false, false]].filter(([P, Q]) => (!P || Q) && (fact[0] === "P" ? P : Q) === fact[1]); // P→Q and the fact
    const entailed = (label: string) => { const [v, val] = lit[label]; return worlds.every(([P, Q]) => (v === "P" ? P : Q) === val); };
    const labels = [right(q), ...wrongs(q)];
    const entailedLits = labels.filter((l) => l !== UNKNOWN.en && entailed(l));
    if (right(q) === UNKNOWN.en) assert.equal(entailedLits.length, 0, `${q.prompt}: a listed conclusion does follow`);
    else assert.deepEqual(entailedLits, [right(q)], q.prompt);
    n++;
  }
  assert.equal(n, 15);
});

// ------------------------------------------------------------------ abstract

const attrs = (f: Fig) => { const g = f as Glyph; return { shape: g.shape, rot: ["arrow", "triangle"].includes(g.shape) ? ((g.rot ?? 0) % 360 + 360) % 360 : 0, fill: g.fill ?? "solid", n: g.n ?? 1 }; };
function predictAttr(s: (string | number)[], mod = 0): Set<string | number> {
  const out = new Set<string | number>(), n = s.length;
  if (s.every((v) => v === s[0])) out.add(s[0]);
  for (const p of [2, 3]) if (n > p && s.every((v, i) => i < p || v === s[i - p])) out.add(s[n - p]);
  if (s.every((v) => typeof v === "number")) {
    const x = s as number[], d = x.slice(1).map((v, i) => v - x[i]);
    const norm = (v: number) => (mod ? ((v % mod) + mod) % mod : v);
    if (d.every((v) => norm(v) === norm(d[0]))) out.add(norm(x[n - 1] + d[0]));
  }
  return out;
}

test("abstract: figure sequences follow one rule per attribute and the answer continues each rule", () => {
  let figures = 0, grids = 0;
  for (const q of gen("abstract")) {
    const items = (q.stem as { items: (Fig | null)[] }).items.filter((f): f is Fig => f !== null);
    if (items[0].k === "glyph") {
      const rows = items.map(attrs), ans = attrs(q.right.fig!);
      for (const a of ["shape", "fill", "n", "rot"] as const) {
        const preds = predictAttr(rows.map((r) => r[a]), a === "rot" ? 360 : 0);
        assert.deepEqual([...preds], [ans[a]], `${a} in ${q.explanation}`);
      }
      const keys = new Set(q.wrong.map((w) => figKey(w.fig!)));
      assert.equal(keys.size, 3);
      assert.ok(!keys.has(figKey(q.right.fig!)));
      figures++;
    } else {
      const lit = (f: Fig) => (f as { cells: Matrix }).cells.flatMap((row, y) => row.map((v, x) => (v ? `${y},${x}` : null))).filter((c): c is string => c !== null);
      const size = (items[0] as { cells: Matrix }).cells.length;
      const moving = items.every((f) => lit(f).length === 1);
      const nexts = new Set<string>();
      for (const path of pathsFor(size)) {
        const cells = path.cells.map(([y, x]) => `${y},${x}`);
        const fits = items.every((f, i) => { const got = [...lit(f)].sort().join("|"); return got === (moving ? [cells[i]] : cells.slice(0, i + 1)).sort().join("|"); });
        if (fits) nexts.add((moving ? [cells[items.length]] : cells.slice(0, items.length + 1)).sort().join("|"));
      }
      assert.deepEqual([...nexts], [lit(q.right.fig!).sort().join("|")], q.explanation);
      grids++;
    }
  }
  assert.deepEqual([figures, grids], [78, 42]);
});

// ------------------------------------------------------------------ verbal

const pairKey = (a: string, b: string) => `${a.toLowerCase()}|${b.toLowerCase()}`;
const norm = (s: string) => s.toLowerCase();

test("verbal: every answer follows from the vocabulary tables and no distractor does", () => {
  const done = { opposite: 0, analogy: 0, member: 0, odd: 0 };
  const antonym = new Map<string, string>();
  for (const [a, b] of ANTONYMS) { antonym.set(norm(a.en), b.en); antonym.set(norm(b.en), a.en); }
  const tables = [YOUNG, PART_WHOLE, CAPITALS, TOOL_USER];
  for (const q of gen("verbal")) {
    let m: RegExpMatchArray | null;
    if ((m = q.prompt.match(/^Which word means the OPPOSITE of “(.+)”\?$/))) {
      assert.equal(right(q), antonym.get(norm(m[1])), q.prompt);
      assert.ok(!wrongs(q).includes(right(q)));
      done.opposite++;
    } else if ((m = q.prompt.match(/^(.+) is to (.+) as (.+) is to …$/))) {
      const [a, b, c] = [m[1], m[2], m[3]];
      if (antonym.get(norm(a)) === b) {
        assert.equal(right(q), antonym.get(norm(c)), q.prompt);
        assert.ok(wrongs(q).every((w) => w !== antonym.get(norm(c))), q.prompt);
      } else {
        const cat = CATEGORIES.find((k) => k.name.en === b);
        if (cat) {
          assert.ok(cat.members.some((x) => norm(x.en) === norm(a)), q.prompt);
          const rc = CATEGORIES.find((k) => k.name.en === right(q))!;
          assert.ok(rc.members.some((x) => norm(x.en) === norm(c)), q.prompt);
          for (const w of wrongs(q)) assert.ok(!CATEGORIES.find((k) => k.name.en === w)!.members.some((x) => norm(x.en) === norm(c)), `${q.prompt}: "${w}" also fits`);
        } else {
          const table = tables.find((t) => t.some((p) => pairKey(p[0].en, p[1].en) === pairKey(a, b)));
          assert.ok(table, `unknown relation: ${q.prompt}`);
          const partner = table!.find((p) => norm(p[0].en) === norm(c));
          assert.equal(right(q), partner![1].en, q.prompt);
          assert.ok(wrongs(q).every((w) => w !== partner![1].en));
        }
      }
      done.analogy++;
    } else if ((m = q.prompt.match(/^Which of these is (.+)\?$/))) {
      const cat = CATEGORIES.find((k) => k.article === m![1])!;
      assert.ok(cat.members.some((x) => x.en === right(q)), q.prompt);
      for (const w of wrongs(q)) assert.ok(!cat.members.some((x) => x.en === w), `${q.prompt}: ${w}`);
      done.member++;
    } else if ((m = q.prompt.match(/^Which word does not belong with the others\?  (.+)$/))) {
      const words = m[1].split(", ");
      const groups = CATEGORIES.filter((c) => words.filter((w) => c.members.some((x) => x.en === w)).length >= 3);
      assert.equal(groups.length, 1, q.prompt);
      assert.ok(!groups[0].members.some((x) => x.en === right(q)), q.prompt);
      assert.ok(words.filter((w) => w !== right(q)).every((w) => groups[0].members.some((x) => x.en === w)));
      done.odd++;
    } else assert.fail(`unrecognised verbal question: ${q.prompt}`);
  }
  assert.deepEqual(done, { opposite: 16, analogy: 64, member: 16, odd: 24 });
});

// ------------------------------------------------------------------ spatial

test("spatial: shape transformations are exactly what the question says and the shape has no symmetry", () => {
  let shapes = 0, counts = 0, compares = 0;
  for (const q of gen("spatial")) {
    if (q.stem?.k === "grid") {
      const base = q.stem.cells, right = q.right.fig as { cells: Matrix };
      assert.equal(new Set(dihedral(base).map(key)).size, 8, "the shape has a symmetry");
      const expected = q.prompt.includes("90° clockwise") ? [rotateCW(base)] : q.prompt.includes("counter-clockwise") ? [rotations(base)[3]] : q.prompt.includes("180°") ? [rotations(base)[2]] : q.prompt.includes("flipped left-to-right") ? [mirrorH(base)] : rotations(base).slice(1);
      assert.ok(expected.map(key).includes(key(right.cells)), q.prompt);
      assert.equal(new Set(q.wrong.map((w) => key((w.fig as { cells: Matrix }).cells))).size, 3);
      shapes++;
    } else if (q.stem?.k === "iso") {
      const h = q.stem.heights;
      assert.ok(isVisibleStack(h));
      assert.equal(right(q), String(cubeCount(h)));
      assert.ok(!wrongs(q).includes(String(cubeCount(h))));
      counts++;
    } else {
      const n = Number(/exactly (\d+) cubes/.exec(q.prompt)![1]);
      const sums = [q.right.fig, ...q.wrong.map((w) => w.fig)].map((f) => { const h = (f as { heights: Matrix }).heights; assert.ok(isVisibleStack(h)); return cubeCount(h); });
      assert.equal(sums[0], n);
      assert.equal(sums.filter((s) => s === n).length, 1);
      assert.equal(new Set(sums).size, 4);
      compares++;
    }
  }
  assert.deepEqual([shapes, counts, compares], [60, 35, 25]);
});

// ------------------------------------------------------------------ memory and speed

test("memory: the new item types are derived from the stimulus", () => {
  let after = 0;
  for (const q of gen("memory")) {
    assert.ok(q.stimulusSec! >= 4 && q.stimulusSec! <= 15, q.prompt);
    const m = q.prompt.match(/^In the digit sequence you saw, which digit came right after (\d)\?$/);
    if (m) {
      const digits = q.stimulus!.text!.split(" ");
      assert.equal(digits[digits.indexOf(m[1]) + 1], right(q));
      assert.ok(!wrongs(q).includes(right(q)) && wrongs(q).every((w) => digits.includes(w)));
      after++;
    }
  }
  assert.equal(after, 7);
});

test("speed: counting items count correctly and every item is timed", () => {
  let counting = 0;
  for (const q of gen("speed")) {
    assert.ok(q.timeLimitSec! >= 11 && q.timeLimitSec! <= 15);
    const m = q.prompt.match(/^How many times does the letter ([A-Z]) appear in this string\?  ([A-Z]+)$/);
    if (!m) continue;
    const n = [...m[2]].filter((c) => c === m[1]).length;
    assert.equal(right(q), String(n));
    assert.ok(n >= 1 && !wrongs(q).includes(String(n)));
    counting++;
  }
  assert.equal(counting, 25);
});
