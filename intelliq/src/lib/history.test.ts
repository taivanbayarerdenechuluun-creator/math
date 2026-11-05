import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryTrends, compareAttempts, summarize, type HistoryRow } from "./history";

const row = (id: string, performance: number, cats: [string, number, number][], extra: Partial<HistoryRow> = {}): HistoryRow => ({
  id, date: `2026-10-${id.padStart(2, "0")}T10:00:00Z`, assessmentSlug: "full-battery", titleEn: "Full", titleMn: "Бүрэн",
  performance, accuracy: performance, durationSec: 600, total: 28,
  categories: cats.map(([slug, total, p]) => ({ slug, total, performance: p })), ...extra,
});

test("summary: counts, best, average, delta and direction", () => {
  const s = summarize([row("1", 50, []), row("2", 62, []), row("3", 71, [])]);
  assert.equal(s.attempts, 3);
  assert.equal(s.best, 71);
  assert.equal(s.average, 61);
  assert.equal(s.latest, 71);
  assert.equal(s.delta, 21);
  assert.equal(s.direction, "up");
  assert.equal(summarize([row("1", 60, []), row("2", 58, [])]).direction, "flat");
  assert.equal(summarize([row("1", 60, []), row("2", 50, [])]).direction, "down");
});

test("summary: one attempt has no trend; empty history is all null", () => {
  assert.equal(summarize([row("1", 60, [])]).direction, null);
  assert.equal(summarize([row("1", 60, [])]).delta, null);
  assert.deepEqual(summarize([]), { attempts: 0, best: null, average: null, latest: null, delta: null, direction: null, avgAccuracy: null, avgDurationSec: null });
});

test("category trends: strengths and weaknesses need repeated evidence", () => {
  const rows = [
    row("1", 60, [["logical", 4, 80], ["numerical", 4, 30], ["memory", 4, 60], ["verbal", 4, 90]]),
    row("2", 65, [["logical", 4, 75], ["numerical", 4, 40], ["memory", 4, 55], ["verbal", 1, 10]]),
  ];
  const t = Object.fromEntries(categoryTrends(rows).map((c) => [c.slug, c]));
  assert.equal(t.logical.kind, "strength");
  assert.equal(t.logical.average, 77.5);
  assert.equal(t.logical.delta, -5);
  assert.equal(t.numerical.kind, "weakness");
  assert.equal(t.numerical.delta, 10);
  assert.equal(t.memory.kind, "mixed");
  // verbal: second attempt had 1 question so it is ignored, leaving a single data point
  assert.equal(t.verbal.attempts, 1);
  assert.equal(t.verbal.kind, "mixed", "a single attempt never makes a strength");
  assert.equal(t.verbal.delta, null);
});

test("domains with fewer than 2 questions are excluded entirely", () => {
  assert.deepEqual(categoryTrends([row("1", 50, [["speed", 1, 100]])]), []);
});

test("compare attempts: deltas, comparability flag, thin domains have no delta", () => {
  const a = row("1", 50, [["logical", 4, 40], ["memory", 1, 100]]);
  const b = row("2", 70, [["logical", 4, 80], ["memory", 4, 20]], { durationSec: 500, accuracy: 75 });
  const c = compareAttempts(a, b);
  assert.equal(c.overall, 20);
  assert.equal(c.accuracy, 25);
  assert.equal(c.durationSec, -100);
  assert.equal(c.comparableAssessment, true);
  assert.equal(c.categories.find((x) => x.slug === "logical")!.delta, 40);
  assert.equal(c.categories.find((x) => x.slug === "memory")!.delta, null);
  assert.equal(compareAttempts(a, row("3", 60, [], { assessmentSlug: "quick-check" })).comparableAssessment, false);
});
