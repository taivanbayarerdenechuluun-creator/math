import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit } from "./guard";
import { questionSchema, type QuestionInput } from "./admin-schemas";

type Tx = Prisma.TransactionClient;
export type Result<T = object> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const fail = (status: number, error: string) => ({ ok: false, status, error }) as const;

const LOCKED_MSG =
  "This question already has answers on record. Only the prompt, explanation, difficulty, active state and option wording can change. To change the answer key or figures, deactivate it and create a new question.";

const j = (v: unknown) => JSON.stringify(v ?? null);

/** Whether the question has ever been served (answers) or used in a daily challenge. */
async function isInUse(tx: Tx, id: string) {
  return (await tx.userAnswer.count({ where: { questionId: id } })) + (await tx.dailyChallenge.count({ where: { questionIds: { contains: id } } })) > 0;
}

const kindOf = (q: QuestionInput) => (q.figure?.k === "reaction" ? "reaction" : q.figure ? "figure" : q.imageUrl ? "image" : "text");

export async function createQuestion(input: QuestionInput, actorId: string): Promise<Result<{ id: string }>> {
  const cat = await db.category.findUnique({ where: { slug: input.categorySlug } });
  if (!cat) return fail(400, "Unknown category.");
  const q = await db.question.create({
    data: {
      categoryId: cat.id, prompt: input.prompt, kind: kindOf(input), figure: input.figure ? j(input.figure) : null, assetUrl: input.imageUrl,
      stimulus: input.stimulus ? j(input.stimulus) : null, stimulusSec: input.stimulusSec, timeLimitSec: input.timeLimitSec,
      difficulty: input.difficulty, explanation: input.explanation, active: input.active,
      promptMn: input.promptMn, explanationMn: input.explanationMn, stimulusMn: input.stimulusMn, origin: "admin",
      options: { create: input.options.map((o, position) => ({ label: o.label, labelMn: o.labelMn ?? null, figure: o.figure ? j(o.figure) : null, isCorrect: o.isCorrect, position })) },
    },
  });
  await audit(actorId, "question.create", q.id, { category: input.categorySlug, difficulty: input.difficulty });
  return { ok: true, id: q.id };
}

export async function snapshotOf(tx: Tx, id: string) {
  const q = await tx.question.findUniqueOrThrow({ where: { id }, include: { category: true, options: { orderBy: { position: "asc" } } } });
  return {
    version: q.version,
    snapshot: {
      categorySlug: q.category.slug, prompt: q.prompt, difficulty: q.difficulty, explanation: q.explanation, timeLimitSec: q.timeLimitSec,
      promptMn: q.promptMn, explanationMn: q.explanationMn, stimulusMn: q.stimulusMn,
      stimulus: q.stimulus ? JSON.parse(q.stimulus) : null, stimulusSec: q.stimulusSec, figure: q.figure ? JSON.parse(q.figure) : null,
      imageUrl: q.assetUrl, active: q.active,
      options: q.options.map((o) => ({ id: o.id, label: o.label, labelMn: o.labelMn, figure: o.figure ? JSON.parse(o.figure) : null, isCorrect: o.isCorrect })),
    },
  };
}

export async function updateQuestion(id: string, input: QuestionInput, actorId: string, action = "question.update"): Promise<Result<{ version: number }>> {
  return db.$transaction(async (tx) => {
    const cur = await tx.question.findUnique({ where: { id }, include: { category: true, options: { orderBy: { position: "asc" } } } });
    if (!cur) return fail(404, "Question not found.");
    const cat = await tx.category.findUnique({ where: { slug: input.categorySlug } });
    if (!cat) return fail(400, "Unknown category.");

    const inUse = await isInUse(tx, id);
    if (inUse) {
      const same =
        cur.categoryId === cat.id &&
        j(cur.figure ? JSON.parse(cur.figure) : null) === j(input.figure) &&
        j(cur.stimulus ? JSON.parse(cur.stimulus) : null) === j(input.stimulus) &&
        cur.stimulusSec === input.stimulusSec && cur.timeLimitSec === input.timeLimitSec && cur.assetUrl === input.imageUrl &&
        input.options.length === cur.options.length &&
        cur.options.every((o) => {
          const n = input.options.find((x) => x.id === o.id);
          return !!n && n.isCorrect === o.isCorrect && j(n.figure) === j(o.figure ? JSON.parse(o.figure) : null);
        });
      if (!same) return fail(409, LOCKED_MSG);
    }

    const { version, snapshot } = await snapshotOf(tx, id);
    await tx.questionVersion.create({ data: { questionId: id, version, snapshot: JSON.stringify(snapshot), authorId: actorId } });

    await tx.question.update({
      where: { id },
      data: {
        categoryId: cat.id, prompt: input.prompt, kind: kindOf(input), figure: input.figure ? j(input.figure) : null, assetUrl: input.imageUrl,
        stimulus: input.stimulus ? j(input.stimulus) : null, stimulusSec: input.stimulusSec, timeLimitSec: input.timeLimitSec,
        difficulty: input.difficulty, explanation: input.explanation, active: input.active, version: version + 1,
        promptMn: input.promptMn, explanationMn: input.explanationMn, stimulusMn: input.stimulusMn,
      },
    });

    if (inUse) {
      for (const o of cur.options) {
        const n = input.options.find((x) => x.id === o.id)!;
        await tx.questionOption.update({ where: { id: o.id }, data: { label: n.label, labelMn: n.labelMn ?? null } });
      }
    } else {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      await tx.questionOption.createMany({ data: input.options.map((o, position) => ({ questionId: id, label: o.label, labelMn: o.labelMn ?? null, figure: o.figure ? j(o.figure) : null, isCorrect: o.isCorrect, position })) });
    }
    await tx.auditLog.create({ data: { actorId, action, target: id, meta: JSON.stringify({ fromVersion: version, toVersion: version + 1 }) } });
    return { ok: true, version: version + 1 } as const;
  });
}

export async function restoreVersion(id: string, version: number, actorId: string): Promise<Result<{ version: number }>> {
  const v = await db.questionVersion.findUnique({ where: { questionId_version: { questionId: id, version } } });
  if (!v) return fail(404, "Version not found.");
  const parsed = questionSchema.safeParse(JSON.parse(v.snapshot));
  if (!parsed.success) return fail(422, "That version no longer passes validation: " + parsed.error.issues[0].message);
  return updateQuestion(id, parsed.data, actorId, `question.restore.v${version}`);
}

/** Questions that have been used are retired (deactivated) instead of deleted so history stays intact. */
export async function deleteQuestion(id: string, actorId: string): Promise<Result<{ retired: boolean }>> {
  return db.$transaction(async (tx) => {
    const q = await tx.question.findUnique({ where: { id } });
    if (!q) return fail(404, "Question not found.");
    if (await isInUse(tx, id)) {
      await tx.question.update({ where: { id }, data: { active: false } });
      await tx.auditLog.create({ data: { actorId, action: "question.retire", target: id } });
      return { ok: true, retired: true } as const;
    }
    await tx.question.delete({ where: { id } });
    await tx.auditLog.create({ data: { actorId, action: "question.delete", target: id } });
    return { ok: true, retired: false } as const;
  });
}
