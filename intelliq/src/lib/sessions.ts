import "server-only";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db, isUniqueViolation } from "./db";
import { getCurrentUser } from "./session";
import { applyAnswer, parseState, parseWeights, pickCategory, pickQuestion, targetDifficulty, type Range } from "./engine";
import { reactionDelayMs, type Reaction } from "./figures";
import { score, SCORING_VERSION } from "./scoring";
import { awardForResult } from "./awards";

export const GUEST_COOKIE = "iq_guest";
const TIMER_GRACE_MS = 3000;
const DEADLINE_GRACE_MS = 5000;

type Tx = Prisma.TransactionClient;

// ---------- identity & access ----------

export async function readGuestId() {
  return (await cookies()).get(GUEST_COOKIE)?.value ?? null;
}

export async function ensureGuestId() {
  const jar = await cookies();
  let id = jar.get(GUEST_COOKIE)?.value;
  if (!id) {
    id = randomBytes(18).toString("hex");
    jar.set(GUEST_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return id;
}

/** Loads a session only if the caller owns it (signed-in owner, or the guest cookie that created it). */
export async function loadOwnedSession(id: string) {
  const session = await db.assessmentSession.findUnique({ where: { id }, include: { assessment: true, result: true } });
  if (!session) return null;
  const user = await getCurrentUser();
  if (session.userId) return user?.id === session.userId ? session : null;
  const guest = await readGuestId();
  return guest && session.guestToken === guest ? session : null;
}

export type OwnedSession = NonNullable<Awaited<ReturnType<typeof loadOwnedSession>>>;

export function sessionExpired(startedAt: Date, durationSec: number | null) {
  return !!durationSec && Date.now() > startedAt.getTime() + durationSec * 1000;
}

export function deadlineOf(s: OwnedSession) {
  return s.assessment.durationSec ? s.startedAt.getTime() + s.assessment.durationSec * 1000 : null;
}

// ---------- public (answer-key-free) question shape ----------

export type PublicQuestion = {
  id: string;
  position: number;
  category: string;
  difficulty: number;
  prompt: string;
  promptMn: string | null;
  stem: unknown | null;
  stimulus: { text?: string; fig?: unknown } | null;
  stimulusMn: string | null;
  stimulusRemainingMs: number | null;
  timeLimitSec: number | null;
  timeLeftMs: number | null;
  options: { id: string; label: string; labelMn: string | null; figure: unknown | null }[];
  /**
   * Reaction items only (latest, unanswered): the pad lights after startsInMs. The lit pad is the stimulus itself,
   * so naming it reveals nothing the user will not see; correctness is still decided on the server.
   */
  reaction: { startsInMs: number; targetOptionId: string; limitMs: number } | null;
};

const rangeOf = (a: { difficultyMin: number; difficultyMax: number }): Range => ({ min: a.difficultyMin, max: a.difficultyMax });

function reactionCfg(q: { kind: string; figure: string | null }): Reaction | null {
  if (q.kind !== "reaction" || !q.figure) return null;
  const f = JSON.parse(q.figure) as Reaction;
  return f.k === "reaction" ? f : null;
}

const answerRowInclude = {
  question: { include: { category: true, options: { orderBy: { position: "asc" as const } } } },
} satisfies Prisma.UserAnswerInclude;

type Row = Prisma.UserAnswerGetPayload<{ include: typeof answerRowInclude }>;

const parse = (s: string | null) => (s ? JSON.parse(s) : null);

/** Builds the client payload. Never includes isCorrect or explanation. */
async function toPublic(tx: Tx, row: Row, isLatest: boolean): Promise<PublicQuestion> {
  const q = row.question;
  const now = Date.now();
  let stimulus: PublicQuestion["stimulus"] = null;
  let stimulusRemainingMs: number | null = null;

  if (isLatest && !row.resolved && q.stimulus) {
    const sec = q.stimulusSec ?? 5;
    const seen = row.stimulusSeenAt?.getTime() ?? now;
    if (!row.stimulusSeenAt) await tx.userAnswer.update({ where: { id: row.id }, data: { stimulusSeenAt: new Date(seen) } });
    const remaining = sec * 1000 - (now - seen);
    if (remaining > 0) {
      stimulus = parse(q.stimulus);
      stimulusRemainingMs = remaining;
    }
  }

  const timeLeftMs =
    isLatest && !row.resolved && q.timeLimitSec ? Math.max(0, q.timeLimitSec * 1000 - (now - row.servedAt.getTime())) : null;

  let reaction: PublicQuestion["reaction"] = null;
  const cfg = reactionCfg(q);
  if (cfg && isLatest && !row.resolved) {
    const delay = reactionDelayMs(row.id, cfg.minMs, cfg.maxMs);
    reaction = {
      startsInMs: Math.max(0, delay - (now - row.servedAt.getTime())),
      targetOptionId: q.options.find((o) => o.isCorrect)!.id,
      limitMs: cfg.limitMs,
    };
  }

  return {
    id: q.id,
    position: row.position,
    category: q.category.slug,
    difficulty: row.difficulty,
    prompt: q.prompt,
    promptMn: q.promptMn,
    stem: parse(q.figure),
    stimulus,
    stimulusMn: stimulus ? q.stimulusMn : null,
    stimulusRemainingMs,
    timeLimitSec: q.timeLimitSec,
    timeLeftMs,
    options: q.options.map((o) => ({ id: o.id, label: o.label, labelMn: o.labelMn, figure: parse(o.figure) })),
    reaction,
  };
}

// ---------- serving ----------

/**
 * Questions this person (the signed-in user, or the guest's browser) was served in their OTHER tests, most recent
 * first (capped, so a very long history stays cheap). A new test prefers questions not in this set.
 */
async function seenElsewhere(tx: Tx, s: { id: string; userId: string | null; guestToken: string | null }): Promise<Set<string>> {
  const owner = s.userId ? { userId: s.userId } : s.guestToken ? { guestToken: s.guestToken } : null;
  if (!owner) return new Set();
  const rows = await tx.userAnswer.findMany({
    where: { session: { ...owner, id: { not: s.id } } },
    orderBy: { servedAt: "desc" },
    take: 1500,
    select: { questionId: true },
  });
  return new Set(rows.map((r) => r.questionId));
}

/** Serves the next question per the adaptive engine. Returns null when the test is full or the bank is exhausted. */
export async function serveNext(tx: Tx, sessionId: string): Promise<PublicQuestion | null> {
  const session = await tx.assessmentSession.findUniqueOrThrow({ where: { id: sessionId }, include: { assessment: true } });
  const rows = await tx.userAnswer.findMany({ where: { sessionId }, include: { question: { select: { categoryId: true } } } });
  if (rows.length >= session.assessment.questionCount) return null;

  const slugs = session.assessment.categorySlugs ? session.assessment.categorySlugs.split(",") : null;
  const cats = await tx.category.findMany({ where: slugs ? { slug: { in: slugs } } : undefined });
  const slugById = new Map(cats.map((c) => [c.id, c.slug]));
  const asked = rows.map((r) => r.questionId);

  const a = session.assessment;
  const range = rangeOf(a);
  const weights = parseWeights(a.categoryWeights);
  // A curated pool (set in the admin panel) restricts which questions may be served.
  const pool = (await tx.assessmentQuestion.findMany({ where: { assessmentId: a.id }, select: { questionId: true } })).map((x) => x.questionId);
  const candidates = await tx.question.findMany({
    where: {
      active: true,
      categoryId: { in: cats.map((c) => c.id) },
      id: pool.length ? { in: pool, notIn: asked } : { notIn: asked },
      difficulty: { gte: range.min, lte: range.max },
    },
    select: { id: true, categoryId: true, difficulty: true },
  });
  if (candidates.length === 0) return null;

  const served: Record<string, number> = {};
  for (const r of rows) {
    const slug = slugById.get(r.question.categoryId)!;
    served[slug] = (served[slug] ?? 0) + 1;
  }
  const availableSlugs = [...new Set(candidates.map((c) => slugById.get(c.categoryId)!))];
  const slug = pickCategory(served, availableSlugs, Math.random, weights)!;
  const target = targetDifficulty(parseState(session.adaptState), slug, a.adaptive, range);
  const pick = pickQuestion(candidates.filter((c) => slugById.get(c.categoryId) === slug), target, Math.random, await seenElsewhere(tx, session))!;

  const row = await tx.userAnswer.create({
    data: { sessionId, position: rows.length + 1, questionId: pick.id, difficulty: pick.difficulty },
    include: answerRowInclude,
  });
  return toPublic(tx, row, true);
}

export async function startSession(assessmentId: string, userId: string | null, guestId: string | null) {
  return db.$transaction(async (tx) => {
    const session = await tx.assessmentSession.create({
      data: { assessmentId, userId, guestToken: userId ? null : guestId },
    });
    await serveNext(tx, session.id);
    return session;
  });
}

// ---------- state for the client ----------

export async function getState(s: OwnedSession) {
  return db.$transaction(async (tx) => {
    const rows = await tx.userAnswer.findMany({ where: { sessionId: s.id }, orderBy: { position: "asc" }, include: answerRowInclude });
    const questions: PublicQuestion[] = [];
    for (const [i, r] of rows.entries()) questions.push(await toPublic(tx, r, i === rows.length - 1));
    return {
      questions,
      answers: Object.fromEntries(rows.map((r) => [r.questionId, { optionId: r.optionId, flagged: r.flagged, resolved: r.resolved }])),
    };
  });
}

// ---------- answering ----------

export type AnswerResult = { ok: true; resolved: boolean; expired?: boolean } | { ok: false; status: number; error: string };

export async function saveAnswer(
  s: OwnedSession,
  input: { questionId: string; optionId?: string | null; flagged?: boolean },
): Promise<AnswerResult> {
  return db.$transaction(async (tx) => {
    const row = await tx.userAnswer.findUnique({
      where: { sessionId_questionId: { sessionId: s.id, questionId: input.questionId } },
      include: answerRowInclude,
    });
    if (!row) return { ok: false, status: 404, error: "Question not part of this session." } as const;

    const now = Date.now();
    const limit = row.question.timeLimitSec;
    const timedOut = !row.resolved && !!limit && now > row.servedAt.getTime() + limit * 1000 + TIMER_GRACE_MS;

    // Timed (speed) answers are final once recorded, so they cannot be revisited and reconsidered.
    if (row.resolved && limit && input.optionId !== undefined) {
      return { ok: false, status: 409, error: "Timed answers are final." } as const;
    }

    const data: Prisma.UserAnswerUncheckedUpdateInput = {};
    if (input.flagged !== undefined) data.flagged = input.flagged;

    let resolvedNow = false;
    let isCorrect: boolean | null = row.isCorrect;

    if (input.optionId !== undefined) {
      if (input.optionId !== null && !row.question.options.some((o) => o.id === input.optionId)) {
        return { ok: false, status: 400, error: "Invalid option." } as const;
      }
      const chosen = timedOut ? null : input.optionId; // late answers on timed items are discarded
      const cfg = reactionCfg(row.question);
      if (cfg && chosen) {
        // Reaction items: the right pad, pressed after it lit (no false start) and within the limit.
        const rt = now - row.servedAt.getTime() - reactionDelayMs(row.id, cfg.minMs, cfg.maxMs);
        isCorrect = chosen === row.question.options.find((o) => o.isCorrect)?.id && rt >= 0 && rt <= cfg.limitMs;
      } else {
        isCorrect = chosen ? !!row.question.options.find((o) => o.id === chosen)?.isCorrect : null;
      }
      data.optionId = chosen;
      data.isCorrect = isCorrect;
      if (!row.resolved && chosen) {
        resolvedNow = true;
        data.resolved = true;
        data.timeMs = Math.max(0, now - row.servedAt.getTime());
      } else if (!row.resolved && timedOut) {
        resolvedNow = true;
        data.resolved = true;
        data.timeMs = (limit as number) * 1000;
      }
    }

    // The first resolution is claimed atomically, so two concurrent requests move the staircase only once.
    let claimed = false;
    if (resolvedNow) {
      claimed = (await tx.userAnswer.updateMany({ where: { id: row.id, resolved: false }, data })).count === 1;
      if (!claimed) {
        const { resolved: _r, timeMs: _t, ...selectionOnly } = data;
        void _r; void _t;
        await tx.userAnswer.update({ where: { id: row.id }, data: selectionOnly });
      }
    } else {
      await tx.userAnswer.update({ where: { id: row.id }, data });
    }

    if (claimed) {
      const state = applyAnswer(parseState((await tx.assessmentSession.findUniqueOrThrow({ where: { id: s.id } })).adaptState), row.question.category.slug, isCorrect === true, rangeOf(s.assessment));
      await tx.assessmentSession.update({ where: { id: s.id }, data: { adaptState: JSON.stringify(state), lastSavedAt: new Date() } });
    } else {
      await tx.assessmentSession.update({ where: { id: s.id }, data: { lastSavedAt: new Date() } });
    }
    return { ok: true, resolved: row.resolved || resolvedNow, expired: timedOut || undefined } as const;
  });
}

/**
 * Advance past `fromQuestionId`. Idempotent: if the client is behind (the next question already exists)
 * the existing latest question is returned and nothing is skipped.
 */
export async function advance(s: OwnedSession, fromQuestionId: string) {
  // Two concurrent "next" calls can both try to create the same position; the loser hits the unique constraint
  // and simply re-reads, finding the question the winner already served.
  for (let attempt = 0; ; attempt++) {
    try {
      return await advanceOnce(s, fromQuestionId);
    } catch (e) {
      if (attempt < 3 && isUniqueViolation(e)) continue;
      throw e;
    }
  }
}

async function advanceOnce(s: OwnedSession, fromQuestionId: string) {
  return db.$transaction(async (tx) => {
    // Take the session's row lock first. On PostgreSQL concurrent "next" calls then run one after another, and each
    // re-reads the rows only after the previous one has committed, so exactly one new question is ever served
    // (SQLite serialises writers by itself). Without it, a transaction that waited could see the winner's question
    // and still serve a second one.
    await tx.assessmentSession.update({ where: { id: s.id }, data: { lastSavedAt: new Date() } });
    const rows = await tx.userAnswer.findMany({ where: { sessionId: s.id }, orderBy: { position: "asc" }, include: answerRowInclude });
    const latest = rows[rows.length - 1];
    if (!latest) return { question: null as PublicQuestion | null, total: s.assessment.questionCount };

    if (latest.questionId !== fromQuestionId) {
      return { question: await toPublic(tx, latest, true), total: s.assessment.questionCount };
    }

    if (!latest.resolved) {
      // Skipped: counts as incorrect for the staircase, stays unanswered for scoring.
      await tx.userAnswer.update({ where: { id: latest.id }, data: { resolved: true, timeMs: Date.now() - latest.servedAt.getTime() } });
      const cur = await tx.assessmentSession.findUniqueOrThrow({ where: { id: s.id } });
      const state = applyAnswer(parseState(cur.adaptState), latest.question.category.slug, false, rangeOf(s.assessment));
      await tx.assessmentSession.update({ where: { id: s.id }, data: { adaptState: JSON.stringify(state) } });
    }
    return { question: await serveNext(tx, s.id), total: s.assessment.questionCount };
  });
}

// ---------- finishing ----------

function reportCode() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `IQ-${d}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Idempotent. Scores are computed here from stored selections, never from client input. */
async function finalizeCore(sessionId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const s = await tx.assessmentSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: {
          assessment: true,
          result: true,
          answers: { include: { question: { include: { category: true, options: true } } } },
        },
      });
      if (s.result) return s.result;

      // Correctness comes from the stored selection, except reaction items whose correctness also depends on timing.
      const correctOf = (a: (typeof s.answers)[number]) =>
        !a.optionId ? null : a.question.kind === "reaction" ? a.isCorrect === true : !!a.question.options.find((o) => o.id === a.optionId)?.isCorrect;
      const items = s.answers.map((a) => ({ category: a.question.category.slug, difficulty: a.difficulty, correct: correctOf(a) }));
      const sc = score(items, s.assessment.questionCount);

      const now = new Date();
      let durationSec = Math.round((now.getTime() - s.startedAt.getTime()) / 1000);
      if (s.assessment.durationSec) durationSec = Math.min(durationSec, s.assessment.durationSec);

      const catRows = await tx.category.findMany({ where: { slug: { in: sc.categories.map((c) => c.category) } } });
      const idBySlug = new Map(catRows.map((c) => [c.slug, c.id]));

      const result = await tx.assessmentResult.create({
        data: {
          sessionId: s.id,
          userId: s.userId,
          reportCode: reportCode(),
          total: sc.total,
          correct: sc.correct,
          incorrect: sc.incorrect,
          unanswered: sc.unanswered,
          accuracy: sc.accuracy,
          performanceScore: sc.performance,
          scoringVersion: SCORING_VERSION,
          assessmentVersion: s.assessment.version,
          durationSec,
          categories: {
            create: sc.categories.map((c) => ({
              categoryId: idBySlug.get(c.category)!,
              total: c.total,
              correct: c.correct,
              performance: c.performance,
            })),
          },
        },
      });
      await tx.assessmentSession.update({ where: { id: s.id }, data: { status: "SUBMITTED", submittedAt: now } });
      for (const a of s.answers) {
        await tx.userAnswer.update({ where: { id: a.id }, data: { isCorrect: correctOf(a), resolved: true } });
      }
      return result;
    });
  } catch (e) {
    // Lost a race with a concurrent finalize: the unique constraint on result.sessionId fired.
    const existing = await db.assessmentResult.findUnique({ where: { sessionId } });
    if (existing) return existing;
    throw e;
  }
}

/** Finalizes (idempotent) and, for signed-in users, awards XP, streak and achievements exactly once. */
export async function finalize(sessionId: string) {
  const result = await finalizeCore(sessionId);
  if (result.userId) {
    try {
      await awardForResult(result.id);
    } catch (e) {
      console.error("[awards] failed:", e instanceof Error ? e.message : e);
    }
  }
  return result;
}

/** Finalizes the session if its overall time limit has passed. Returns the result id when it did. */
export async function expireIfDue(s: OwnedSession, graceMs = 0) {
  const dl = deadlineOf(s);
  if (s.status === "IN_PROGRESS" && dl && Date.now() > dl + graceMs) return (await finalize(s.id)).id;
  return null;
}

export { DEADLINE_GRACE_MS };
