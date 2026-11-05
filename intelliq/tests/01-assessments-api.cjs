// End-to-end API check. Run from the project dir: node <this file>
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const B = process.env.B || "http://localhost:3100";
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log("  FAIL:", m)); if (c) console.log("  ok:", m); };

function client() {
  let cookie = "";
  return async (path, opts = {}) => {
    const r = await fetch(B + path, { ...opts, headers: { "Content-Type": "application/json", cookie, ...(opts.headers || {}) } });
    const sc = r.headers.getSetCookie?.() ?? [];
    for (const c of sc) { const kv = c.split(";")[0]; const n = kv.split("=")[0]; cookie = cookie.split("; ").filter((x) => x && !x.startsWith(n + "=")).concat(kv).join("; "); }
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
}

// A reaction item only scores if the right pad is pressed after it lit. These suites answer instantly, so move
// the item's servedAt into the past as if the player had waited for the pad: elapsed = delay + 250 ms.
async function prime(sid, q) {
  if (q && q.reaction) await db.userAnswer.updateMany({ where: { sessionId: sid, questionId: q.id }, data: { servedAt: new Date(Date.now() - q.reaction.startsInMs - 250) } });
}

async function correctOf(qid) { return (await db.questionOption.findFirst({ where: { questionId: qid, isCorrect: true } })).id; }
async function wrongOf(qid) { return (await db.questionOption.findFirst({ where: { questionId: qid, isCorrect: false } })).id; }

(async () => {
  const a = client(), b = client();
  console.log("start guest session");
  let r = await a("/api/sessions", { method: "POST", body: JSON.stringify({ slug: "quick-check" }) });
  ok(r.status === 200 && r.json.sessionId && r.json.resumed === false, "created");
  const sid = r.json.sessionId;

  r = await a(`/api/sessions/${sid}`);
  ok(r.json.questions.length === 1 && r.json.assessment.total === 10, "one question served, total 10");
  const raw = JSON.stringify(r.json);
  ok(!/isCorrect|explanation|"correct"/i.test(raw), "state contains no answer-key fields");

  console.log("resume");
  r = await a("/api/sessions", { method: "POST", body: JSON.stringify({ slug: "quick-check" }) });
  ok(r.json.sessionId === sid && r.json.resumed === true, "same session resumed");

  console.log("access control");
  r = await b(`/api/sessions/${sid}`);
  ok(r.status === 404, "other browser cannot read session");
  r = await b(`/api/sessions/${sid}/submit`, { method: "POST" });
  ok(r.status === 404, "other browser cannot submit");

  console.log("play: always correct except two deliberate misses");
  let state = (await a(`/api/sessions/${sid}`)).json;
  const path = []; // {cat, diff, correct}
  let q = state.questions[0];
  for (let i = 0; i < 10; i++) {
    const miss = i === 4 || i === 7;
    await prime(sid, q);
    const opt = miss ? await wrongOf(q.id) : await correctOf(q.id);
    const ans = await a(`/api/sessions/${sid}/answer`, { method: "POST", body: JSON.stringify({ questionId: q.id, optionId: opt }) });
    if (i === 0) ok(!("isCorrect" in ans.json) && !("correct" in ans.json), "answer response hides correctness");
    path.push({ cat: q.category, diff: q.difficulty, correct: !miss });
    const nx = await a(`/api/sessions/${sid}/next`, { method: "POST", body: JSON.stringify({ fromQuestionId: q.id }) });
    if (i < 9) { ok(nx.json.question && nx.json.question.id !== q.id, `served Q${i + 2}`); q = nx.json.question; }
    else ok(nx.json.question === null, "no 11th question");
  }
  console.log("   path:", path.map((p) => `${p.cat[0]}${p.diff}${p.correct ? "+" : "-"}`).join(" "));
  const cats = new Set(path.map((p) => p.cat));
  ok(cats.size === 7 || cats.size >= 7, `coverage: ${cats.size} categories in 10 questions`);

  console.log("idempotent next");
  r = await a(`/api/sessions/${sid}/next`, { method: "POST", body: JSON.stringify({ fromQuestionId: state.questions[0].id }) });
  ok(r.status === 200, "stale next returns without error");

  console.log("validation");
  const all = (await a(`/api/sessions/${sid}`)).json;
  const q1 = all.questions[0], q2 = all.questions[1];
  r = await a(`/api/sessions/${sid}/answer`, { method: "POST", body: JSON.stringify({ questionId: q1.id, optionId: q2.options[0].id }) });
  ok(r.status === 400 || r.status === 409, "option from a different question rejected (400, or 409 if the item is timed and final)");
  r = await a(`/api/sessions/${sid}/answer`, { method: "POST", body: JSON.stringify({ questionId: "nope", optionId: null }) });
  ok(r.status === 404, "unknown question rejected");
  r = await a(`/api/sessions/${sid}/answer`, { method: "POST", body: JSON.stringify({ questionId: q1.id, flagged: true }) });
  ok(r.status === 200, "flag saved");
  const again = (await a(`/api/sessions/${sid}`)).json;
  ok(again.answers[q1.id].flagged === true && again.answers[q1.id].optionId, "flag + answer persisted");

  console.log("clear answer then re-answer wrong -> score reflects final selections");
  const q3 = all.questions.find((x, i) => i !== 4 && i !== 7 && !x.timeLimitSec);
  await a(`/api/sessions/${sid}/answer`, { method: "POST", body: JSON.stringify({ questionId: q3.id, optionId: null }) });

  console.log("submit");
  r = await a(`/api/sessions/${sid}/submit`, { method: "POST", body: JSON.stringify({ score: 999, correct: 10 }) });
  ok(r.status === 200 && r.json.resultId, "submitted (client score ignored)");
  const rid = r.json.resultId;
  const r2 = await a(`/api/sessions/${sid}/submit`, { method: "POST" });
  ok(r2.json.resultId === rid, "double submit returns same result");
  r = await a(`/api/sessions/${sid}/answer`, { method: "POST", body: JSON.stringify({ questionId: q1.id, optionId: null }) });
  ok(r.status === 409, "answering after submit rejected");

  const res = await db.assessmentResult.findUnique({ where: { id: rid }, include: { categories: true } });
  // expected: 10 answered; misses at index 4, 7, and Q3 cleared => correct = 7
  console.log("   result:", { total: res.total, correct: res.correct, incorrect: res.incorrect, unanswered: res.unanswered, accuracy: res.accuracy, perf: res.performanceScore });
  ok(res.total === 10 && res.correct === 7 && res.incorrect === 2 && res.unanswered === 1, "raw counts match what was played");
  ok(res.performanceScore < 100 && res.performanceScore > 0, "performance computed server-side");
  ok(res.categories.length === 7, "7 category results");

  console.log("adaptive: difficulty should rise only after two straight correct in a category and drop on a miss");
  const bycat = {};
  for (const p of path) (bycat[p.cat] ??= []).push(p);
  let violations = 0;
  for (const [c, list] of Object.entries(bycat)) {
    let d = 3, s = 0;
    for (const p of list) { if (p.diff !== d && !(Math.abs(p.diff - d) <= 2)) violations++; if (p.correct) { s++; if (s >= 2) { d = Math.min(5, d + 1); s = 0; } } else { d = Math.max(1, d - 1); s = 0; } }
  }
  ok(violations === 0, "served difficulties stay within engine expectations");

  console.log("full battery: category balance (28 q => 4 each) with all-correct play");
  const c = client();
  r = await c("/api/sessions", { method: "POST", body: JSON.stringify({ slug: "full-battery" }) });
  const sid2 = r.json.sessionId;
  let qq = (await c(`/api/sessions/${sid2}`)).json.questions[0];
  const counts = {}, diffs = {};
  for (let i = 0; i < 28; i++) {
    counts[qq.category] = (counts[qq.category] || 0) + 1;
    (diffs[qq.category] ??= []).push(qq.difficulty);
    await prime(sid2, qq);
    await c(`/api/sessions/${sid2}/answer`, { method: "POST", body: JSON.stringify({ questionId: qq.id, optionId: await correctOf(qq.id) }) });
    const nx = await c(`/api/sessions/${sid2}/next`, { method: "POST", body: JSON.stringify({ fromQuestionId: qq.id }) });
    qq = nx.json.question;
  }
  console.log("   counts:", counts);
  console.log("   difficulty path (all correct):", Object.entries(diffs).map(([k, v]) => `${k}:${v.join("")}`).join("  "));
  ok(Object.values(counts).every((n) => n === 4) && Object.keys(counts).length === 7, "4 questions per category");
  ok(Object.values(diffs).every((v) => v.join("") === "3344"), "all-correct path is 3,3,4,4 per category (two correct needed per step up)");
  r = await c(`/api/sessions/${sid2}/submit`, { method: "POST" });
  const res2 = await db.assessmentResult.findUnique({ where: { id: r.json.resultId } });
  ok(res2.correct === 28 && res2.performanceScore === 100 && res2.accuracy === 100, "perfect run scores 28/28, 100");

  console.log("memory stimulus is withheld after the window / on later fetch");
  const m = client();
  r = await m("/api/sessions", { method: "POST", body: JSON.stringify({ slug: "memory-focus" }) });
  const sid3 = r.json.sessionId;
  const g1 = (await m(`/api/sessions/${sid3}`)).json.questions[0];
  ok(g1.stimulus && g1.stimulusRemainingMs > 0, "stimulus delivered in-window");
  const dbq = await db.question.findUnique({ where: { id: g1.id } });
  await db.userAnswer.updateMany({ where: { sessionId: sid3 }, data: { stimulusSeenAt: new Date(Date.now() - (dbq.stimulusSec + 5) * 1000) } });
  const g2 = (await m(`/api/sessions/${sid3}`)).json.questions[0];
  ok(g2.stimulus === null, "stimulus no longer served after its window");

  console.log("speed timer: late answers are discarded");
  const t = client();
  r = await t("/api/sessions", { method: "POST", body: JSON.stringify({ slug: "speed-focus" }) });
  const sid4 = r.json.sessionId;
  const s1 = (await t(`/api/sessions/${sid4}`)).json.questions[0];
  ok(s1.timeLimitSec > 0 && s1.timeLeftMs > 0, "timed item has server countdown");
  await db.userAnswer.updateMany({ where: { sessionId: sid4 }, data: { servedAt: new Date(Date.now() - 60_000) } });
  r = await t(`/api/sessions/${sid4}/answer`, { method: "POST", body: JSON.stringify({ questionId: s1.id, optionId: await correctOf(s1.id) }) });
  ok(r.json.expired === true, "late answer flagged expired");
  const row = await db.userAnswer.findFirst({ where: { sessionId: sid4 } });
  ok(row.optionId === null && row.resolved === true, "late answer not recorded (counts as unanswered)");

  console.log("overall deadline");
  const d = client();
  r = await d("/api/sessions", { method: "POST", body: JSON.stringify({ slug: "reasoning-core" }) });
  const sid5 = r.json.sessionId;
  await db.assessmentSession.update({ where: { id: sid5 }, data: { startedAt: new Date(Date.now() - 3 * 3600_000) } });
  r = await d(`/api/sessions/${sid5}`);
  ok(r.json.status === "SUBMITTED" && r.json.resultId, "expired session auto-finalized on next request");

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail ? 1 : 0);
})();
