import "server-only";
import { db, isUniqueViolation } from "./db";
import { questionRow } from "../data/bank/build";
import { rng, shuffle } from "../data/bank/types";
import { DAILY_SLOTS, generateDaily, hashStr, type Generated } from "./daily-gen";

/**
 * Stores the generated questions of a day and returns their ids in slot order. The unique key makes this idempotent
 * and safe under concurrency: a request that loses the race for a slot reuses the row the winner created.
 * Daily questions are inactive, so they never enter the adaptive assessments.
 */
async function storeGenerated(day: string, items: Generated[]): Promise<string[]> {
  const cats = new Map((await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  const ids: string[] = [];
  for (const { slot, q } of items) {
    const bankKey = `daily:${day}:${slot}`;
    let row = await db.question.findUnique({ where: { bankKey }, select: { id: true } });
    if (!row) {
      const { options, ...fields } = questionRow(q, hashStr(bankKey) % 100000);
      try {
        row = await db.question.create({
          data: { bankKey, origin: "daily", active: false, categoryId: cats.get(q.cat)!, ...fields, options: { create: options } },
          select: { id: true },
        });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        row = await db.question.findUniqueOrThrow({ where: { bankKey }, select: { id: true } });
      }
    }
    ids.push(row.id);
  }
  return ids;
}

/** Fallback if generation ever fails: one bank question per slot (never a reaction item, which needs a live pad). */
async function pickFromBank(day: string): Promise<string[]> {
  const rand = rng(hashStr(`intelliq-daily-${day}`));
  const picked: string[] = [];
  for (const slug of DAILY_SLOTS) {
    const pool = await db.question.findMany({
      where: { active: true, kind: { not: "reaction" }, category: { slug }, difficulty: { gte: 2, lte: 4 } },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (pool.length) picked.push(shuffle(pool, rand)[0].id);
  }
  return picked;
}

/**
 * Deterministic per day: everyone gets the same five questions, freshly generated for that date (see daily-gen.ts)
 * and created lazily on the first request.
 */
export async function getOrCreateChallenge(day: string, generate: (day: string) => Generated[] = generateDaily) {
  const existing = await db.dailyChallenge.findUnique({ where: { date: day } });
  if (existing) return existing;

  let ids: string[];
  try {
    ids = await storeGenerated(day, generate(day));
  } catch (e) {
    console.error("[daily] generation failed, falling back to the question bank:", e);
    ids = await pickFromBank(day);
  }
  try {
    return await db.dailyChallenge.create({ data: { date: day, questionIds: ids.join(",") } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return db.dailyChallenge.findUniqueOrThrow({ where: { date: day } }); // concurrent creation
  }
}

const parse = (s: string | null) => (s ? JSON.parse(s) : null);

/** Public payload: never includes correctness or explanations. */
export async function publicQuestions(questionIds: string) {
  const ids = questionIds.split(",").filter(Boolean);
  const rows = await db.question.findMany({ where: { id: { in: ids } }, include: { category: { select: { slug: true } }, options: { orderBy: { position: "asc" } } } });
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => ({
      id: q.id,
      category: q.category.slug,
      difficulty: q.difficulty,
      prompt: q.prompt,
      promptMn: q.promptMn,
      stem: parse(q.figure),
      imageUrl: q.assetUrl,
      stimulus: parse(q.stimulus),
      stimulusMn: q.stimulusMn,
      stimulusSec: q.stimulusSec,
      timeLimitSec: q.timeLimitSec,
      options: q.options.map((o) => ({ id: o.id, label: o.label, labelMn: o.labelMn, figure: parse(o.figure) })),
    }));
}
