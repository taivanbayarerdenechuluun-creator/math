import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_SLOTS, generateDaily, hashStr, predictNext, type Generated } from "./daily-gen";
import { buildOptions, optKey } from "../data/bank/build";
import { ORD_MN, WORD_MN } from "../data/bank/mn";
import { figKey, type Fig, type Glyph } from "./figures";
import type { QDef } from "../data/bank/types";

// Every day of 2024-2027 plus the turn of the century: generation must be total (never throw) and always valid.
const dayList = (from: number, count: number) => Array.from({ length: count }, (_, i) => new Date(from + i * 86_400_000).toISOString().slice(0, 10));
const YEAR = dayList(Date.UTC(2026, 0, 1), 365);
const MANY = [...dayList(Date.UTC(2024, 0, 1), 4 * 366), ...dayList(Date.UTC(2099, 11, 1), 62)];

const memo = new Map<string, Generated[]>();
const gen = (day: string) => {
  let g = memo.get(day);
  if (!g) memo.set(day, (g = generateDaily(day)));
  return g;
};
const slot = (day: string, s: (typeof DAILY_SLOTS)[number]) => gen(day).find((x) => x.slot === s)!.q;

const CYR = /[Ѐ-ӿ]/;
const textOf = (q: QDef) => [q.right, ...q.wrong].map((o) => o.label!);
const mnTexts = (q: QDef) => [q.mn!.right!, ...q.mn!.wrong!];

test("every day yields five valid, bilingual questions in slot order, deterministically", () => {
  for (const day of MANY) {
    const g = gen(day);
    assert.deepEqual(g.map((x) => x.slot), [...DAILY_SLOTS], day);
    assert.equal(JSON.stringify(generateDaily(day)), JSON.stringify(g), `not deterministic on ${day}`);
    for (const { slot: s, q } of g) {
      const where = `${day} ${s}`;
      assert.equal(q.cat, s, where);
      assert.equal(q.wrong.length, 3, `${where}: needs exactly three distractors`);
      const keys = [q.right, ...q.wrong].map(optKey);
      assert.equal(new Set(keys).size, 4, `${where}: options must be distinct`);
      assert.ok(q.prompt.length > 8 && q.explanation.length > 10, where);
      // Mongolian: present, in Cyrillic, with no leftover English words
      assert.ok(q.mn && CYR.test(q.mn.prompt) && (CYR.test(q.mn.explanation) || /^[\d\s×−+=.]+$/.test(q.mn.explanation)), `${where}: Mongolian prompt/explanation`);
      for (const t of [q.mn.prompt, q.mn.explanation, q.mn.stimulus ?? ""]) assert.ok(!/[a-z]{2,}/.test(t), `${where}: untranslated English in "${t}"`);
      if (q.right.label !== undefined && /[A-Za-z]{3,}/.test(q.right.label) && !/^[A-Z0-9]{6}$/.test(q.right.label)) {
        assert.equal(q.mn.wrong?.length, 3, `${where}: Mongolian options`);
        assert.equal(new Set(mnTexts(q)).size, 4, `${where}: Mongolian options must be distinct`);
        for (const t of mnTexts(q)) assert.ok(CYR.test(t) && !/[a-z]{2,}/.test(t), `${where}: "${t}"`);
      }
      if (q.stimulus) assert.ok(q.stimulusSec && q.stimulusSec >= 4, `${where}: memory items need a viewing time`);
      if (s === "speed") assert.ok(q.timeLimitSec && q.timeLimitSec >= 8, `${where}: speed items are timed`);
      if (q.stem) assert.ok(q.stem.k !== "reaction", `${where}: reaction items need a live pad`);
    }
  }
});

// ------------------------------------------------------------------ numerical: independent closed-form solver

const diffs = (s: number[]) => s.slice(1).map((v, i) => v - s[i]);
const allEqual = (s: number[]) => s.every((v) => v === s[0]);
const SOLVERS: Record<string, (s: number[]) => number | null> = {
  arithmetic: (s) => (allEqual(diffs(s)) ? s[s.length - 1] + diffs(s)[0] : null),
  geometric: (s) => {
    const r = s[1] / s[0];
    return Number.isInteger(r) && s.every((v, i) => i === 0 || v === s[i - 1] * r) ? s[s.length - 1] * r : null;
  },
  "squares plus constant": (s) => {
    for (let n0 = 1; n0 <= 9; n0++) {
      const k = s[0] - n0 * n0;
      if (s.every((v, i) => v === (n0 + i) ** 2 + k)) return (n0 + s.length) ** 2 + k;
    }
    return null;
  },
  fibonacci: (s) => (s.length >= 5 && s.slice(2).every((v, i) => v === s[i] + s[i + 1]) ? s[s.length - 1] + s[s.length - 2] : null),
  "alternating steps": (s) => {
    const d = diffs(s);
    return d.length >= 4 && d[0] !== d[1] && d.every((v, i) => v === d[i % 2]) ? s[s.length - 1] + d[d.length % 2] : null;
  },
  "multiply then add a constant": (s) => {
    for (const m of [2, 3, 4]) {
      const c = s[1] - m * s[0];
      if (s.every((v, i) => i === 0 || v === m * s[i - 1] + c)) return m * s[s.length - 1] + c;
    }
    return null;
  },
  "constant second difference": (s) => {
    const d = diffs(s), d2 = diffs(d);
    return d2.length >= 2 && allEqual(d2) ? s[s.length - 1] + d[d.length - 1] + d2[0] : null;
  },
};

test("number sequences: the stated answer is what every fitting rule predicts, and no distractor is", () => {
  for (const day of MANY) {
    const q = slot(day, "numerical");
    const m = q.prompt.match(/^What comes next\?\s+(.+), \?$/);
    assert.ok(m, `${day}: ${q.prompt}`);
    const seq = m[1].split(",").map(Number);
    const predicted = Object.entries(SOLVERS).flatMap(([name, f]) => { const v = f(seq); return v === null ? [] : [{ name, v }]; });
    assert.ok(predicted.length > 0, `${day}: no rule fits ${seq}`);
    assert.deepEqual([...new Set(predicted.map((p) => p.v))], [Number(q.right.label)], `${day}: ${seq} -> ${JSON.stringify(predicted)} but answer ${q.right.label}`);
    for (const w of q.wrong) assert.ok(!predicted.some((p) => p.v === Number(w.label)), `${day}: distractor ${w.label} fits`);
    assert.ok(q.explanation.includes(String(q.right.label)), `${day}: explanation should state the answer`);
    // the worked arithmetic in the explanation (both languages) must itself be correct and end at the answer
    for (const text of [q.explanation, q.mn!.explanation]) {
      const equations = [...text.matchAll(/((?:\d+²?|[+−×]|\s)+)=\s*(\d+)/g)].filter((e) => /\d/.test(e[1]));
      assert.ok(equations.length >= 1, `${day}: no worked equation in "${text}"`);
      for (const e of equations) {
        const value = Function(`return (${e[1].replace(/²/g, "**2").replace(/−/g, "-").replace(/×/g, "*")})`)();
        assert.equal(value, Number(e[2]), `${day}: wrong arithmetic "${e[0].trim()}" in "${text}"`);
      }
      assert.equal(Number(equations[equations.length - 1][2]), Number(q.right.label), `${day}: the last equation must give the answer`);
    }
    assert.ok(q.mn!.prompt.endsWith(", ?") && q.mn!.prompt.includes(m[1]), day);
    assert.deepEqual(predictNext(seq), [Number(q.right.label)], `${day}: the generator's own gate disagrees`);
  }
});

test("the ambiguity gate rejects sequences that several simple rules continue differently", () => {
  assert.deepEqual(predictNext([3, 5, 7, 9, 11]), [13]);
  assert.ok(predictNext([1, 2, 4]).length > 1, "1,2,4 can be doubling (8) or growing differences (7)");
  assert.ok(predictNext([1, 2, 4, 7]).length >= 1);
  assert.ok(predictNext([2, 4, 8]).includes(16) && predictNext([2, 4, 8]).includes(14));
});

// ------------------------------------------------------------------ logic

function perms<T>(a: T[]): T[][] {
  return a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

/** Everyone who could be tallest / shortest given "X is taller than Y" clues (index 0 = tallest). */
function extremes(clues: [string, string][], ask: "tallest" | "shortest") {
  const people = [...new Set(clues.flat())];
  const ok = perms(people).filter((p) => clues.every(([a, b]) => p.indexOf(a) < p.indexOf(b)));
  assert.ok(ok.length > 0);
  return { people, answers: [...new Set(ok.map((p) => (ask === "tallest" ? p[0] : p[p.length - 1])))] };
}

// Monadic model checking of "All/No/Some-not" statements: a model is any non-empty set of realised individual types.
type Form = "all" | "no" | "some" | "some-not";
const stmt = (form: Form, x: string, y: string) => ({ form, x, y });
function holds(s: ReturnType<typeof stmt>, types: Set<string>[]) {
  const has = (t: Set<string>, p: string) => t.has(p);
  if (s.form === "all") return types.every((t) => !has(t, s.x) || has(t, s.y));
  if (s.form === "no") return types.every((t) => !(has(t, s.x) && has(t, s.y)));
  if (s.form === "some") return types.some((t) => has(t, s.x) && has(t, s.y));
  return types.some((t) => has(t, s.x) && !has(t, s.y));
}
function models(preds: string[], premises: ReturnType<typeof stmt>[]) {
  const all = Array.from({ length: 1 << preds.length }, (_, mask) => new Set(preds.filter((_, i) => mask & (1 << i))));
  const out: Set<string>[][] = [];
  for (let sub = 1; sub < 1 << all.length; sub++) {
    const m = all.filter((_, i) => sub & (1 << i));
    if (premises.every((p) => holds(p, m))) out.push(m);
  }
  return out;
}

const DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_MN = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];

test("logic items: ordering, weekday arithmetic and syllogisms are decided independently and match in both languages", () => {
  const seen = { order: 0, week: 0, syl: 0 };
  for (const day of MANY) {
    const q = slot(day, "logical");
    const where = `${day}: ${q.prompt}`;
    let m: RegExpMatchArray | null;

    if (/ is taller than /.test(q.prompt)) {
      seen.order++;
      const clues = [...q.prompt.matchAll(/(\w+) is taller than (\w+)\./g)].map((c) => [c[1], c[2]] as [string, string]);
      const ask = q.prompt.endsWith("tallest?") ? "tallest" : "shortest";
      const { people, answers } = extremes(clues, ask);
      assert.deepEqual(answers, [q.right.label], where);
      assert.deepEqual(new Set(textOf(q)), new Set(people), `${where}: the options are exactly the people in the clues`);
      // Mongolian version: same structure, same unique answer
      const mc = [...q.mn!.prompt.matchAll(/(\S+) ба (\S+) хоёрын дундаас (\S+) илүү өндөр\./g)];
      assert.equal(mc.length, clues.length, where);
      for (const c of mc) assert.equal(c[3], c[1], `${where}: the first named person must be the taller one`);
      const mClues = mc.map((c) => [c[1], c[2]] as [string, string]);
      const mAsk = q.mn!.prompt.endsWith("Хамгийн өндөр нь хэн бэ?") ? "tallest" : q.mn!.prompt.endsWith("Хамгийн намхан нь хэн бэ?") ? "shortest" : null;
      assert.equal(mAsk, ask, `${where}: Mongolian asks the same question`);
      const mn = extremes(mClues, mAsk!);
      assert.deepEqual(mn.answers, [q.mn!.right], where);
      assert.deepEqual(new Set(mnTexts(q)), new Set(mn.people), where);
      // same clue graph in both languages (clue i names person i's counterpart in the same place)
      const idx = new Map(people.map((p, i) => [p, i]));
      const mIdx = new Map(mn.people.map((p, i) => [p, i]));
      assert.equal(JSON.stringify(clues.map(([a, b]) => [idx.get(a), idx.get(b)])), JSON.stringify(mClues.map(([a, b]) => [mIdx.get(a), mIdx.get(b)])), `${where}: Mongolian clues differ`);
    } else if ((m = q.prompt.match(/^If today is (\w+), what day (?:will it be in (\d+) days|was it (\d+) days ago)\?$/))) {
      seen.week++;
      const today = DAYS_EN.indexOf(m[1]), future = m[2] !== undefined, n = Number(m[2] ?? m[3]);
      assert.ok(today >= 0 && n >= 2 && n <= 13 && n % 7 !== 0, where);
      const target = DAYS_EN[(((today + (future ? n : -n)) % 7) + 7) % 7];
      assert.equal(q.right.label, target, where);
      assert.ok(!q.wrong.some((w) => w.label === target), where);
      const mm = q.mn!.prompt.match(/^Өнөөдөр (\S+) гараг бол (\d+) хоногийн (дараа|өмнө) /);
      assert.ok(mm, where);
      assert.equal(DAYS_MN.indexOf(mm[1]), today, where);
      assert.equal(Number(mm[2]), n, where);
      assert.equal(mm[3] === "дараа", future, where);
      assert.equal(q.mn!.right, DAYS_MN[DAYS_EN.indexOf(target)], where);
      assert.deepEqual(q.wrong.map((w) => DAYS_MN[DAYS_EN.indexOf(w.label!)]), q.mn!.wrong, `${where}: Mongolian distractors must be the same days`);
    } else if (/Which statement must be true\?$/.test(q.prompt)) {
      seen.syl++;
      const enStatement = (t: string) => {
        const all = t.match(/^All (\w+) are (\w+)$/), no = t.match(/^No (\w+) are (\w+)$/), sn = t.match(/^Some (\w+) are not (\w+)$/), sm = t.match(/^Some (\w+) are (\w+)$/);
        if (all) return stmt("all", all[1], all[2]);
        if (no) return stmt("no", no[1], no[2]);
        if (sn) return stmt("some-not", sn[1], sn[2]);
        assert.ok(sm, `unparseable option: ${t}`);
        return stmt("some", sm[1], sm[2]);
      };
      const mnStatement = (t: string) => {
        const all = t.match(/^Бүх (\S+) нь (\S+)$/), no = t.match(/^Ямар ч (\S+) (\S+) биш$/), sn = t.match(/^Зарим (\S+) нь (\S+) биш$/), sm = t.match(/^Зарим (\S+) нь (\S+)$/);
        if (all) return stmt("all", all[1], all[2]);
        if (no) return stmt("no", no[1], no[2]);
        if (sn) return stmt("some-not", sn[1], sn[2]);
        assert.ok(sm, `unparseable Mongolian option: ${t}`);
        return stmt("some", sm[1], sm[2]);
      };
      const premises = [...q.prompt.matchAll(/(All|No) (\w+) are (\w+)\./g)].map((p) => stmt(p[1] === "All" ? "all" : "no", p[2], p[3]));
      const mnPremises = [...q.mn!.prompt.matchAll(/Бүх (\S+) нь (\S+)\.|Ямар ч (\S+) (\S+) биш\./g)].map((p) => (p[1] ? stmt("all", p[1], p[2]) : stmt("no", p[3], p[4])));
      assert.equal(premises.length, 2, where);
      assert.equal(mnPremises.length, 2, where);
      assert.deepEqual(mnPremises.map((p) => p.form), premises.map((p) => p.form), `${where}: Mongolian premises must have the same forms`);
      // predicates in order of first appearance, so the two languages' models line up one to one
      const order = (ps: ReturnType<typeof stmt>[]) => [...new Set(ps.flatMap((p) => [p.x, p.y]))];
      const preds = order(premises), mnPreds = order(mnPremises);
      assert.equal(preds.length, 3, where);
      assert.equal(mnPreds.length, 3, where);
      const ms = models(preds, premises), mms = models(mnPreds, mnPremises);
      assert.equal(ms.length, mms.length, where);
      assert.ok(ms.length > 0);

      const right = enStatement(q.right.label!);
      assert.ok(ms.every((mod) => holds(right, mod)), `${where}: the answer is not entailed`);
      for (const w of q.wrong) assert.ok(ms.some((mod) => !holds(enStatement(w.label!), mod)), `${where}: distractor "${w.label}" is entailed too`);
      // every Mongolian option has exactly the truth conditions of its English counterpart
      const vec = (st: ReturnType<typeof stmt>, mods: Set<string>[][]) => mods.map((mod) => holds(st, mod)).join("");
      assert.equal(vec(mnStatement(q.mn!.right!), mms), vec(right, ms), `${where}: Mongolian answer means something else`);
      q.wrong.forEach((w, i) => assert.equal(vec(mnStatement(q.mn!.wrong![i]), mms), vec(enStatement(w.label!), ms), `${where}: Mongolian distractor ${i} means something else`));
    } else assert.fail(`unrecognised logical item: ${where}`);
  }
  assert.ok(seen.order > 100 && seen.week > 100 && seen.syl > 100, `all three logic kinds must appear: ${JSON.stringify(seen)}`);
});

// ------------------------------------------------------------------ visual pattern

type Hyp = (v: number[]) => number | null;
const periodic = (p: number): Hyp => (v) => (v.every((x, i) => i < p || x === v[i - p]) ? v[v.length - p] : null);
/** Constant step; modulo `mod` when given (angles), plain integers otherwise. */
const arithmetic = (mod: number): Hyp => (v) => {
  const norm = (x: number) => (mod ? ((x % mod) + mod) % mod : x);
  const d = norm(v[1] - v[0]);
  return v.slice(1).every((x, i) => norm(x - v[i]) === d) ? norm(v[v.length - 1] + d) : null;
};
const predict = (v: number[], hyps: Hyp[]) => [...new Set(hyps.map((h) => h(v)).filter((x): x is number => x !== null))];

/** Every glyph the four shown figures can be continued with under per-attribute periodic / arithmetic rules. */
function continuations(items: Glyph[]): string[] {
  const idx = <T,>(vals: T[]) => { const u = [...new Set(vals)]; return { codes: vals.map((x) => u.indexOf(x)), back: (c: number) => u[c] }; };
  const shapes = idx(items.map((g) => g.shape)), fills = idx(items.map((g) => g.fill ?? "solid"));
  const sh = predict(shapes.codes, [periodic(1), periodic(2), periodic(3)]).map(shapes.back);
  const fl = predict(fills.codes, [periodic(1), periodic(2), periodic(3)]).map(fills.back);
  const rot = predict(items.map((g) => g.rot ?? 0), [periodic(1), periodic(2), periodic(3), arithmetic(360)]);
  const cnt = predict(items.map((g) => g.n ?? 1), [periodic(1), periodic(2), periodic(3), arithmetic(0)]).filter((n) => n >= 1);
  const out = new Set<string>();
  for (const shape of sh) for (const fill of fl) for (const r of rot) for (const n of cnt) out.add(figKey({ k: "glyph", shape, rot: r, fill, n }));
  return [...out];
}

test("visual patterns: one continuation fits the four shown figures, it is the stated answer, and options differ", () => {
  const rulesSeen = new Set<string>();
  for (const day of MANY) {
    const q = slot(day, "abstract");
    const where = `${day}`;
    assert.equal(q.stem?.k, "seq", where);
    const items = (q.stem as { items: (Fig | null)[] }).items;
    assert.equal(items.length, 5);
    assert.equal(items[4], null);
    const shown = items.slice(0, 4) as Glyph[];
    assert.ok(shown.every((f) => f.k === "glyph"), where);
    const next = continuations(shown);
    assert.deepEqual(next, [figKey(q.right.fig!)], `${where}: shown ${shown.map(figKey).join(" | ")} continues as ${next} but the answer is ${figKey(q.right.fig!)}`);
    for (const f of [q.right, ...q.wrong]) assert.ok(f.fig && f.fig.k === "glyph" && (f.fig.n ?? 1) <= 6, where);
    assert.ok(new Set(shown.map(figKey)).size >= 2, `${where}: the shown figures must not all be the same`);
    rulesSeen.add(q.explanation.split(". ").length + ":" + (shown[0].shape === "arrow" ? "rot" : "") + (shown.some((g) => (g.n ?? 1) > 1) ? "n" : "") + (new Set(shown.map((g) => g.fill)).size > 1 ? "f" : "") + (new Set(shown.map((g) => g.shape)).size > 1 ? "s" : ""));
  }
  assert.ok(rulesSeen.size >= 8, `expected a variety of rule combinations, got ${[...rulesSeen]}`);
});

// ------------------------------------------------------------------ memory and speed

const cells = (f: Fig) => (f.k === "grid" ? f.cells.flat().reduce((a, b) => a + b, 0) : -1);

test("memory items: the answer is exactly what was shown (digits, word position, highlighted grid)", () => {
  const kinds = { digits: 0, reverse: 0, word: 0, grid: 0 };
  for (const day of MANY) {
    const q = slot(day, "memory");
    const where = `${day}: ${q.prompt}`;
    if (q.stimulus!.fig) {
      kinds.grid++;
      const shown = q.stimulus!.fig;
      assert.equal(figKey(q.right.fig!), figKey(shown), where);
      const n = cells(shown), side = shown.k === "grid" ? shown.cells.length : 0;
      assert.ok((side === 3 && n === 4) || (side === 4 && n === 5), `${where}: ${side}x${side} grid with ${n} lit squares`);
      for (const w of q.wrong) {
        assert.equal(cells(w.fig!), n, where);
        assert.equal(w.fig!.k === "grid" && w.fig!.cells.length, side, where);
        assert.notEqual(figKey(w.fig!), figKey(shown), where);
      }
    } else if (/^Which word was /.test(q.prompt)) {
      kinds.word++;
      const list = q.stimulus!.text!.split(" · ");
      const pos = ["first", "second", "third", "fourth", "fifth"].indexOf(q.prompt.match(/^Which word was (\w+) in the list\?$/)![1]);
      assert.ok(pos >= 0 && list.length === 5 && new Set(list).size === 5, where);
      assert.equal(q.right.label, list[pos], where);
      for (const w of q.wrong) assert.ok(list.includes(w.label!) && w.label !== list[pos], where);
      // Mongolian: same list, translated; same position
      const mnList = q.mn!.stimulus!.split(" · ");
      assert.deepEqual(mnList, list.map((w) => WORD_MN[w]), where);
      const mpos = ORD_MN.findIndex((o) => q.mn!.prompt.includes(`Жагсаалтын ${o} үг`));
      assert.equal(mpos, pos, where);
      assert.equal(q.mn!.right, mnList[pos], where);
      assert.deepEqual(q.wrong.map((w) => WORD_MN[w.label!]), q.mn!.wrong, where);
    } else {
      const digits = q.stimulus!.text!.replace(/ /g, "");
      assert.match(digits, /^\d{4,5}$/, where);
      assert.equal(new Set(digits).size, digits.length, `${where}: digits should not repeat`);
      const reverse = q.prompt.includes("REVERSE");
      if (reverse) kinds.reverse++;
      else kinds.digits++;
      const expected = reverse ? [...digits].reverse().join("") : digits;
      assert.equal(q.right.label!.replace(/ /g, ""), expected, where);
      for (const w of q.wrong) {
        const s = w.label!.replace(/ /g, "");
        assert.equal(s.length, expected.length, where);
        assert.notEqual(s, expected, where);
      }
      assert.equal(reverse, q.mn!.prompt.includes("ЭСРЭГ"), `${where}: Mongolian prompt must agree on direction`);
    }
  }
  assert.ok(Object.values(kinds).every((n) => n > 40), `all memory kinds must appear: ${JSON.stringify(kinds)}`);
});

test("speed items: the arithmetic and the identical code are right, distractors differ slightly", () => {
  let arithmetic = 0, code = 0;
  for (const day of MANY) {
    const q = slot(day, "speed");
    const where = `${day}: ${q.prompt}`;
    const expr = q.prompt.split(":").pop()!.trim();
    if (q.prompt.startsWith("Calculate")) {
      arithmetic++;
      assert.equal(String(Function(`return (${expr.replace(/×/g, "*").replace(/−/g, "-")})`)()), q.right.label, where);
      assert.ok(q.wrong.every((w) => Number(w.label) > 0), where);
      assert.equal(q.mn!.prompt.split(":").pop()!.trim(), expr, where);
    } else {
      code++;
      assert.equal(expr, q.right.label, where);
      for (const w of q.wrong) {
        assert.equal(w.label!.length, expr.length, where);
        const differing = [...w.label!].filter((ch, i) => ch !== expr[i]).length;
        assert.ok(differing >= 1 && differing <= 2, `${where}: "${w.label}" differs in ${differing} places`);
      }
      assert.ok(q.mn!.prompt.endsWith(expr), where);
    }
    // the printed answer must be reachable within the time limit by reading, not guessing
    assert.ok(q.timeLimitSec! >= 10, where);
  }
  assert.ok(arithmetic > 100 && code > 100, `both speed kinds must appear (${arithmetic}/${code})`);
});

// ------------------------------------------------------------------ variety, spread

test("a year of daily challenges: different every day, answers spread over the four positions", () => {
  assert.equal(new Set(YEAR.map((d) => JSON.stringify(gen(d).map((x) => [x.q.prompt, x.q.right, x.q.stimulus])))).size, YEAR.length, "no two days may be identical");
  const distinct = (s: (typeof DAILY_SLOTS)[number]) => new Set(YEAR.map((d) => { const q = slot(d, s); return JSON.stringify([q.prompt, q.stem, q.stimulus, q.right]); })).size;
  const floors: Record<string, number> = { logical: 290, numerical: 330, abstract: 330, memory: 330, speed: 340 };
  for (const s of DAILY_SLOTS) assert.ok(distinct(s) >= floors[s], `${s}: only ${distinct(s)} distinct questions in ${YEAR.length} days`);

  const pos = [0, 0, 0, 0];
  for (const d of YEAR) for (const { slot: s, q } of gen(d)) pos[buildOptions(q, hashStr(`daily:${d}:${s}`) % 100000).findIndex((o) => o.isCorrect)]++;
  const total = pos.reduce((a, b) => a + b, 0);
  for (const c of pos) assert.ok(c / total > 0.18 && c / total < 0.32, `answer position skew ${pos}`);
});
