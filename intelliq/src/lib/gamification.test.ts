import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS, activeStreak, addDays, earnedCodes, isConsistent, isoWeekKey, levelOf, levelStart, nextStreak,
  xpForChallenge, xpForResult, type AchStats,
} from "./gamification";

const none: AchStats = { resultsCount: 0, perfectRuns: 0, bestByCat: {}, consistentRecent: false, longestStreak: 0, challengesDone: 0, domainsTried: 0 };

test("xp amounts", () => {
  assert.equal(xpForResult(0), 20);
  assert.equal(xpForResult(100), 50);
  assert.equal(xpForResult(68.7), 40);
  assert.equal(xpForResult(150), 50, "clamped");
  assert.equal(xpForChallenge(0), 15);
  assert.equal(xpForChallenge(5), 40);
});

test("levels follow 50*(n-1)^2", () => {
  assert.equal(levelStart(1), 0);
  assert.equal(levelStart(2), 50);
  assert.equal(levelStart(3), 200);
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(49).level, 1);
  assert.equal(levelOf(50).level, 2);
  assert.equal(levelOf(199).level, 2);
  assert.equal(levelOf(200).level, 3);
  const l = levelOf(125);
  assert.deepEqual([l.level, l.into, l.span], [2, 75, 150]);
  assert.equal(l.progress, 0.5);
});

test("streak extends on consecutive days, ignores same day, resets after a gap", () => {
  let s = { current: 0, longest: 0, lastActiveDate: null as string | null };
  s = nextStreak(s, "2026-10-01");
  assert.deepEqual(s, { current: 1, longest: 1, lastActiveDate: "2026-10-01" });
  assert.equal(nextStreak(s, "2026-10-01"), s, "same day unchanged");
  s = nextStreak(s, "2026-10-02");
  s = nextStreak(s, "2026-10-03");
  assert.equal(s.current, 3);
  s = nextStreak(s, "2026-10-06");
  assert.deepEqual([s.current, s.longest], [1, 3], "gap resets current but keeps longest");
  s = nextStreak({ current: 4, longest: 4, lastActiveDate: "2026-10-31" }, "2026-11-01");
  assert.equal(s.current, 5, "crosses month boundary");
});

test("active streak lapses after a missed day", () => {
  const s = { current: 6, longest: 6, lastActiveDate: "2026-10-30" };
  assert.equal(activeStreak(s, "2026-10-30"), 6);
  assert.equal(activeStreak(s, "2026-10-31"), 6, "still alive the next day");
  assert.equal(activeStreak(s, "2026-11-01"), 0);
});

test("date helpers", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(isoWeekKey(new Date("2026-10-31T12:00:00Z")), "2026-W44");
  assert.equal(isoWeekKey(new Date("2026-01-01T00:00:00Z")), "2026-W01");
  assert.equal(isoWeekKey(new Date("2024-12-30T00:00:00Z")), "2025-W01", "ISO year rollover");
  assert.equal(isoWeekKey(new Date("2026-10-26T00:00:00Z")), isoWeekKey(new Date("2026-11-01T23:59:00Z")), "Mon..Sun share a week");
});

test("achievements: none earned from nothing; each condition fires at its threshold", () => {
  assert.deepEqual(earnedCodes(none), []);
  assert.deepEqual(earnedCodes({ ...none, resultsCount: 1 }), ["first-assessment"]);
  assert.ok(earnedCodes({ ...none, bestByCat: { logical: 80 } }).includes("logical-thinker"));
  assert.ok(!earnedCodes({ ...none, bestByCat: { logical: 79.9 } }).includes("logical-thinker"));
  assert.ok(earnedCodes({ ...none, bestByCat: { abstract: 90 } }).includes("pattern-master"));
  assert.ok(earnedCodes({ ...none, bestByCat: { memory: 80 } }).includes("memory-champion"));
  assert.ok(earnedCodes({ ...none, bestByCat: { speed: 100 } }).includes("speed-solver"));
  assert.ok(earnedCodes({ ...none, perfectRuns: 1 }).includes("perfect-accuracy"));
  assert.ok(!earnedCodes({ ...none, longestStreak: 6 }).includes("seven-day-streak"));
  assert.ok(earnedCodes({ ...none, longestStreak: 7 }).includes("seven-day-streak"));
  assert.ok(earnedCodes({ ...none, domainsTried: 7 }).includes("cognitive-explorer"));
  assert.ok(!earnedCodes({ ...none, domainsTried: 6 }).includes("cognitive-explorer"));
  assert.ok(earnedCodes({ ...none, challengesDone: 1 }).includes("daily-challenger"));
  assert.ok(earnedCodes({ ...none, resultsCount: 10 }).includes("dedicated-learner"));
  assert.ok(earnedCodes({ ...none, consistentRecent: true }).includes("consistency-master"));
});

test("consistency needs three attempts within 10 points", () => {
  assert.equal(isConsistent([70, 75]), false);
  assert.equal(isConsistent([70, 75, 80]), true);
  assert.equal(isConsistent([70, 75, 81]), false);
});

test("achievement definitions are complete, bilingual and have sane progress", () => {
  const codes = new Set(ACHIEVEMENTS.map((a) => a.code));
  assert.equal(codes.size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.name.en && a.name.mn && a.desc.en && a.desc.mn && a.xp > 0, a.code);
    const p0 = a.progress(none);
    assert.equal(p0.current, 0);
    assert.ok(p0.target > 0);
  }
  for (const code of ["first-assessment", "perfect-accuracy", "logical-thinker", "pattern-master", "memory-champion", "speed-solver", "consistency-master", "seven-day-streak", "cognitive-explorer"]) {
    assert.ok(codes.has(code), `${code} required by the spec`);
  }
});
