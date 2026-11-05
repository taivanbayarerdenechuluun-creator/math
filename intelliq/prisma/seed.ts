import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ASSESSMENTS, BANK, CATEGORIES } from "../src/data/bank";
import { questionRow } from "../src/data/bank/build";

const db = new PrismaClient();

/**
 * Idempotent and safe to run on every deploy:
 *  - roles, categories and assessments are created if missing; EXISTING assessments are never overwritten
 *    (administrators may have edited them);
 *  - every bank question has a stable bankKey. Rows seeded by earlier versions (no key) are matched by content and
 *    given their key; missing questions are created; Mongolian text is filled in ONLY where it is still empty, so
 *    edits made in the admin panel are never clobbered.
 *  - the bank has ~1000 questions, so existing rows are read once and missing ones are inserted in bulk (a chunk of
 *    questions and their options is one atomic batch). One query per question would take minutes against a database
 *    in another region.
 */
async function main() {
  for (const name of ["USER", "ADMIN"]) {
    await db.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  const cats = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await db.category.upsert({ where: { slug: c.slug }, update: c, create: c });
    cats.set(c.slug, row.id);
  }

  for (const a of ASSESSMENTS) {
    await db.assessment.upsert({ where: { slug: a.slug }, update: {}, create: a });
  }

  // Index questions seeded before bankKey existed, by their content.
  const legacy = await db.question.findMany({ where: { bankKey: null, origin: "bank" }, include: { category: true, options: true } });
  const sig = (cat: string, prompt: string, figure: string | null, stimulus: string | null, rightLabel: string, rightFigure: string | null) =>
    [cat, prompt, figure ?? "", stimulus ?? "", rightLabel, rightFigure ?? ""].join("\u0001");
  const legacyBySig = new Map(
    legacy.map((q) => {
      const r = q.options.find((o) => o.isCorrect)!;
      return [sig(q.category.slug, q.prompt, q.figure, q.stimulus, r.label, r.figure), q] as const;
    }),
  );

  // Everything that already carries a bank key, read once.
  const existing = new Map(
    (await db.question.findMany({ where: { bankKey: { not: null } }, include: { options: true } })).map((r) => [r.bankKey!, r] as const),
  );

  let created = 0, keyed = 0, translated = 0;
  const missing: { id: string; q: (typeof BANK)[number]; fields: ReturnType<typeof questionRow> }[] = [];
  for (const [i, q] of BANK.entries()) {
    const built = questionRow(q, i);
    const { options: optionRows, ...fields } = built;
    const right = optionRows.find((o) => o.isCorrect)!;

    let row = existing.get(q.key!);
    if (!row) {
      const old = legacyBySig.get(sig(q.cat, q.prompt, fields.figure, fields.stimulus, right.label, right.figure));
      if (old) {
        row = await db.question.update({ where: { id: old.id }, data: { bankKey: q.key! }, include: { options: true } });
        keyed++;
      }
    }

    if (!row) {
      missing.push({ id: randomUUID(), q, fields: built });
      continue;
    }

    // Fill only what is still empty.
    const fill: { promptMn?: string; explanationMn?: string; stimulusMn?: string } = {};
    if (!row.promptMn && q.mn?.prompt) fill.promptMn = q.mn.prompt;
    if (!row.explanationMn && q.mn?.explanation) fill.explanationMn = q.mn.explanation;
    if (!row.stimulusMn && q.mn?.stimulus) fill.stimulusMn = q.mn.stimulus;
    let touched = Object.keys(fill).length > 0;
    if (touched) await db.question.update({ where: { id: row.id }, data: fill });
    for (const o of optionRows) {
      if (!o.labelMn) continue;
      const existing = row.options.find((x) => x.label === o.label && (x.figure ?? null) === (o.figure ?? null));
      if (existing && !existing.labelMn) {
        await db.questionOption.update({ where: { id: existing.id }, data: { labelMn: o.labelMn } });
        touched = true;
      }
    }
    if (touched) translated++;
  }

  // Insert the missing questions: per chunk, one batch of two bulk inserts (all or nothing).
  const CHUNK = 100;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const part = missing.slice(i, i + CHUNK);
    await db.$transaction([
      db.question.createMany({
        data: part.map(({ id, q, fields }) => {
          const { options: _options, ...rest } = fields;
          void _options;
          return { id, bankKey: q.key!, origin: "bank", categoryId: cats.get(q.cat)!, ...rest };
        }),
      }),
      db.questionOption.createMany({ data: part.flatMap(({ id, fields }) => fields.options.map((o) => ({ ...o, questionId: id }))) }),
    ]);
    created += part.length;
  }

  const total = await db.question.count();
  console.log(`Questions: ${created} created, ${keyed} matched to bank keys, ${translated} gained Mongolian text; ${total} total. ${CATEGORIES.length} categories, ${ASSESSMENTS.length} assessments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
