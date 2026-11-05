/**
 * Rule-based feedback. Pure and deterministic: every sentence is generated from the numbers in
 * `FeedbackInput`, never from templates that claim something the data does not show.
 * Output is bilingual (en/mn). It never mentions IQ or percentiles except to say they are not computed.
 */
export type Bi = { en: string; mn: string };

export type CatStat = {
  slug: string;
  total: number;
  correct: number;
  performance: number;
  /** Highest difficulty (1-5) the user answered correctly in this category. */
  hardestCorrect: number | null;
  unanswered: number;
};

export type FeedbackInput = {
  performance: number;
  accuracy: number;
  total: number;
  unanswered: number;
  cats: CatStat[];
  previous?: { performance: number; cats: { slug: string; performance: number; total: number }[] } | null;
};

export type Feedback = {
  summary: Bi;
  strengths: Bi[];
  improvements: Bi[];
  observations: Bi[];
  recommendations: Bi[];
  confidence: "low" | "ok";
};

export const CAT_NAMES: Record<string, Bi> = {
  logical: { en: "logical reasoning", mn: "логик сэтгэлгээ" },
  abstract: { en: "abstract reasoning", mn: "хийсвэр сэтгэлгээ" },
  numerical: { en: "numerical reasoning", mn: "тооллын сэтгэлгээ" },
  verbal: { en: "verbal reasoning", mn: "хэл зүйн сэтгэлгээ" },
  spatial: { en: "spatial reasoning", mn: "орон зайн сэтгэлгээ" },
  memory: { en: "memory", mn: "ой тогтоолт" },
  speed: { en: "processing speed", mn: "боловсруулах хурд" },
};

const TIPS: Record<string, Bi[]> = {
  logical: [
    { en: "Practise writing each premise down and testing the conclusion against it; look for the one answer that must be true, not merely could be true.", mn: "Нөхцөл бүрийг бичиж, дүгнэлтийг тэдгээртэй тулгаж үз: “байж болох” биш “заавал үнэн” хариултыг ол." },
    { en: "For sequences, compute the differences, then the differences of the differences, before guessing.", mn: "Дарааллын хувьд таамаглахаасаа өмнө зөрүүг, дараа нь зөрүүний зөрүүг бод." },
  ],
  abstract: [
    { en: "Name the rule for each attribute separately (rotation, fill, count, shape) and check them one at a time.", mn: "Шинж чанар бүрийн (эргэлт, будалт, тоо, хэлбэр) дүрмийг тусад нь нэрлээд нэг нэгээр шалга." },
    { en: "When two rules run together, solve the easier one first to eliminate options.", mn: "Хоёр дүрэм зэрэг ажиллаж байвал хялбарыг нь эхэлж бодож хариултыг багасга." },
  ],
  numerical: [
    { en: "Build fluency with common series (squares, doubling, Fibonacci-style sums) and with percentage and ratio problems.", mn: "Түгээмэл цуваа (квадрат, хоёр дахин, Фибоначчи төст нийлбэр) болон хувь, харьцааны бодлогод дасал." },
    { en: "Estimate first: a quick rough answer helps you reject options that are far off.", mn: "Эхлээд ойролцоогоор тооцоол: хол зөрүүтэй хариултыг шууд хаяхад тусална." },
  ],
  verbal: [
    { en: "Read widely and look up unfamiliar words; for analogies, state the relationship in a sentence before checking options.", mn: "Уншлагаа нэмж үл мэдэх үгийг хайж үз; аналогид холбоог өгүүлбэрээр хэлж байж сонголтыг шалга." },
    { en: "Learn common word roots; they make unfamiliar vocabulary easier to decode.", mn: "Үгийн язгуурыг сур: үл мэдэх үгийг тайлахад хялбар болгоно." },
  ],
  spatial: [
    { en: "Rotate one distinctive corner of the shape in your head instead of the whole shape; mirror images differ in handedness, not shape.", mn: "Бүх дүрсийг биш онцлог нэг булангаа оюун ухаанаар эргүүл; толин тусгал нь хэлбэрээрээ биш чиглэлээрээ ялгаатай." },
    { en: "Practise with physical blocks or by sketching shapes after each rotation.", mn: "Бодит блок ашиглах эсвэл эргэлт бүрийн дараа дүрсээ зурж дасгалла." },
  ],
  memory: [
    { en: "Chunk digits into groups of two or three and rehearse them silently; for word lists, link the words in a short story.", mn: "Цифрийг 2–3-аар бүлэглэж чимээгүй давт; үгсийн жагсаалтыг богино түүхээр холбо." },
    { en: "For grid patterns, note the shape the lit squares make rather than memorising each square.", mn: "Тор дүрсийн хувьд нэг нэг нүд биш ассан нүднүүдийн үүсгэсэн хэлбэрийг тогтоо." },
  ],
  speed: [
    { en: "Scan systematically (left to right, one character at a time) and commit to an answer; hesitation costs more time than occasional errors.", mn: "Зүүнээс баруун тийш нэг тэмдэгтээр системтэй хар, хариулахаа шийд: эргэлзэх нь алдаанаас илүү цаг алддаг." },
    { en: "Do short daily timed drills; speed improves with familiarity.", mn: "Өдөр бүр богино хугацаатай дасгал хий: туршлагаар хурд сайжирна." },
  ],
};

export const MIN_Q_TO_RANK = 2;
const STRONG = 75;
const WEAK = 60;
const GAP = 20;
const BALANCED_SPREAD = 15;
const DELTA = 10;
const UNANSWERED_SHARE = 0.2;
const MAX_CHANGES = 3; // per-domain change lines: only the largest few
const MAX_IMPROVEMENTS = 3; // focus the advice: list only the weakest few domains

const name = (slug: string): Bi => CAT_NAMES[slug] ?? { en: slug, mn: slug };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (n: number) => `${Math.round(n)}%`;

export function buildFeedback(inp: FeedbackInput): Feedback {
  const strengths: Bi[] = [];
  const improvements: Bi[] = [];
  const observations: Bi[] = [];
  const recommendations: Bi[] = [];

  const rankable = inp.cats.filter((c) => c.total >= MIN_Q_TO_RANK);
  const confidence: Feedback["confidence"] = inp.total < 10 || rankable.length === 0 ? "low" : "ok";

  // --- summary (no IQ claim) ---
  const p = inp.performance;
  const band =
    p >= 80
      ? { en: "a strong result on this set of questions", mn: "энэ асуултын багц дээр сайн үр дүн" }
      : p >= 60
        ? { en: "a solid result with room to grow", mn: "хөгжих боломжтой, тогтвортой үр дүн" }
        : p >= 40
          ? { en: "a mixed result, with some areas going well and others needing practice", mn: "зарим талаараа сайн, зарим талаараа дадлага шаардлагатай холимог үр дүн" }
          : { en: "an early-practice result; this is a starting point, not a limit", mn: "дасгалын эхний үр дүн; энэ бол хязгаар биш, эхлэл" };
  const summary: Bi = {
    en: `Your difficulty-weighted performance was ${p}/100 (${pct(inp.accuracy)} accuracy), ${band.en}. This is a practice score, not an IQ.`,
    mn: `Таны хүндрэлээр жинлэсэн гүйцэтгэл ${p}/100 (нарийвчлал ${pct(inp.accuracy)}) байсан нь ${band.mn}. Энэ бол дасгалын оноо, IQ биш.`,
  };

  // --- strengths / improvements across domains ---
  const sorted = [...rankable].sort((a, b) => b.performance - a.performance || b.total - a.total || a.slug.localeCompare(b.slug));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  if (best && rankable.length >= 2) {
    const n = name(best.slug);
    strengths.push({
      en: `Your strongest domain was ${n.en} (${pct(best.performance)}, ${best.correct}/${best.total} correct).`,
      mn: `Таны хамгийн давуу чадвар ${n.mn} байлаа (${pct(best.performance)}, ${best.correct}/${best.total} зөв).`,
    });
  }
  for (const c of sorted.slice(1)) {
    if (c.performance >= STRONG && c.slug !== best?.slug) {
      const n = name(c.slug);
      strengths.push({
        en: `${cap(n.en)} was also strong (${pct(c.performance)}).`,
        mn: `${cap(n.mn)} мөн сайн байлаа (${pct(c.performance)}).`,
      });
    }
  }
  for (const c of inp.cats) {
    if (c.hardestCorrect !== null && c.hardestCorrect >= 4) {
      const n = name(c.slug);
      strengths.push({
        en: `You answered difficulty-${c.hardestCorrect} ${n.en} questions correctly.`,
        mn: `Та ${n.mn}-ын ${c.hardestCorrect}-р түвшний асуултад зөв хариулсан.`,
      });
    }
  }

  const weakCats: CatStat[] = [];
  if (worst && rankable.length >= 2) {
    const gap = best.performance - worst.performance;
    if (worst.performance < WEAK || gap >= GAP) weakCats.push(worst);
  }
  for (const c of sorted.slice(0, -1).reverse()) {
    if (c.performance < 50 && !weakCats.includes(c)) weakCats.push(c);
  }
  weakCats.splice(MAX_IMPROVEMENTS);
  for (const c of weakCats) {
    const n = name(c.slug);
    improvements.push({
      en: `${cap(n.en)} could benefit from additional practice (${pct(c.performance)}, ${c.correct}/${c.total} correct).`,
      mn: `${cap(n.mn)} нэмэлт дадлага шаардлагатай байна (${pct(c.performance)}, ${c.correct}/${c.total} зөв).`,
    });
  }

  if (rankable.length >= 3 && best.performance - worst.performance < BALANCED_SPREAD) {
    observations.push({
      en: `Your profile was balanced: the gap between your best and weakest domain was under ${BALANCED_SPREAD} points.`,
      mn: `Таны профайл тэнцвэртэй: хамгийн сайн ба хамгийн сул чадварын зөрүү ${BALANCED_SPREAD} онооноос бага байлаа.`,
    });
  }

  // --- behaviour ---
  if (inp.total > 0 && inp.unanswered / inp.total >= UNANSWERED_SHARE) {
    observations.push({
      en: `${inp.unanswered} of ${inp.total} questions were left unanswered. Unanswered counts the same as incorrect, so it never hurts to give your best guess.`,
      mn: `${inp.total} асуултын ${inp.unanswered} нь хариулагдаагүй. Хариулаагүй нь буруутай адил тооцогддог тул таамаглаж хариулах нь хохиролгүй.`,
    });
    recommendations.push({
      en: "Aim to answer every question; when unsure, eliminate options you know are wrong and choose from the rest.",
      mn: "Бүх асуултад хариулахыг зорь: эргэлзвэл буруу гэдгээ мэдэж буй сонголтуудыг хасаад үлдсэнээс сонго.",
    });
  }
  const speed = inp.cats.find((c) => c.slug === "speed");
  if (speed && speed.unanswered > 0) {
    observations.push({
      en: `${speed.unanswered} processing-speed question(s) ran out of time.`,
      mn: `Боловсруулах хурдны ${speed.unanswered} асуултад хугацаа дууссан.`,
    });
  }

  // --- comparison with the previous attempt ---
  if (inp.previous) {
    const d = Math.round((inp.performance - inp.previous.performance) * 10) / 10;
    const caveat = {
      en: " Different questions may have been served, so treat this as practice progress, not a change in IQ.",
      mn: " Өөр асуулт ирсэн байж болох тул үүнийг IQ-ийн өөрчлөлт биш, дасгалын ахиц гэж ойлгоорой.",
    };
    if (Math.abs(d) < 5) {
      observations.push({ en: `Your overall performance was similar to your previous attempt (${d >= 0 ? "+" : ""}${d} points).${caveat.en}`, mn: `Нийт гүйцэтгэл өмнөх оролдлоготой төстэй (${d >= 0 ? "+" : ""}${d} оноо).${caveat.mn}` });
    } else if (d > 0) {
      observations.push({ en: `Your overall performance was ${d} points higher than your previous attempt.${caveat.en}`, mn: `Нийт гүйцэтгэл өмнөх оролдлогоос ${d} оноогоор өндөр байлаа.${caveat.mn}` });
    } else {
      observations.push({ en: `Your overall performance was ${Math.abs(d)} points lower than your previous attempt.${caveat.en}`, mn: `Нийт гүйцэтгэл өмнөх оролдлогоос ${Math.abs(d)} оноогоор бага байлаа.${caveat.mn}` });
    }
    const changes = rankable
      .map((c) => {
        const prev = inp.previous!.cats.find((x) => x.slug === c.slug && x.total >= MIN_Q_TO_RANK);
        return prev ? { c, cd: Math.round(c.performance - prev.performance) } : null;
      })
      .filter((x): x is { c: CatStat; cd: number } => x !== null && Math.abs(x.cd) >= DELTA)
      .sort((x, y) => Math.abs(y.cd) - Math.abs(x.cd) || x.c.slug.localeCompare(y.c.slug))
      .slice(0, MAX_CHANGES);
    for (const { c, cd } of changes) {
      const n = name(c.slug);
      if (cd > 0) observations.push({ en: `Your ${n.en} performance was stronger than your previous attempt (+${cd} points).`, mn: `Таны ${n.mn}-ын гүйцэтгэл өмнөхөөс сайн байлаа (+${cd} оноо).` });
      else observations.push({ en: `Your ${n.en} performance was lower than your previous attempt (${cd} points).`, mn: `Таны ${n.mn}-ын гүйцэтгэл өмнөхөөс бага байлаа (${cd} оноо).` });
    }
  }

  // --- recommendations tied to weak domains ---
  for (const c of weakCats.slice(0, 2)) {
    const tips = TIPS[c.slug];
    if (tips) recommendations.push(tips[0]);
  }
  if (weakCats.length === 0 && rankable.length > 0) {
    recommendations.push({
      en: "Maintain your progress with a daily challenge, and try a longer assessment to see whether the pattern holds across more questions.",
      mn: "Өдөр тутмын сорилтоор ахицаа хадгалж, илүү олон асуулттай тест өгч энэ хэв маяг батлагдаж байгаа эсэхийг шалга.",
    });
  }

  if (confidence === "low") {
    observations.push({
      en: "This assessment had few questions per domain, so domain comparisons are tentative. Longer assessments give a more reliable picture.",
      mn: "Энэ тест чадвар бүрт цөөн асуулттай тул чадваруудын харьцуулалт түр зуурынх. Урт тест илүү найдвартай дүр зураг өгнө.",
    });
  }

  return { summary, strengths, improvements, observations, recommendations, confidence };
}

/**
 * The one domain worth practising next, or null. A domain only counts as weak when it is genuinely low
 * (< 60%) or far behind the best domain (>= 20 points): a flat or perfect profile has no weakest domain.
 */
export function weakestDomain(cats: { slug: string; total: number; performance: number }[]) {
  const ranked = cats.filter((c) => c.total >= MIN_Q_TO_RANK).sort((a, b) => a.performance - b.performance || a.slug.localeCompare(b.slug));
  if (ranked.length < 2) return null;
  const worst = ranked[0];
  const best = ranked[ranked.length - 1];
  return worst.performance < WEAK || best.performance - worst.performance >= GAP ? worst : null;
}

export function tipsFor(slug: string): Bi[] {
  return TIPS[slug] ?? [];
}
