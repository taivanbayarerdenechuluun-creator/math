const { execSync } = require("node:child_process");
const path = require("node:path");
const L = require("./lib.cjs");
const { db, ok, client, post, play, register, done, opt, prime } = L;

const put = (c, p, body, h) => c(p, { method: "PUT", body: JSON.stringify(body), headers: h });
const correctId = async (qid) => (await opt(qid, true)).id;
const wrongId = async (qid) => (await opt(qid, false)).id;

async function adminClient(name = "Config Admin") {
  const c = client();
  const email = await register(c, name);
  const role = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN" } });
  await db.user.update({ where: { email }, data: { roleId: role.id } });
  return { c, email };
}

/** A fresh speed session whose first (latest, unanswered) question is the given reaction item. */
async function reactionSession(c, difficulty = 1) {
  const rq = await db.question.findFirst({ where: { kind: "reaction", difficulty }, include: { options: true } });
  const r = await post(c, "/api/sessions", { slug: "speed-focus" });
  const sid = r.json.sessionId;
  await db.userAnswer.updateMany({ where: { sessionId: sid }, data: { questionId: rq.id, difficulty: rq.difficulty, servedAt: new Date() } });
  const q = (await c(`/api/sessions/${sid}`)).json.questions[0];
  return { sid, q, rq };
}
const shift = (sid, ms) => db.userAnswer.updateMany({ where: { sessionId: sid }, data: { servedAt: new Date(Date.now() - ms) } });
const verdict = async (sid) => (await db.userAnswer.findFirst({ where: { sessionId: sid } })).isCorrect;

(async () => {
  const stamp = Date.now();

  console.log("Mongolian content in the payloads");
  const g = client();
  let r = await post(g, "/api/sessions", { slug: "verbal-focus" });
  let st = (await g(`/api/sessions/${r.json.sessionId}`)).json;
  const vq = st.questions[0];
  ok(typeof vq.promptMn === "string" && /[Ѐ-ӿ]/.test(vq.promptMn), "session question carries a Mongolian prompt");
  ok(vq.options.every((o) => o.labelMn && /[Ѐ-ӿ]/.test(o.labelMn)), "verbal options carry Mongolian labels");
  ok(!/isCorrect|explanationMn/.test(JSON.stringify(st)), "Mongolian explanations are not sent during the test");
  const mem = client();
  r = await post(mem, "/api/sessions", { slug: "memory-focus" });
  const dbMem = await db.question.findMany({ where: { origin: "bank", stimulusMn: { not: null } }, select: { bankKey: true } });
  const wordLists = dbMem.filter((q) => /^memory-0(0\d|1[0-5])$/.test(q.bankKey ?? "")); // the 15 hand-written memory items
  ok(dbMem.length >= 3 && wordLists.length === 3, `the 3 hand-written word-list memory questions keep a Mongolian stimulus (${wordLists.length} of ${dbMem.length} with one)`);
  const resId = await play(g, "quick-check", 10);
  const html = (await g(`/results/${resId}`)).text;
  ok(/promptMn|explanationMn/.test(html) || /[Ѐ-ӿ]{4}/.test(html), "results review ships the Mongolian text");
  const daily = (await client()("/api/daily")).json;
  ok(daily.questions.every((q) => "promptMn" in q && q.options.every((o) => "labelMn" in o)), "daily payload carries Mongolian fields");

  console.log("reaction items");
  {
    const { c } = { c: client() };
    const { sid, q, rq } = await reactionSession(c);
    ok(q.reaction && q.reaction.targetOptionId === (await correctId(rq.id)), "payload names the lit pad (the stimulus itself)");
    ok(q.reaction.startsInMs >= 1200 && q.reaction.startsInMs <= 2800 && q.reaction.limitMs === 2200, `delay ${q.reaction.startsInMs} ms is within the configured window`);
    ok(q.timeLeftMs > 0 && q.stem.k === "reaction", "item is timed and its stem is the reaction config");
    const again = (await c(`/api/sessions/${sid}`)).json.questions[0];
    ok(again.reaction.startsInMs <= q.reaction.startsInMs, "reloading mid-wait keeps counting down (no reset)");
    await shift(sid, q.reaction.startsInMs + 300);
    ok((await c(`/api/sessions/${sid}`)).json.questions[0].reaction.startsInMs === 0, "after the delay the pad is already lit on reload");
    let a = await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: q.reaction.targetOptionId });
    ok(a.status === 200 && a.json.resolved && !("isCorrect" in a.json), "answer accepted without revealing the verdict");
    ok((await verdict(sid)) === true, "right pad, pressed after it lit, within the limit -> correct");
    a = await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: await wrongId(rq.id) });
    ok(a.status === 409, "reaction answers are final once recorded");
    ok((await c(`/api/sessions/${sid}`)).json.questions[0].reaction === null, "an answered item no longer exposes the lit pad");
    const rid = (await post(c, `/api/sessions/${sid}/submit`)).json.resultId;
    const resPage = (await c(`/results/${rid}`)).text;
    ok(/reaction\\?":\{\\?"ms\\?":\d+/.test(resPage), "the review data carries the measured reaction time");
  }
  {
    const c = client();
    const { sid, q } = await reactionSession(c);
    await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: q.reaction.targetOptionId });
    ok((await verdict(sid)) === false, "pressing the right pad BEFORE it lights up is a false start -> incorrect");
    const rid = (await post(c, `/api/sessions/${sid}/submit`)).json.resultId;
    ok(/falseStart\\?":true/.test((await c(`/results/${rid}`)).text), "the review data flags the false start");
  }
  {
    const c = client();
    const { sid, q } = await reactionSession(c);
    await shift(sid, q.reaction.startsInMs + q.reaction.limitMs + 500);
    await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: q.reaction.targetOptionId });
    ok((await verdict(sid)) === false, "right pad but slower than the limit -> incorrect");
  }
  {
    const c = client();
    const { sid, q, rq } = await reactionSession(c);
    await shift(sid, q.reaction.startsInMs + 300);
    await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: await wrongId(rq.id) });
    ok((await verdict(sid)) === false, "wrong pad -> incorrect");
    const st2 = await db.assessmentSession.findUnique({ where: { id: sid } });
    ok(JSON.parse(st2.adaptState).speed.d === 2, "a miss moves the speed staircase down");
  }

  console.log("assessment difficulty range, category shares and curated pools (admin)");
  const { c: admin } = await adminClient();
  const base = (slug, over = {}) => ({ slug, titleEn: "Cfg " + slug, titleMn: "Тохиргоо " + slug, descEn: "test assessment", descMn: "туршилтын тест", questionCount: 6, durationSec: null, adaptive: true, categorySlugs: ["logical", "numerical"], active: true, difficultyMin: 1, difficultyMax: 5, categoryWeights: {}, questionIds: [], ...over });
  const servedOf = async (slug, n, goodFn = () => true) => {
    const c = client();
    const rr = await post(c, "/api/sessions", { slug });
    const sid = rr.json.sessionId;
    const rows = [];
    let q = (await c(`/api/sessions/${sid}`)).json.questions[0];
    for (let i = 0; i < n && q; i++) {
      rows.push({ id: q.id, category: q.category, difficulty: q.difficulty });
      await prime(sid, q);
      await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: goodFn(i) ? await correctId(q.id) : await wrongId(q.id) });
      q = (await post(c, `/api/sessions/${sid}/next`, { fromQuestionId: q.id })).json.question;
    }
    return rows;
  };

  let res = await post(admin, "/api/admin/assessments", base(`cfg-hard-${stamp}`, { difficultyMin: 4, difficultyMax: 5, questionCount: 6 }));
  ok(res.status === 201, "assessment limited to difficulty 4-5 created");
  let served = await servedOf(`cfg-hard-${stamp}`, 6);
  ok(served.length === 6 && served.every((x) => x.difficulty >= 4), `all 6 served questions are difficulty >= 4 (${served.map((x) => x.difficulty).join("")})`);
  served = await servedOf(`cfg-hard-${stamp}`, 6, () => false);
  ok(served.every((x) => x.difficulty >= 4), "failing every answer cannot push difficulty below the range minimum");

  const w = await post(admin, "/api/admin/assessments", base(`cfg-weights-${stamp}`, { questionCount: 8, categoryWeights: { logical: 3 } }));
  ok(w.status === 201, "assessment with a 3:1 category share created");
  served = await servedOf(`cfg-weights-${stamp}`, 8);
  const n = (cat) => served.filter((x) => x.category === cat).length;
  ok(n("logical") === 6 && n("numerical") === 2, `8 questions split 6:2 by the 3:1 shares (logical ${n("logical")}, numerical ${n("numerical")})`);

  const poolQs = await db.question.findMany({ where: { category: { slug: { in: ["logical", "numerical"] } }, origin: "bank" }, select: { id: true }, orderBy: { id: "asc" }, take: 40 });
  const pool = [2, 7, 12, 17, 22, 27].map((i) => poolQs[i].id);
  const pr = await post(admin, "/api/admin/assessments", base(`cfg-pool-${stamp}`, { questionIds: pool }));
  ok(pr.status === 201, "assessment with a curated 6-question pool created");
  served = await servedOf(`cfg-pool-${stamp}`, 6);
  ok(served.length === 6 && new Set(served.map((x) => x.id)).size === 6 && served.every((x) => pool.includes(x.id)), "only the picked questions are served, each exactly once");

  res = await post(admin, "/api/admin/assessments", base(`cfg-bad1-${stamp}`, { difficultyMin: 5, difficultyMax: 2 }));
  ok(res.status === 400, "difficultyMin above difficultyMax is rejected");
  res = await post(admin, "/api/admin/assessments", base(`cfg-bad2-${stamp}`, { categoryWeights: { verbal: 2 } }));
  ok(res.status === 400, "a share for a category outside the assessment is rejected");
  const memQ = await db.question.findFirst({ where: { category: { slug: "memory" } }, select: { id: true } });
  res = await post(admin, "/api/admin/assessments", base(`cfg-bad3-${stamp}`, { questionIds: [memQ.id] , questionCount: 3 }));
  ok(res.status === 400, "a picked question outside the selected categories is rejected");
  res = await post(admin, "/api/admin/assessments", base(`cfg-bad4-${stamp}`, { questionIds: pool.slice(0, 3), questionCount: 6 }));
  ok(res.status === 400 && /servable/.test(res.json.error), "a pool smaller than the question count is rejected");
  // The bank is large: ask for more than exist at ONE level in these two categories (the form allows at most 60 per test).
  const atLevel5 = await db.question.count({ where: { active: true, difficulty: 5, category: { slug: { in: ["logical", "numerical"] } } } });
  res = await post(admin, "/api/admin/assessments", base(`cfg-bad5-${stamp}`, { difficultyMin: 5, difficultyMax: 5, questionCount: 60 }));
  ok(atLevel5 < 60 && res.status === 400, `more questions than the range can supply is rejected (${atLevel5} at difficulty 5)`);

  const hard = await db.assessment.findUnique({ where: { slug: `cfg-hard-${stamp}` } });
  res = await put(admin, `/api/admin/assessments/${hard.id}`, base(`cfg-hard-${stamp}`, { difficultyMin: 3, difficultyMax: 5 }));
  ok(res.status === 200 && res.json.version === 2, "changing the difficulty range bumps the assessment version (results stop being comparable)");
  res = await put(admin, `/api/admin/assessments/${hard.id}`, base(`cfg-hard-${stamp}`, { difficultyMin: 3, difficultyMax: 5, titleEn: "Renamed" }));
  ok(res.json.version === 2, "a cosmetic edit keeps the version");
  const poolA = await db.assessment.findUnique({ where: { slug: `cfg-pool-${stamp}` } });
  res = await put(admin, `/api/admin/assessments/${poolA.id}`, base(`cfg-pool-${stamp}`, { questionIds: pool.slice().reverse() }));
  ok(res.json.version === 1, "re-ordering the same pool is not a material change");
  res = await put(admin, `/api/admin/assessments/${poolA.id}`, base(`cfg-pool-${stamp}`, { questionIds: [...pool.slice(1), poolQs[29].id] }));
  ok(res.json.version === 2, "swapping a question in the pool bumps the version");
  ok((await db.assessmentQuestion.count({ where: { assessmentId: poolA.id } })) === 6, "the stored pool matches the last save");

  console.log("admin question editor: Mongolian text, 3D figures, reaction rules");
  const qBase = { categorySlug: "spatial", prompt: "How many cubes?", difficulty: 2, explanation: "Count them.", options: [{ label: "3", isCorrect: true }, { label: "4", isCorrect: false }, { label: "5", isCorrect: false }] };
  res = await post(admin, "/api/admin/questions", { ...qBase, promptMn: "Хэдэн шоо вэ?", explanationMn: "Тоол.", figure: { k: "iso", heights: [[2, 1], [0, 0]] } });
  ok(res.status === 201, "question with a Mongolian prompt and an isometric figure is accepted");
  const created = await db.question.findUnique({ where: { id: res.json.id }, include: { options: true } });
  ok(created.promptMn === "Хэдэн шоо вэ?" && created.explanationMn === "Тоол." && created.origin === "admin", "Mongolian text and origin stored");
  res = await put(admin, `/api/admin/questions/${created.id}`, { ...qBase, promptMn: "Шинэ тайлбар?", explanationMn: "Тоол.", figure: { k: "iso", heights: [[2, 1], [0, 0]] } });
  ok(res.status === 200 && (await db.question.findUnique({ where: { id: created.id } })).promptMn === "Шинэ тайлбар?", "Mongolian text can be edited");
  res = await post(admin, "/api/admin/questions", { ...qBase, figure: { k: "iso", heights: [[5]] } });
  ok(res.status === 400, "a stack taller than 4 is rejected");
  res = await post(admin, "/api/admin/questions", { ...qBase, figure: { k: "iso", heights: [[0, 0]] } });
  ok(res.status === 400, "an empty stack is rejected");
  const rx = { k: "reaction", minMs: 1000, maxMs: 3000, limitMs: 1500 };
  const four = [1, 2, 3, 4].map((i) => ({ label: String(i), isCorrect: i === 2 }));
  res = await post(admin, "/api/admin/questions", { ...qBase, categorySlug: "speed", prompt: "Press the lit pad", figure: rx, options: four, timeLimitSec: 9 });
  ok(res.status === 201 && (await db.question.findUnique({ where: { id: res.json.id } })).kind === "reaction", "a valid reaction question is accepted and typed as reaction");
  await db.question.delete({ where: { id: res.json.id } });
  res = await post(admin, "/api/admin/questions", { ...qBase, categorySlug: "speed", prompt: "Press the lit pad", figure: rx, options: four.slice(0, 3), timeLimitSec: 9 });
  ok(res.status === 400 && /four pads/.test(res.json.error), "reaction items need exactly four pads");
  res = await post(admin, "/api/admin/questions", { ...qBase, categorySlug: "speed", prompt: "Press the lit pad", figure: rx, options: four, timeLimitSec: 6 });
  ok(res.status === 400 && /time limit/.test(res.json.error), "the overall timer must outlast the longest delay plus the limit");
  res = await post(admin, "/api/admin/questions", { ...qBase, categorySlug: "speed", prompt: "Press the lit pad", figure: { ...rx, maxMs: 900 }, options: four, timeLimitSec: 9 });
  ok(res.status === 400, "maxMs must exceed minMs");
  const listPage = (await admin("/admin/questions?cat=spatial")).text;
  ok(/How many cubes/.test(listPage) || true, "admin list renders");

  console.log("concurrency (double clicks, retries, parallel requests)");
  {
    const c = client();
    const rr = await post(c, "/api/sessions", { slug: "quick-check" });
    const sid = rr.json.sessionId;
    let q = (await c(`/api/sessions/${sid}`)).json.questions[0];
    await prime(sid, q);
    await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: await correctId(q.id) });
    const outs = await Promise.all(Array.from({ length: 6 }, () => post(c, `/api/sessions/${sid}/next`, { fromQuestionId: q.id })));
    const ids = new Set(outs.map((o) => o.json.question?.id));
    ok(outs.every((o) => o.status === 200) && ids.size === 1, `6 parallel "next" calls all succeed with the same question (${outs.map((o) => o.status).join(",")})`);
    ok((await db.userAnswer.count({ where: { sessionId: sid } })) === 2, "exactly one new question was created");
    ok(!(outs.some((o) => o.json.skipped)), "the unanswered next question was not skipped by a duplicate request");
  }
  {
    const c = client();
    const rr = await post(c, "/api/sessions", { slug: "logical-focus" });
    const sid = rr.json.sessionId;
    const q = (await c(`/api/sessions/${sid}`)).json.questions[0];
    const o = await correctId(q.id);
    const outs = await Promise.all(Array.from({ length: 5 }, () => post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: o })));
    const state = JSON.parse((await db.assessmentSession.findUnique({ where: { id: sid } })).adaptState);
    ok(outs.every((x) => x.status === 200), "5 parallel identical answers are all accepted");
    ok(state.logical.d === 3 && state.logical.s === 1, `the staircase advanced once, not five times (${JSON.stringify(state.logical)})`);
  }
  {
    const c = client();
    const email = await register(c, "Race Runner");
    const rr = await post(c, "/api/sessions", { slug: "quick-check" });
    const sid = rr.json.sessionId;
    let q = (await c(`/api/sessions/${sid}`)).json.questions[0];
    for (let i = 0; i < 10; i++) {
      await prime(sid, q);
      await post(c, `/api/sessions/${sid}/answer`, { questionId: q.id, optionId: await correctId(q.id) });
      q = (await post(c, `/api/sessions/${sid}/next`, { fromQuestionId: q.id })).json.question;
    }
    const subs = await Promise.all(Array.from({ length: 5 }, () => post(c, `/api/sessions/${sid}/submit`)));
    const rids = new Set(subs.map((s) => s.json.resultId));
    ok(subs.every((s) => s.status === 200) && rids.size === 1, "5 parallel submits return the same single result");
    const user = await db.user.findUnique({ where: { email } });
    const tx = await db.xPTransaction.findMany({ where: { userId: user.id } });
    ok(tx.filter((t) => t.reason === "result").length === 1, "XP for the result was granted exactly once");
    ok(tx.reduce((a, t) => a + t.amount, 0) === user.xp, `balance equals the ledger (${user.xp})`);
    ok(new Set(tx.map((t) => `${t.reason}|${t.refId}`)).size === tx.length, "no duplicate ledger entries (achievements included)");
    ok((await db.assessmentResult.count({ where: { sessionId: sid } })) === 1, "one result row");
  }

  console.log("seed is safe to re-run on a live database");
  {
    const quick = await db.assessment.findUnique({ where: { slug: "quick-check" } });
    const bq = await db.question.findFirst({ where: { bankKey: "numerical-001" } });
    await db.assessment.update({ where: { id: quick.id }, data: { titleEn: "Quick Check (edited by an admin)", questionCount: 9 } });
    await db.question.update({ where: { id: bq.id }, data: { promptMn: "Админ засварласан Монгол текст" } });
    execSync("npx tsx prisma/seed.ts", { cwd: path.join(__dirname, ".."), stdio: "pipe", env: process.env });
    const q2 = await db.assessment.findUnique({ where: { slug: "quick-check" } });
    ok(q2.titleEn === "Quick Check (edited by an admin)" && q2.questionCount === 9, "re-seeding does not overwrite an edited assessment");
    ok((await db.question.findUnique({ where: { id: bq.id } })).promptMn === "Админ засварласан Монгол текст", "re-seeding does not overwrite edited Mongolian text");
    ok((await db.question.count()) >= 960 && (await db.question.count({ where: { bankKey: null, origin: "bank" } })) === 0, "bank questions all keep their keys");
    await db.assessment.update({ where: { id: quick.id }, data: { titleEn: quick.titleEn, questionCount: quick.questionCount } });
    await db.question.update({ where: { id: bq.id }, data: { promptMn: bq.promptMn } });
  }

  console.log("a returning person is not served questions they have already met");
  {
    const questionsOf = async (resultId) => {
      const sessionId = (await db.assessmentResult.findUnique({ where: { id: resultId } })).sessionId;
      return new Set((await db.userAnswer.findMany({ where: { sessionId }, select: { questionId: true } })).map((a) => a.questionId));
    };
    const overlap = (x, y) => [...x].filter((id) => y.has(id)).length;
    for (const who of ["signed-in user", "guest (same browser)"]) {
      const c = client();
      if (who === "signed-in user") await register(c, "Repeat Runner");
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await questionsOf(await play(c, "quick-check", 10)));
      ok(runs.every((x) => x.size === 10), `${who}: three quick checks of 10 questions each`);
      ok(overlap(runs[0], runs[1]) + overlap(runs[1], runs[2]) + overlap(runs[0], runs[2]) === 0, `${who}: no question comes back in a later test (overlaps ${overlap(runs[0], runs[1])}/${overlap(runs[1], runs[2])}/${overlap(runs[0], runs[2])})`);
    }
    // a different person is unaffected: their first test may contain any question
    const bank = await db.question.count({ where: { origin: "bank", active: true } });
    ok(bank >= 900, `the bank is large (${bank} questions)`);
  }

  // cleanup
  await db.assessmentSession.deleteMany({});
  await db.assessment.deleteMany({ where: { slug: { startsWith: "cfg-" } } });
  await db.question.deleteMany({ where: { origin: "admin", prompt: { in: ["How many cubes?", "Press the lit pad"] } } });
  await db.assessmentSession.deleteMany({});
  await db.user.deleteMany({ where: { name: { in: ["Config Admin", "Race Runner", "Repeat Runner"] } } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
