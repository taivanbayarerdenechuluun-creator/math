import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeedback, type CatStat, type FeedbackInput } from "./feedback";

const cat = (slug: string, correct: number, total: number, performance: number, extra: Partial<CatStat> = {}): CatStat => ({
  slug, total, correct, performance, hardestCorrect: null, unanswered: 0, ...extra,
});
const all = (f: ReturnType<typeof buildFeedback>) => [f.summary, ...f.strengths, ...f.improvements, ...f.observations, ...f.recommendations];
const text = (f: ReturnType<typeof buildFeedback>) => all(f).map((b) => b.en + " " + b.mn).join("\n");

const base: FeedbackInput = {
  performance: 68, accuracy: 70, total: 28, unanswered: 0,
  cats: [cat("logical", 4, 4, 90), cat("numerical", 2, 4, 40), cat("verbal", 3, 4, 70), cat("memory", 3, 4, 72)],
};

test("names the strongest and weakest domains from the data", () => {
  const f = buildFeedback(base);
  assert.match(f.strengths[0].en, /strongest domain was logical reasoning \(90%, 4\/4 correct\)/);
  assert.match(f.improvements[0].en, /Numerical reasoning could benefit.*\(40%, 2\/4 correct\)/);
  assert.match(f.improvements[0].mn, /Тооллын сэтгэлгээ/);
  assert.equal(f.confidence, "ok");
});

test("recommendations correspond to weak domains only", () => {
  const f = buildFeedback(base);
  assert.equal(f.recommendations.length, 1);
  assert.match(f.recommendations[0].en, /series|percentage/i);
});

test("never claims IQ or percentile; every item is bilingual and non-empty", () => {
  for (const f of [buildFeedback(base), buildFeedback({ ...base, performance: 20 })]) {
    for (const b of all(f)) {
      assert.ok(b.en.length > 10 && b.mn.length > 10);
      assert.doesNotMatch(b.en, /\bIQ of\b|percentile rank|your IQ is/i);
    }
    assert.match(f.summary.en, /not an IQ/);
  }
});

test("balanced profile detected; no weak domain invented", () => {
  const f = buildFeedback({ ...base, performance: 80, cats: [cat("logical", 3, 4, 82), cat("verbal", 3, 4, 78), cat("memory", 3, 4, 80)] });
  assert.ok(f.observations.some((o) => /balanced/.test(o.en)));
  assert.equal(f.improvements.length, 0);
  assert.match(f.recommendations[0].en, /daily challenge/);
});

test("low confidence with few questions; domains with <2 questions are not ranked", () => {
  const f = buildFeedback({ performance: 70, accuracy: 70, total: 10, unanswered: 0, cats: [cat("logical", 1, 1, 100), cat("verbal", 0, 1, 0), cat("memory", 1, 1, 100)] });
  assert.equal(f.confidence, "low");
  assert.equal(f.strengths.length, 0);
  assert.equal(f.improvements.length, 0);
  assert.ok(f.observations.some((o) => /few questions per domain/.test(o.en)));
});

test("flags many unanswered questions and speed time-outs", () => {
  const f = buildFeedback({ ...base, total: 10, unanswered: 3, cats: [...base.cats, cat("speed", 0, 2, 0, { unanswered: 2 })] });
  assert.ok(f.observations.some((o) => /3 of 10 questions were left unanswered/.test(o.en)));
  assert.ok(f.observations.some((o) => /2 processing-speed question/.test(o.en)));
  const none = buildFeedback({ ...base, unanswered: 1 });
  assert.ok(!none.observations.some((o) => /unanswered/.test(o.en)));
});

test("hard items answered correctly are credited", () => {
  const f = buildFeedback({ ...base, cats: [cat("logical", 4, 4, 90, { hardestCorrect: 5 }), cat("verbal", 2, 4, 50, { hardestCorrect: 3 })] });
  assert.ok(f.strengths.some((s) => /difficulty-5 logical reasoning/.test(s.en)));
  assert.ok(!f.strengths.some((s) => /difficulty-3/.test(s.en)));
});

test("comparison with previous attempt uses real deltas and carries the practice caveat", () => {
  const f = buildFeedback({
    ...base,
    performance: 68,
    previous: { performance: 55, cats: [{ slug: "logical", performance: 60, total: 4 }, { slug: "numerical", performance: 55, total: 4 }, { slug: "verbal", performance: 70, total: 4 }] },
  });
  const obs = f.observations.map((o) => o.en).join("\n");
  assert.match(obs, /13 points higher than your previous attempt/);
  assert.match(obs, /logical reasoning performance was stronger.*\+30/);
  assert.match(obs, /numerical reasoning performance was lower.*-15/);
  assert.doesNotMatch(obs, /verbal reasoning performance/); // change of 0 is not reported
  assert.match(obs, /not a change in IQ/);
});

test("similar performance is described as similar", () => {
  const f = buildFeedback({ ...base, previous: { performance: 66, cats: [] } });
  assert.ok(f.observations.some((o) => /similar to your previous attempt \(\+2 points\)/.test(o.en)));
});

test("deterministic", () => {
  assert.deepEqual(buildFeedback(base), buildFeedback(base));
  assert.ok(!text(buildFeedback(base)).includes("undefined"));
});

test("improvement list is capped to the weakest three domains", () => {
  const f = buildFeedback({
    performance: 25, accuracy: 25, total: 28, unanswered: 0,
    cats: [cat("logical", 0, 4, 0), cat("abstract", 1, 4, 10), cat("numerical", 1, 4, 20), cat("verbal", 1, 4, 30), cat("memory", 2, 4, 40), cat("spatial", 3, 4, 70)],
  });
  assert.equal(f.improvements.length, 3);
  assert.match(f.improvements[0].en, /Logical reasoning/);
  assert.ok(!f.improvements.some((i) => /Memory/i.test(i.en)), "less-weak domains are not listed");
});

test("only the three largest per-domain changes are reported", () => {
  const slugs = ["logical", "abstract", "numerical", "verbal", "spatial"];
  const f = buildFeedback({
    performance: 90, accuracy: 90, total: 20, unanswered: 0,
    cats: slugs.map((s, i) => cat(s, 3, 4, 50 + (i + 1) * 10)),
    previous: { performance: 50, cats: slugs.map((s) => ({ slug: s, performance: 40, total: 4 })) },
  });
  const lines = f.observations.filter((o) => /performance was (stronger|lower) than your previous/.test(o.en));
  assert.equal(lines.length, 3);
  assert.match(lines[0].en, /spatial reasoning.*\+60/); // largest change first
});

test("weakestDomain: only genuinely weak or far-behind domains qualify", async () => {
  const { weakestDomain } = await import("./feedback");
  const c = (slug: string, performance: number, total = 4) => ({ slug, total, performance });
  assert.equal(weakestDomain([c("a", 100), c("b", 100), c("c", 100)]), null, "a perfect profile has no weakest domain");
  assert.equal(weakestDomain([c("a", 80), c("b", 75), c("c", 78)]), null, "a flat, solid profile has none");
  assert.equal(weakestDomain([c("a", 55), c("b", 58)])!.slug, "a", "below 60% is weak");
  assert.equal(weakestDomain([c("a", 100), c("b", 78)])!.slug, "b", "20+ points behind the best is weak");
  assert.equal(weakestDomain([c("a", 100)]), null, "needs at least two ranked domains");
  assert.equal(weakestDomain([c("a", 10, 1), c("b", 90), c("c", 85)]), null, "domains with < 2 questions are ignored");
});
