// Exercises the question-bank fallback of getOrCreateChallenge by injecting a generator that fails.
// Run with `tsx --conditions=react-server` (daily.ts is a server-only module). Prints one JSON line.
import { getOrCreateChallenge } from "../src/lib/daily";
import { db } from "../src/lib/db";

const days = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2098, 0, 1 + i)).toISOString().slice(0, 10));

async function main() {
  await db.dailyChallenge.deleteMany({ where: { date: { in: days } } });
  const kinds: string[] = [], inactive: string[] = [];
  let slotsOk = true, repeatable = true;
  for (const day of days) {
    const c = await getOrCreateChallenge(day, () => { throw new Error("generator unavailable"); });
    const ids = c.questionIds.split(",");
    const rows = await db.question.findMany({ where: { id: { in: ids } }, include: { category: true } });
    const ordered = ids.map((id) => rows.find((r) => r.id === id)!);
    slotsOk &&= ids.length === 5 && ["logical", "numerical", "abstract", "memory", "speed"].every((s, i) => ordered[i].category.slug === s);
    kinds.push(...ordered.map((r) => r.kind));
    inactive.push(...ordered.filter((r) => !r.active).map((r) => r.id));
    const again = await getOrCreateChallenge(day, () => { throw new Error("must not run: the day is already stored"); });
    repeatable &&= again.id === c.id && again.questionIds === c.questionIds;
  }
  console.log(JSON.stringify({ days: days.length, slotsOk, reaction: kinds.filter((k) => k === "reaction").length, inactive: inactive.length, repeatable }));
  await db.dailyChallenge.deleteMany({ where: { date: { in: days } } });
}

main().finally(() => db.$disconnect());
