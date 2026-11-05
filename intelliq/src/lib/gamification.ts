/**
 * Gamification rules. Pure and deterministic (tested in gamification.test.ts).
 * Rewards meaningful practice (completing assessments and challenges, consistency),
 * never an "IQ" claim.
 */
export type Bi = { en: string; mn: string };

// ---------- XP & levels ----------
export const WEEKLY_TARGET = 5; // daily challenges per ISO week
export const WEEKLY_BONUS_XP = 100;

export const xpForResult = (performance: number) => 20 + Math.floor(Math.max(0, Math.min(100, performance)) * 0.3);
export const xpForChallenge = (correct: number) => 15 + 5 * Math.max(0, correct);

/** Level n starts at 50·(n−1)² XP: 0, 50, 200, 450, 800, ... */
export const levelStart = (level: number) => 50 * (level - 1) ** 2;
export function levelOf(xp: number) {
  const x = Math.max(0, xp);
  const level = Math.floor(Math.sqrt(x / 50)) + 1;
  const start = levelStart(level);
  const next = levelStart(level + 1);
  return { level, xp: x, start, next, into: x - start, span: next - start, progress: (x - start) / (next - start) };
}

// ---------- dates ----------
export const utcDay = (d: Date = new Date()) => d.toISOString().slice(0, 10);
export function addDays(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return utcDay(d);
}
/** ISO-8601 week key like 2026-W44 (weeks start on Monday, UTC). */
export function isoWeekKey(d: Date = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------- streaks ----------
export type StreakState = { current: number; longest: number; lastActiveDate: string | null };

/** Activity today: same day keeps the streak, consecutive day extends it, a gap restarts at 1. */
export function nextStreak(s: StreakState, today: string): StreakState {
  if (s.lastActiveDate === today) return s;
  const current = s.lastActiveDate === addDays(today, -1) ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), lastActiveDate: today };
}

/** The streak a user still "holds" when viewing on `today` (it lapses after a missed day). */
export function activeStreak(s: StreakState, today: string) {
  return s.lastActiveDate === today || s.lastActiveDate === addDays(today, -1) ? s.current : 0;
}

// ---------- achievements ----------
export type AchStats = {
  resultsCount: number;
  perfectRuns: number; // accuracy 100% with >= 8 questions
  bestByCat: Record<string, number>; // best performance in a result with >= 2 questions in that domain
  consistentRecent: boolean; // last 3 attempts of one assessment within 10 points of each other
  longestStreak: number;
  challengesDone: number;
  domainsTried: number;
};

export type AchDef = {
  code: string;
  xp: number;
  name: Bi;
  desc: Bi;
  icon: "sparkles" | "target" | "brain" | "shapes" | "memory" | "zap" | "scale" | "flame" | "compass" | "calendar" | "book";
  check: (s: AchStats) => boolean;
  progress: (s: AchStats) => { current: number; target: number };
};

const best = (c: string) => (s: AchStats) => s.bestByCat[c] ?? 0;
const cap = (cur: number, target: number) => ({ current: Math.min(cur, target), target });

export const ACHIEVEMENTS: AchDef[] = [
  { code: "first-assessment", xp: 50, icon: "sparkles", name: { en: "First Assessment", mn: "Анхны тест" }, desc: { en: "Complete your first assessment.", mn: "Анхны тестээ дуусга." }, check: (s) => s.resultsCount >= 1, progress: (s) => cap(s.resultsCount, 1) },
  { code: "perfect-accuracy", xp: 150, icon: "target", name: { en: "Perfect Accuracy", mn: "Төгс нарийвчлал" }, desc: { en: "Answer every question correctly in an assessment of 8+ questions.", mn: "8+ асуулттай тестэд бүх асуултад зөв хариул." }, check: (s) => s.perfectRuns >= 1, progress: (s) => cap(s.perfectRuns, 1) },
  { code: "logical-thinker", xp: 100, icon: "brain", name: { en: "Logical Thinker", mn: "Логик сэтгэгч" }, desc: { en: "Reach 80% in logical reasoning (2+ questions).", mn: "Логик сэтгэлгээнд 80% хүр (2+ асуулт)." }, check: (s) => best("logical")(s) >= 80, progress: (s) => cap(best("logical")(s), 80) },
  { code: "pattern-master", xp: 100, icon: "shapes", name: { en: "Pattern Master", mn: "Хэв маягийн мастер" }, desc: { en: "Reach 80% in abstract reasoning (2+ questions).", mn: "Хийсвэр сэтгэлгээнд 80% хүр (2+ асуулт)." }, check: (s) => best("abstract")(s) >= 80, progress: (s) => cap(best("abstract")(s), 80) },
  { code: "memory-champion", xp: 100, icon: "memory", name: { en: "Memory Champion", mn: "Ойн аварга" }, desc: { en: "Reach 80% in memory (2+ questions).", mn: "Ой тогтоолтод 80% хүр (2+ асуулт)." }, check: (s) => best("memory")(s) >= 80, progress: (s) => cap(best("memory")(s), 80) },
  { code: "speed-solver", xp: 100, icon: "zap", name: { en: "Speed Solver", mn: "Хурдан бодогч" }, desc: { en: "Reach 80% in processing speed (2+ questions).", mn: "Боловсруулах хурдад 80% хүр (2+ асуулт)." }, check: (s) => best("speed")(s) >= 80, progress: (s) => cap(best("speed")(s), 80) },
  { code: "consistency-master", xp: 150, icon: "scale", name: { en: "Consistency Master", mn: "Тогтвортой байдлын мастер" }, desc: { en: "Three attempts of the same assessment within 10 points of each other.", mn: "Нэг тестийн гурван оролдлого бие биеэсээ 10 оноонд багтсан." }, check: (s) => s.consistentRecent, progress: (s) => cap(s.consistentRecent ? 1 : 0, 1) },
  { code: "seven-day-streak", xp: 200, icon: "flame", name: { en: "Seven-Day Streak", mn: "7 хоногийн цуваа" }, desc: { en: "Practise seven days in a row.", mn: "Долоо хоног дараалан дасгалла." }, check: (s) => s.longestStreak >= 7, progress: (s) => cap(s.longestStreak, 7) },
  { code: "cognitive-explorer", xp: 150, icon: "compass", name: { en: "Cognitive Explorer", mn: "Танин мэдэхүйн судлаач" }, desc: { en: "Be measured in all seven cognitive domains.", mn: "Долоон чадвар бүрээр хэмжигд." }, check: (s) => s.domainsTried >= 7, progress: (s) => cap(s.domainsTried, 7) },
  { code: "daily-challenger", xp: 50, icon: "calendar", name: { en: "Daily Challenger", mn: "Өдрийн сорилтот" }, desc: { en: "Complete a daily challenge.", mn: "Өдрийн сорилтыг дуусга." }, check: (s) => s.challengesDone >= 1, progress: (s) => cap(s.challengesDone, 1) },
  { code: "dedicated-learner", xp: 150, icon: "book", name: { en: "Dedicated Learner", mn: "Шаргуу суралцагч" }, desc: { en: "Complete 10 assessments.", mn: "10 тест дуусга." }, check: (s) => s.resultsCount >= 10, progress: (s) => cap(s.resultsCount, 10) },
];

export const earnedCodes = (s: AchStats) => ACHIEVEMENTS.filter((a) => a.check(s)).map((a) => a.code);

export function isConsistent(performances: number[]) {
  return performances.length >= 3 && Math.max(...performances) - Math.min(...performances) <= 10;
}
