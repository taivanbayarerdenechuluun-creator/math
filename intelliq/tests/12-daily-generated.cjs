// The daily challenge is generated per date (src/lib/daily-gen.ts). This suite checks the whole path against a
// running server: lazy creation under a race, storage, what the API exposes, scoring, recovery and the fallback.
// (The generator's own answers are verified by independent solvers in src/lib/daily-gen.test.ts.)
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const L = require("./lib.cjs");
const { db, ok, client, post, register, done, opt } = L;

const root = path.join(__dirname, "..");
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const runTsx = (args) => spawnSync(process.execPath, [tsx, ...args], { cwd: root, encoding: "utf8" });
const today = new Date().toISOString().slice(0, 10);
const SLOTS = ["logical", "numerical", "abstract", "memory", "speed"];

async function adminClient(name = "Daily Admin") {
  const c = client();
  const email = await register(c, name);
  const role = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN" } });
  await db.user.update({ where: { email }, data: { roleId: role.id } });
  return c;
}

const clearToday = async () => {
  await db.dailyChallenge.deleteMany({ where: { date: today } }); // attempts cascade
  await db.question.deleteMany({ where: { bankKey: { startsWith: `daily:${today}:` } } }); // options cascade
};

(async () => {
  console.log("first requests of the day race to create it");
  await clearToday();
  const racers = Array.from({ length: 6 }, () => client());
  const rs = await Promise.all(racers.map((c) => c("/api/daily")));
  ok(rs.every((r) => r.status === 200 && r.json.questions.length === 5), "6 parallel first requests all succeed with 5 questions");
  const idsOf = (r) => r.json.questions.map((q) => q.id).join();
  ok(new Set(rs.map(idsOf)).size === 1, "every request sees the same five questions");
  ok((await db.dailyChallenge.count({ where: { date: today } })) === 1, "exactly one challenge row exists for today");
  const stored = await db.question.findMany({ where: { bankKey: { startsWith: `daily:${today}:` } }, include: { options: true, category: true } });
  ok(stored.length === 5, `exactly five daily questions stored, no duplicates from the race (${stored.length})`);
  ok(stored.every((q) => q.origin === "daily" && q.active === false), "stored as origin 'daily' and inactive, so assessments never serve them");
  ok(stored.every((q) => q.options.length === 4 && q.options.filter((o) => o.isCorrect).length === 1 && new Set(q.options.map((o) => o.position)).size === 4), "each has four positioned options and exactly one correct");
  ok(stored.every((q) => q.promptMn && q.explanationMn && q.explanation), "English and Mongolian prompt and explanation are stored");
  ok(JSON.stringify(rs[0].json.questions.map((q) => q.category)) === JSON.stringify(SLOTS), "served in slot order: logic, numbers, pattern, memory, speed");

  console.log("what the API exposes");
  const first = rs[0];
  ok(!/isCorrect|explanation|correctOptionId/.test(first.text), "the payload contains no answers or explanations");
  ok(first.json.questions.every((q) => q.promptMn && q.options.length === 4), "Mongolian prompts and four options are served");
  const mem = first.json.questions.find((q) => q.category === "memory");
  ok(mem.stimulus && mem.stimulusSec >= 4, "the memory question carries its stimulus and viewing time");
  ok(first.json.questions.find((q) => q.category === "abstract").stem.k === "seq", "the pattern question carries its figure sequence");
  ok(first.json.questions.find((q) => q.category === "speed").timeLimitSec >= 10, "the speed question is timed");
  ok(first.json.questions.every((q) => !q.stem || q.stem.k !== "reaction"), "no reaction item is ever part of the daily challenge");

  console.log("the stored questions are what the generator produces for the date");
  const gen = JSON.parse(runTsx(["tests/daily-print.ts", today]).stdout);
  let same = gen.length === 5;
  for (const g of gen) {
    const row = stored.find((s) => s.bankKey === `daily:${today}:${g.slot}`);
    const right = row?.options.find((o) => o.isCorrect);
    const wantRight = g.q.right.label ?? JSON.stringify(g.q.right.fig);
    same &&= !!row && row.prompt === g.q.prompt && row.promptMn === g.q.mn.prompt && row.category.slug === g.q.cat
      && (right.label || right.figure) === wantRight && row.explanation === g.q.explanation;
  }
  ok(same, "prompt, Mongolian prompt, category, correct option and explanation all match the generator");

  console.log("playing it");
  const solver = client();
  await register(solver, "Daily Solver");
  const q = (await solver("/api/daily")).json.questions;
  const right = Object.fromEntries(await Promise.all(q.map(async (x) => [x.id, (await opt(x.id, true)).id])));
  const wrong = Object.fromEntries(await Promise.all(q.map(async (x) => [x.id, (await opt(x.id, false)).id])));
  const mixed = { ...wrong, [q[0].id]: right[q[0].id], [q[3].id]: right[q[3].id] };
  const loser = client();
  await register(loser, "Daily Loser");
  let res = await post(loser, "/api/daily", { answers: mixed });
  ok(res.status === 200 && res.json.correct === 2 && res.json.total === 5, `two right answers score 2/5 (${res.json.correct})`);
  ok(res.json.review.filter((x) => x.correct).length === 2 && res.json.review.every((x) => x.explanation && x.explanationMn), "review marks exactly those two and carries both explanations");
  res = await post(solver, "/api/daily", { answers: right });
  ok(res.status === 200 && res.json.correct === 5 && res.json.xp === 40, `all five right score 5/5 and 40 XP (${res.json.correct}, ${res.json.xp})`);
  ok(res.json.review.every((x) => x.correct && x.correctOptionId === right[x.questionId]), "the review's correct option is the one the database marks");
  res = await post(solver, "/api/daily", { answers: right });
  ok(res.status === 409, "a second attempt the same day is rejected");
  ok((await solver("/daily")).status === 200, "the /daily page renders");

  console.log("recovery: the challenge row is lost but its questions exist");
  const before = (await db.dailyChallenge.findUnique({ where: { date: today } })).questionIds;
  await db.dailyChallenge.delete({ where: { date: today } });
  const after = await client()("/api/daily");
  ok(after.status === 200 && after.json.questions.map((x) => x.id).join() === before, "the same five questions are linked again");
  ok((await db.question.count({ where: { bankKey: { startsWith: `daily:${today}:` } } })) === 5, "no extra questions were created");

  console.log("admin can inspect them");
  const admin = await adminClient();
  const page = await admin("/admin/questions?o=daily");
  const seqPrompt = stored.find((s) => s.category.slug === "numerical").prompt;
  ok(page.status === 200 && page.text.includes(seqPrompt.split("  ")[1].replace(", ?", "")), "the admin list for origin=daily shows today's number sequence");
  const normal = await admin("/admin/questions");
  ok(!normal.text.includes(seqPrompt.split("  ")[1].replace(", ?", "")), "the default admin list does not mix daily questions in");

  console.log("fallback to the question bank if generation fails");
  const fb = runTsx(["--conditions=react-server", "tests/daily-fallback.ts"]);
  let fbJson = null;
  try { fbJson = JSON.parse(fb.stdout.trim().split("\n").pop()); } catch {}
  ok(fbJson && fbJson.days === 40 && fbJson.slotsOk, `40 failing days each fall back to five questions in slot order (${fb.stdout.trim().slice(0, 200)}${fb.stderr.includes("generation failed") ? "" : " / no log"})`);
  ok(fbJson && fbJson.reaction === 0, "the fallback never picks a reaction item");
  ok(fbJson && fbJson.inactive === 0 && fbJson.repeatable, "the fallback uses active questions and the stored day is reused afterwards");

  console.log("cleanup");
  await clearToday();
  await db.challengeAttempt.deleteMany({ where: { user: { name: { in: ["Daily Solver", "Daily Loser"] } } } });
  await db.user.deleteMany({ where: { name: { in: ["Daily Solver", "Daily Loser", "Daily Admin"] } } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
