import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK, CORE_BANK } from "./index";
import { buildOptions } from "./build";
import { cubeCount, isVisibleStack, reactionDelayMs, type Fig, type Matrix } from "../../lib/figures";

const CYR = /[Ѐ-ӿ]/;
const hasWord = (s?: string) => !!s && /[a-z]{2,}/.test(s); // real words have lowercase letters; codes like KQ47M do not

test("stable, unique keys of the form category-NNN", () => {
  const keys = BANK.map((q) => q.key);
  assert.equal(new Set(keys).size, BANK.length);
  for (const q of BANK) assert.match(q.key!, new RegExp(`^${q.cat}-\\d{3}$`));
  assert.equal(BANK.find((q) => q.cat === "spatial")!.key, "spatial-001");
  assert.equal(CORE_BANK.filter((q) => q.cat === "spatial").at(-1)!.key, "spatial-025");
  assert.equal(BANK.filter((q) => q.cat === "spatial").at(-1)!.key, "spatial-145");
});

test("every question has complete Mongolian text", () => {
  for (const q of BANK) {
    const id = `${q.key}: ${q.prompt.slice(0, 40)}`;
    assert.ok(q.mn, `${id} has no Mongolian text`);
    assert.ok(CYR.test(q.mn!.prompt) && q.mn!.prompt.length > 8, `${id}: Mongolian prompt`);
    // A pure arithmetic line such as "8 + 9 = 17." is the same in every language.
    const pureMath = /^[\d\s+\-×÷().=−]+$/.test(q.mn!.explanation);
    assert.ok(pureMath || (CYR.test(q.mn!.explanation) && q.mn!.explanation.length > 8), `${id}: Mongolian explanation`);
    // Options whose English label is a real word/phrase need a Mongolian label for the right and every wrong option.
    const wordy = hasWord(q.right.label) || q.wrong.some((w) => hasWord(w.label));
    if (wordy) {
      assert.ok(q.mn!.right && CYR.test(q.mn!.right!), `${id}: Mongolian right option`);
      assert.equal(q.mn!.wrong?.length, q.wrong.length, `${id}: Mongolian wrong options count`);
      for (const w of q.mn!.wrong!) assert.ok(CYR.test(w), `${id}: Mongolian wrong option ${w}`);
      const all = [q.mn!.right!, ...q.mn!.wrong!];
      assert.equal(new Set(all).size, all.length, `${id}: Mongolian options must be distinct`);
    }
  }
});

test("Mongolian word-list stimuli match the English ones word for word", () => {
  for (const q of BANK.filter((x) => x.stimulus?.text?.includes(" · "))) {
    assert.ok(q.mn!.stimulus, `${q.key} needs a Mongolian stimulus`);
    assert.equal(q.mn!.stimulus!.split(" · ").length, q.stimulus!.text!.split(" · ").length, q.key);
    assert.ok(CYR.test(q.mn!.stimulus!));
  }
  for (const q of BANK.filter((x) => x.stimulus && !x.stimulus.text?.includes(" · "))) assert.equal(q.mn!.stimulus, undefined, `${q.key}: digits, letters and grids are language-neutral`);
});

test("the seeded option rows carry the Mongolian label for the right option", () => {
  BANK.forEach((q, i) => {
    const built = buildOptions(q, i);
    const right = built.find((o) => o.isCorrect)!;
    if (q.mn?.right) assert.equal(right.labelMn, q.mn.right, q.key);
    else assert.equal(right.labelMn, null, q.key);
  });
});

const spatial3d = CORE_BANK.filter((q) => q.cat === "spatial" && (q.stem?.k === "iso" || (q.right.fig as Fig | undefined)?.k === "iso"));

test("3D items: ten of them, two per difficulty, and every stack is fully visible", () => {
  assert.equal(spatial3d.length, 10);
  for (const d of [1, 2, 3, 4, 5]) assert.equal(spatial3d.filter((q) => q.diff === d).length, 2, `difficulty ${d}`);
  for (const q of spatial3d) {
    const stacks: Matrix[] = [q.stem, q.right.fig, ...q.wrong.map((w) => w.fig)].filter((f): f is Fig => !!f && (f as Fig).k === "iso").map((f) => (f as { heights: Matrix }).heights);
    assert.ok(stacks.length >= 1);
    for (const h of stacks) assert.ok(isVisibleStack(h), `${q.key}: a column would be hidden from the camera: ${JSON.stringify(h)}`);
  }
});

test("3D counting items: the right option is the true cube count and no distractor equals it", () => {
  const counting = spatial3d.filter((q) => q.stem?.k === "iso");
  assert.equal(counting.length, 5);
  for (const q of counting) {
    const n = cubeCount((q.stem as { heights: Matrix }).heights);
    assert.equal(q.right.label, String(n), q.key);
    for (const w of q.wrong) assert.notEqual(w.label, String(n), q.key);
    assert.equal(new Set([q.right.label, ...q.wrong.map((w) => w.label)]).size, 4);
  }
});

test("3D comparison items: exactly one structure has the stated number of cubes", () => {
  const cmp = spatial3d.filter((q) => q.stem === undefined);
  assert.equal(cmp.length, 5);
  for (const q of cmp) {
    const n = Number(/exactly (\d+) cubes/.exec(q.prompt)![1]);
    const sums = [q.right.fig, ...q.wrong.map((w) => w.fig)].map((f) => cubeCount((f as { heights: Matrix }).heights));
    assert.equal(sums.filter((x) => x === n).length, 1, `${q.key}: ${sums}`);
    assert.equal(sums[0], n, `${q.key}: the right option must be the one with ${n} cubes`);
    assert.equal(new Set(sums).size, 4, `${q.key}: all four structures differ in size`);
    assert.match(q.mn!.prompt, new RegExp(String(n)));
  }
});

test("reaction items: valid configuration, four pads, generous but bounded limits", () => {
  const items = BANK.filter((q) => q.stem?.k === "reaction");
  assert.equal(items.length, 5);
  for (const d of [1, 2, 3, 4, 5]) assert.equal(items.filter((q) => q.diff === d).length, 1);
  let prevLimit = Infinity;
  for (const q of items) {
    const st = q.stem as { minMs: number; maxMs: number; limitMs: number };
    assert.ok(st.minMs >= 800 && st.maxMs > st.minMs && st.maxMs <= 6000, q.key);
    assert.ok(st.limitMs >= 800 && st.limitMs <= 3000, `${q.key}: limit leaves room for network latency`);
    assert.ok(st.limitMs <= prevLimit, `${q.key}: harder levels allow less time`);
    prevLimit = st.limitMs;
    assert.ok(q.timeLimitSec! >= Math.ceil((st.maxMs + st.limitMs) / 1000) + 2, `${q.key}: overall timer outlasts delay + limit`);
    assert.equal(q.fixedOrder, true);
    assert.deepEqual(buildOptions(q, 0).map((o) => o.label), ["1", "2", "3", "4"]);
    assert.equal(buildOptions(q, 0).findIndex((o) => o.isCorrect), q.rightIndex);
  }
});

test("reaction delay is deterministic, in range and varies with the seed", () => {
  assert.equal(reactionDelayMs("abc", 1000, 3000), reactionDelayMs("abc", 1000, 3000));
  const ds = Array.from({ length: 200 }, (_, i) => reactionDelayMs(`row-${i}`, 1000, 3000));
  assert.ok(ds.every((d) => d >= 1000 && d <= 3000));
  assert.ok(new Set(ds).size > 150, "spread across the range");
});
