const L = require("./lib.cjs");
const { db, ok, client, post, play, register, done, opt } = L;
const day = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return day(d); };

(async () => {
  const u = client();
  const email = await register(u, "Gamer One");
  const user = () => db.user.findUnique({ where: { email } });

  console.log("XP / streak / achievements after an assessment");
  const rid = await play(u, "quick-check", 10);
  let usr = await user();
  const tx = await db.xPTransaction.findMany({ where: { userId: usr.id } });
  ok(tx.some((t) => t.reason === "result" && t.amount === 50), "result XP = 20 + 30% of 100 = 50");
  ok(tx.reduce((a, t) => a + t.amount, 0) === usr.xp, `user.xp (${usr.xp}) equals the sum of XP transactions`);
  const owned = (await db.userAchievement.findMany({ where: { userId: usr.id }, include: { achievement: true } })).map((o) => o.achievement.code);
  ok(["first-assessment", "perfect-accuracy", "cognitive-explorer"].every((c) => owned.includes(c)), `unlocked: ${owned.join(", ")}`);
  const achXp = tx.filter((t) => t.reason.startsWith("achievement:")).reduce((a, t) => a + t.amount, 0);
  ok(achXp === (await db.achievement.findMany({ where: { code: { in: owned } } })).reduce((a, x) => a + x.xpReward, 0), "achievement XP equals their rewards");
  const st = await db.userStreak.findUnique({ where: { userId: usr.id } });
  ok(st.current === 1 && st.lastActiveDate === day(), "streak started at 1 today");
  ok((await db.notification.count({ where: { userId: usr.id } })) >= 2, "notifications created");

  const before = usr.xp;
  const sessionId = (await db.assessmentResult.findUnique({ where: { id: rid } })).sessionId;
  await post(u, `/api/sessions/${sessionId}/submit`);
  ok((await user()).xp === before, "re-submitting does not award XP twice");

  const rid2 = await play(u, "quick-check", 10);
  usr = await user();
  ok((await db.userStreak.findUnique({ where: { userId: usr.id } })).current === 1, "second activity the same day keeps streak at 1");
  ok(usr.xp - before >= 50, `second perfect run adds result XP (+${usr.xp - before}; more only if it unlocked something new)`);
  let page = await u(`/results/${rid}`);
  ok(page.status === 200 && /Achievement unlocked/.test(page.text), "results page shows the unlock banner");
  const newly = await db.userAchievement.count({ where: { userId: usr.id, resultId: rid2 } });
  page = await u(`/results/${rid2}`);
  ok(newly > 0 || !/Achievement unlocked/.test(page.text), "banner appears only for results that unlocked something");

  console.log("dashboard & achievements pages");
  page = await u("/dashboard");
  ok(page.status === 200 && /Gamer One/.test(page.text) && /Level/.test(page.text), "dashboard renders for the user");
  ok(/Latest assessment/.test(page.text) && /Recommended next/.test(page.text), "dashboard sections present");
  page = await u("/achievements");
  ok(page.status === 200 && /First Assessment/.test(page.text) && /data-unlocked="true"/.test(page.text), "achievements page lists unlocked badges");
  ok((await client()("/dashboard")).status === 307, "dashboard redirects anonymous users");
  const fresh = client();
  await register(fresh, "Newbie");
  page = await fresh("/dashboard");
  ok(page.status === 200 && /not completed an assessment yet/.test(page.text), "new user sees an empty state");

  console.log("daily challenge");
  let r = await u("/api/daily");
  ok(r.status === 200 && r.json.questions.length === 5 && !r.json.attempt, "5 questions, no attempt yet");
  ok(!/isCorrect|explanation|correctOptionId/.test(r.text), "daily payload has no answers");
  ok(["logical", "numerical", "abstract", "memory", "speed"].every((c) => r.json.questions.some((q) => q.category === c)), "one question per slot");
  const again = await u("/api/daily");
  ok(JSON.stringify(again.json.questions.map((q) => q.id)) === JSON.stringify(r.json.questions.map((q) => q.id)), "same questions all day");
  const guest = client();
  let g = await guest("/api/daily");
  ok(g.status === 200 && g.json.signedIn === false && !g.json.attempt, "guest can view");
  g = await post(guest, "/api/daily", { answers: {} });
  ok(g.status === 401, "guest cannot submit");
  g = await post(u, "/api/daily", { answers: {} }, { Origin: "https://evil.example" });
  ok(g.status === 403, "cross-site submit blocked (CSRF)");
  g = await post(u, "/api/daily", { answers: { [r.json.questions[0].id]: "bogus" } });
  ok(g.status === 400, "invalid option rejected");

  const dow = new Date().getUTCDay() || 7;
  const monday = addDays(day(), -(dow - 1));
  const others = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d !== day()).slice(0, 4);
  for (const d of others) {
    const c = await db.dailyChallenge.upsert({ where: { date: d }, update: {}, create: { date: d, questionIds: "x" } });
    await db.challengeAttempt.create({ data: { challengeId: c.id, userId: usr.id, correct: 3, total: 5, xpAwarded: 30 } });
  }
  const answers = {};
  for (const q of r.json.questions) answers[q.id] = (await opt(q.id, true)).id;
  const xp0 = (await user()).xp;
  g = await post(u, "/api/daily", { answers });
  ok(g.status === 200 && g.json.correct === 5 && g.json.xp === 40, `5/5 correct -> 40 XP (got ${g.json.xp})`);
  ok(g.json.bonus === 100, "weekly bonus (+100) awarded on the 5th challenge of the week");
  ok(g.json.unlocked.some((a) => a.code === "daily-challenger"), "daily-challenger achievement unlocked");
  ok(g.json.review.length === 5 && g.json.review.every((x) => x.explanation && x.correct), "solutions with explanations returned after submit");
  const gained = (await user()).xp - xp0;
  ok(gained >= 40 + 100 + 50, `XP gained = challenge + bonus + achievement(s) (${gained})`);
  g = await post(u, "/api/daily", { answers });
  ok(g.status === 409, "second attempt the same day rejected");
  r = await u("/api/daily");
  ok(r.json.attempt && r.json.attempt.correct === 5 && r.json.attempt.review.length === 5, "GET now returns the saved attempt + solutions");
  ok(r.json.weekly.done === 5 && r.json.weekly.claimed === true, "weekly progress 5/5 claimed");
  page = await u("/daily");
  ok(page.status === 200, "/daily page renders");

  await db.challengeAttempt.deleteMany({ where: { userId: usr.id } });
  await db.dailyChallenge.deleteMany({ where: { questionIds: "x" } });
  await db.assessmentSession.deleteMany({});
  await db.user.deleteMany({ where: { name: { in: ["Gamer One", "Newbie"] } } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
