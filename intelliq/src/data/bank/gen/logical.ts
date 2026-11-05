import { L, rng, shuffle, type QDef } from "../types";
import { DIFFS, collect, int, pick, wrongNumbers, type Diff, type R } from "./util";

/*
 * 120 generated logical-reasoning questions (24 per difficulty): ordering from clues, weekday and month arithmetic,
 * valid syllogisms over invented words, if-then reasoning (including the two classic fallacies), letter series, letter
 * codes and overlapping groups. Every answer follows from the construction; generated.test.ts re-derives them.
 * Mongolian text avoids suffixes on variable words and numbers (their form depends on pronunciation).
 */

type T = { en: string; mn?: string };
function build(diff: Diff, prompt: T, right: T, wrong: T[], expl: T): QDef {
  const wordy = right.mn !== undefined;
  return {
    cat: "logical", diff, prompt: prompt.en, right: L(right.en), wrong: wrong.map((w) => L(w.en)), explanation: expl.en,
    mn: { prompt: prompt.mn!, explanation: expl.mn!, ...(wordy ? { right: right.mn, wrong: wrong.map((w) => w.mn!) } : {}) },
  };
}

const NAMES: T[] = [
  { en: "Ann", mn: "Ану" }, { en: "Ben", mn: "Бат" }, { en: "Cara", mn: "Цэцэг" }, { en: "Dan", mn: "Дорж" },
  { en: "Eve", mn: "Сараа" }, { en: "Fay", mn: "Хулан" }, { en: "Gus", mn: "Ганаа" }, { en: "Hal", mn: "Болд" },
];

// ------------------------------------------------------------------ ordering

type Attr = { hi: string; lo: string; supHi: string; supLo: string; mnHi: string; mnLo: string };
const ATTRS: Attr[] = [
  { hi: "taller", lo: "shorter", supHi: "tallest", supLo: "shortest", mnHi: "өндөр", mnLo: "намхан" },
  { hi: "older", lo: "younger", supHi: "oldest", supLo: "youngest", mnHi: "настай", mnLo: "залуу" },
  { hi: "faster", lo: "slower", supHi: "fastest", supLo: "slowest", mnHi: "хурдан", mnLo: "удаан" },
  { hi: "heavier", lo: "lighter", supHi: "heaviest", supLo: "lightest", mnHi: "хүнд", mnLo: "хөнгөн" },
  { hi: "richer", lo: "poorer", supHi: "richest", supLo: "poorest", mnHi: "баян", mnLo: "ядуу" },
  { hi: "stronger", lo: "weaker", supHi: "strongest", supLo: "weakest", mnHi: "хүчтэй", mnLo: "сул" },
];

function ordering(r: R, diff: Diff): QDef | null {
  const n = diff <= 2 ? 4 : 5;
  const a = pick(r, ATTRS);
  const order = shuffle(NAMES.map((_, i) => i), r).slice(0, n); // index 0 = highest
  const mixed = diff >= 2; // some clues are phrased with the opposite adjective
  const middle = diff === 5 && r() < 0.5;
  const pairs = shuffle(order.slice(0, -1).map((_, i) => i), r);
  if (diff === 1) pairs.sort((x, y) => x - y); // easiest: clues already in chain order
  const clue = (i: number): T => {
    const hi = NAMES[order[i]], lo = NAMES[order[i + 1]];
    if (mixed && r() < 0.5) return { en: `${lo.en} is ${a.lo} than ${hi.en}.`, mn: `${lo.mn} ба ${hi.mn} хоёрын дундаас ${lo.mn} илүү ${a.mnLo}.` };
    return { en: `${hi.en} is ${a.hi} than ${lo.en}.`, mn: `${hi.mn} ба ${lo.mn} хоёрын дундаас ${hi.mn} илүү ${a.mnHi}.` };
  };
  const clues = pairs.map(clue);
  let ask: T, ans: number;
  if (middle) {
    ask = { en: `Ranked from ${a.supHi} to ${a.supLo}, who is third?`, mn: `${a.mnHi} → ${a.mnLo} гэж эрэмбэлбэл гурав дахь нь хэн бэ?` };
    ans = order[2];
  } else {
    const top = r() < 0.5;
    ask = { en: `Who is the ${top ? a.supHi : a.supLo}?`, mn: `Хамгийн ${top ? a.mnHi : a.mnLo} нь хэн бэ?` };
    ans = order[top ? 0 : n - 1];
  }
  const others = shuffle(order.filter((i) => i !== ans), r).slice(0, 3);
  const chain = order.map((i) => NAMES[i]);
  return build(diff,
    { en: `${clues.map((c) => c.en).join(" ")} ${ask.en}`, mn: `${clues.map((c) => c.mn).join(" ")} ${ask.mn}` },
    NAMES[ans], others.map((i) => NAMES[i]),
    { en: `From ${a.supHi} to ${a.supLo} the order is ${chain.map((c) => c.en).join(", ")}.`, mn: `${a.mnHi} → ${a.mnLo} дарааллаар: ${chain.map((c) => c.mn).join(", ")}.` });
}

// ------------------------------------------------------------------ weekdays and months

const DAYS: T[] = [
  { en: "Monday", mn: "Даваа" }, { en: "Tuesday", mn: "Мягмар" }, { en: "Wednesday", mn: "Лхагва" }, { en: "Thursday", mn: "Пүрэв" },
  { en: "Friday", mn: "Баасан" }, { en: "Saturday", mn: "Бямба" }, { en: "Sunday", mn: "Ням" },
];
const MONTHS: T[] = [
  { en: "January", mn: "Нэгдүгээр сар" }, { en: "February", mn: "Хоёрдугаар сар" }, { en: "March", mn: "Гуравдугаар сар" },
  { en: "April", mn: "Дөрөвдүгээр сар" }, { en: "May", mn: "Тавдугаар сар" }, { en: "June", mn: "Зургадугаар сар" },
  { en: "July", mn: "Долдугаар сар" }, { en: "August", mn: "Наймдугаар сар" }, { en: "September", mn: "Есдүгээр сар" },
  { en: "October", mn: "Аравдугаар сар" }, { en: "November", mn: "Арван нэгдүгээр сар" }, { en: "December", mn: "Арван хоёрдугаар сар" },
];

function weekday(r: R, diff: Diff): QDef | null {
  const today = int(r, 0, 6), future = r() < 0.5;
  const n = diff === 1 ? pick(r, [1, 2, 3]) : pick(r, [4, 5, 6, 8, 9, 10, 11, 12, 13]); // never a whole number of weeks
  const ans = (((today + (future ? n : -n)) % 7) + 7) % 7;
  const wrong = shuffle([0, 1, 2, 3, 4, 5, 6].filter((d) => d !== ans), r).slice(0, 3);
  return build(diff,
    { en: `If today is ${DAYS[today].en}, what day ${future ? `will it be in ${n} day${n > 1 ? "s" : ""}` : `was it ${n} day${n > 1 ? "s" : ""} ago`}?`, mn: `Өнөөдөр ${DAYS[today].mn} гараг бол ${n} хоногийн ${future ? "дараа ямар гараг болох вэ" : "өмнө ямар гараг байсан бэ"}?` },
    { en: DAYS[ans].en, mn: DAYS[ans].mn }, wrong.map((d) => ({ en: DAYS[d].en, mn: DAYS[d].mn })),
    { en: `Counting ${future ? "forward" : "back"} ${n} days from ${DAYS[today].en} gives ${DAYS[ans].en}.`, mn: `${DAYS[today].mn} гарагаас ${n} хоног ${future ? "урагш" : "хойш"} тоолбол ${DAYS[ans].mn} гарагт хүрнэ.` });
}

function month(r: R, diff: Diff): QDef | null {
  const now = int(r, 0, 11), future = r() < 0.5, n = int(r, 2, 11);
  const ans = (((now + (future ? n : -n)) % 12) + 12) % 12;
  const wrong = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((m) => m !== ans), r).slice(0, 3);
  return build(diff,
    { en: `If this month is ${MONTHS[now].en}, which month ${future ? `comes ${n} months later` : `was it ${n} months ago`}?`, mn: `Энэ сар ${MONTHS[now].mn} бол ${n} сарын ${future ? "дараа" : "өмнө"} аль сар байх вэ?` },
    MONTHS[ans], wrong.map((m) => MONTHS[m]),
    { en: `Counting ${future ? "forward" : "back"} ${n} months from ${MONTHS[now].en} gives ${MONTHS[ans].en}.`, mn: `${MONTHS[now].mn}аас ${n} сар ${future ? "урагш" : "хойш"} тоолбол ${MONTHS[ans].mn} болно.` });
}

// ------------------------------------------------------------------ syllogisms

const NONSENSE: T[] = [
  { en: "Blorps", mn: "Блорп" }, { en: "Zinks", mn: "Зинк" }, { en: "Quibs", mn: "Квиб" }, { en: "Murks", mn: "Мүрх" },
  { en: "Delps", mn: "Дэлп" }, { en: "Tarks", mn: "Тарк" }, { en: "Fengs", mn: "Фэнг" }, { en: "Jumbs", mn: "Жумб" },
  { en: "Vexes", mn: "Вэкс" }, { en: "Prunks", mn: "Прунк" }, { en: "Gleebs", mn: "Глиб" }, { en: "Lorbs", mn: "Лорб" },
];
const stmt = (k: "all" | "no" | "some" | "someNot", x: T, y: T): T => ({
  all: { en: `All ${x.en} are ${y.en}`, mn: `Бүх ${x.mn} нь ${y.mn}` },
  no: { en: `No ${x.en} are ${y.en}`, mn: `Ямар ч ${x.mn} ${y.mn} биш` },
  some: { en: `Some ${x.en} are ${y.en}`, mn: `Зарим ${x.mn} нь ${y.mn}` },
  someNot: { en: `Some ${x.en} are not ${y.en}`, mn: `Зарим ${x.mn} нь ${y.mn} биш` },
})[k];

function syllogism(r: R, diff: Diff): QDef | null {
  const w = shuffle(NONSENSE, r);
  const [A, B, C, D] = w;
  type K = "all" | "no" | "some" | "someNot";
  let premises: [K, T, T][], concl: [K, T, T], wrong: [K, T, T][], why: T;
  const form = diff === 3 ? pick(r, ["barbara", "celarent"] as const) : diff === 4 ? pick(r, ["darii", "ferio"] as const) : pick(r, ["chainAll", "chainNo"] as const);
  switch (form) {
    case "barbara":
      premises = [["all", A, B], ["all", B, C]]; concl = ["all", A, C]; wrong = [["all", C, A], ["no", A, C], ["someNot", C, B]];
      why = { en: `Every ${A.en} is a member of ${B.en}, and every ${B.en} one of ${C.en}, so all ${A.en} are ${C.en}.`, mn: `${A.mn} бүр ${B.mn}, ${B.mn} бүр ${C.mn} тул бүх ${A.mn} нь ${C.mn}.` };
      break;
    case "celarent":
      premises = [["no", B, C], ["all", A, B]]; concl = ["no", A, C]; wrong = [["all", A, C], ["some", A, C], ["all", C, A]];
      why = { en: `All ${A.en} are ${B.en}, and no ${B.en} are ${C.en}, so no ${A.en} can be ${C.en}.`, mn: `${A.mn} бүр ${B.mn}, мөн ямар ч ${B.mn} ${C.mn} биш тул ямар ч ${A.mn} ${C.mn} байж чадахгүй.` };
      break;
    case "darii":
      premises = [["all", B, C], ["some", A, B]]; concl = ["some", A, C]; wrong = [["all", A, C], ["no", A, C], ["all", C, B]];
      why = { en: `Some ${A.en} are ${B.en}, and all ${B.en} are ${C.en}, so those ${A.en} are ${C.en}: some ${A.en} are ${C.en}.`, mn: `Зарим ${A.mn} нь ${B.mn}, бүх ${B.mn} нь ${C.mn} тул тэдгээр ${A.mn} нь ${C.mn}: зарим ${A.mn} нь ${C.mn}.` };
      break;
    case "ferio":
      premises = [["no", B, C], ["some", A, B]]; concl = ["someNot", A, C]; wrong = [["all", A, C], ["some", A, C], ["no", A, B]];
      why = { en: `Some ${A.en} are ${B.en}, and no ${B.en} are ${C.en}, so those ${A.en} are not ${C.en}: some ${A.en} are not ${C.en}.`, mn: `Зарим ${A.mn} нь ${B.mn}, ямар ч ${B.mn} ${C.mn} биш тул тэдгээр ${A.mn} нь ${C.mn} биш: зарим ${A.mn} нь ${C.mn} биш.` };
      break;
    case "chainAll":
      premises = [["all", A, B], ["all", B, C], ["all", C, D]]; concl = ["all", A, D]; wrong = [["all", D, A], ["no", A, D], ["someNot", A, B]];
      why = { en: `The chain ${A.en} → ${B.en} → ${C.en} → ${D.en} links every ${A.en} to ${D.en}: all ${A.en} are ${D.en}.`, mn: `${A.mn} → ${B.mn} → ${C.mn} → ${D.mn} гэсэн гинжээр ${A.mn} бүр ${D.mn} болно: бүх ${A.mn} нь ${D.mn}.` };
      break;
    default:
      premises = [["all", A, B], ["all", B, C], ["no", C, D]]; concl = ["no", A, D]; wrong = [["all", A, D], ["some", A, D], ["all", D, A]];
      why = { en: `All ${A.en} are ${B.en}, all ${B.en} are ${C.en}, and no ${C.en} are ${D.en}, so no ${A.en} can be ${D.en}.`, mn: `${A.mn} бүр ${B.mn}, ${B.mn} бүр ${C.mn}, ямар ч ${C.mn} ${D.mn} биш тул ямар ч ${A.mn} ${D.mn} байж чадахгүй.` };
  }
  const order = diff >= 4 ? shuffle(premises, r) : premises; // harder levels do not list the premises in logical order
  const text = (f: (t: T) => string) => order.map(([k, x, y]) => `${f(stmt(k, x, y))}.`).join(" ");
  const c = stmt(...concl);
  return build(diff,
    { en: `${text((t) => t.en)} Which statement must be true?`, mn: `${text((t) => t.mn!)} Аль нь заавал үнэн вэ?` },
    c, wrong.map((x) => stmt(...x)), why);
}

// ------------------------------------------------------------------ if-then reasoning

export type Rule = { ifEn: string; thenEn: string; ifMn: string; thenMn: string; p: T; np: T; q: T; nq: T };
export const CONDITIONAL_RULES: Rule[] = [
  { ifEn: "it rains", thenEn: "the ground gets wet", ifMn: "бороо орвол", thenMn: "газар нойтон болно", p: { en: "It is raining.", mn: "Бороо орж байна." }, np: { en: "It is not raining.", mn: "Бороо орохгүй байна." }, q: { en: "The ground is wet.", mn: "Газар нойтон байна." }, nq: { en: "The ground is not wet.", mn: "Газар нойтон биш байна." } },
  { ifEn: "the switch is on", thenEn: "the lamp is lit", ifMn: "унтраалга асаалттай бол", thenMn: "чийдэн гэрэлтэнэ", p: { en: "The switch is on.", mn: "Унтраалга асаалттай байна." }, np: { en: "The switch is off.", mn: "Унтраалга унтраалттай байна." }, q: { en: "The lamp is lit.", mn: "Чийдэн гэрэлтэж байна." }, nq: { en: "The lamp is not lit.", mn: "Чийдэн гэрэлтэхгүй байна." } },
  { ifEn: "Ann studies", thenEn: "she passes the exam", ifMn: "Ану хичээллэвэл", thenMn: "шалгалтаа тэнцэнэ", p: { en: "Ann studies.", mn: "Ану хичээллэж байна." }, np: { en: "Ann does not study.", mn: "Ану хичээллэхгүй байна." }, q: { en: "Ann passed the exam.", mn: "Ану шалгалтаа тэнцсэн." }, nq: { en: "Ann did not pass the exam.", mn: "Ану шалгалтаа тэнцээгүй." } },
  { ifEn: "water is heated to 100 °C", thenEn: "it boils", ifMn: "ус 100 °C хүртэл халбал", thenMn: "буцалж эхэлнэ", p: { en: "The water was heated to 100 °C.", mn: "Ус 100 °C хүртэл халсан." }, np: { en: "The water was not heated to 100 °C.", mn: "Ус 100 °C хүртэл халаагүй." }, q: { en: "The water is boiling.", mn: "Ус буцалж байна." }, nq: { en: "The water is not boiling.", mn: "Ус буцлаагүй байна." } },
  { ifEn: "it is Sunday", thenEn: "the shop is closed", ifMn: "ням гараг бол", thenMn: "дэлгүүр хаалттай", p: { en: "It is Sunday.", mn: "Өнөөдөр ням гараг." }, np: { en: "It is not Sunday.", mn: "Өнөөдөр ням гараг биш." }, q: { en: "The shop is closed.", mn: "Дэлгүүр хаалттай байна." }, nq: { en: "The shop is open.", mn: "Дэлгүүр нээлттэй байна." } },
  { ifEn: "the battery is charged", thenEn: "the phone turns on", ifMn: "зай цэнэгтэй бол", thenMn: "утас асна", p: { en: "The battery is charged.", mn: "Зай цэнэгтэй байна." }, np: { en: "The battery is empty.", mn: "Зай цэнэггүй байна." }, q: { en: "The phone turns on.", mn: "Утас асаж байна." }, nq: { en: "The phone does not turn on.", mn: "Утас асахгүй байна." } },
  { ifEn: "the traffic light is red", thenEn: "the cars stop", ifMn: "гэрлэн дохио улаан бол", thenMn: "машинууд зогсоно", p: { en: "The traffic light is red.", mn: "Гэрлэн дохио улаан байна." }, np: { en: "The traffic light is not red.", mn: "Гэрлэн дохио улаан биш байна." }, q: { en: "The cars are stopped.", mn: "Машинууд зогсож байна." }, nq: { en: "The cars are not stopped.", mn: "Машинууд зогсохгүй байна." } },
  { ifEn: "the soup is hot", thenEn: "steam rises", ifMn: "шөл халуун бол", thenMn: "уур гарна", p: { en: "The soup is hot.", mn: "Шөл халуун байна." }, np: { en: "The soup is not hot.", mn: "Шөл халуун биш байна." }, q: { en: "Steam is rising.", mn: "Уур гарч байна." }, nq: { en: "No steam is rising.", mn: "Уур гарахгүй байна." } },
];
export const UNKNOWN: T = { en: "No definite conclusion can be drawn", mn: "Тодорхой дүгнэлт хийх боломжгүй" };

function conditional(r: R, diff: Diff): QDef | null {
  const rule = pick(r, CONDITIONAL_RULES);
  const cond = { en: `If ${rule.ifEn}, ${rule.thenEn}.`, mn: `Хэрэв ${rule.ifMn} ${rule.thenMn}.` };
  const forms = diff === 2 ? (["mp", "mt"] as const) : diff === 3 ? (["mt", "mt", "ac"] as const) : (["ac", "da", "mt"] as const);
  const form = pick(r, forms);
  let fact: T, right: T, wrong: T[], why: T;
  if (form === "mp") {
    fact = rule.p; right = rule.q; wrong = [rule.nq, rule.np, UNKNOWN];
    why = { en: "The condition is met, so the result follows.", mn: "Нөхцөл биелсэн тул үр дүн гарна." };
  } else if (form === "mt") {
    fact = rule.nq; right = rule.np; wrong = [rule.p, rule.q, UNKNOWN];
    why = { en: "The result did not happen, so the condition cannot have been met.", mn: "Үр дүн гараагүй тул нөхцөл биелээгүй байсан нь тодорхой." };
  } else if (form === "ac") {
    fact = rule.q; right = UNKNOWN; wrong = [rule.p, rule.np, rule.nq];
    why = { en: "The result can have other causes, so it does not prove the condition was met.", mn: "Үр дүн өөр шалтгаанаас ч гарч болох тул нөхцөл биелсэн гэж батлахгүй." };
  } else {
    fact = rule.np; right = UNKNOWN; wrong = [rule.q, rule.nq, rule.p];
    why = { en: "The rule only says what follows when the condition is met; without it the result may or may not happen.", mn: "Дүрэм нь зөвхөн нөхцөл биелсэн үед юу гарахыг хэлнэ; биелээгүй үед үр дүн гарч ч болно, гарахгүй ч байж болно." };
  }
  return build(diff,
    { en: `${cond.en} ${fact.en} What can be concluded?`, mn: `${cond.mn} ${fact.mn} Юу дүгнэж болох вэ?` },
    right, wrong, why);
}

// ------------------------------------------------------------------ letters

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function letterSeries(r: R, diff: Diff): QDef | null {
  const step = diff === 1 ? int(r, 1, 2) : int(r, 2, 4);
  const start = int(r, 0, 25 - 5 * step);
  const shown = [0, 1, 2, 3, 4].map((i) => ALPHA[start + step * i]), next = ALPHA[start + 5 * step];
  const cand = shuffle([ALPHA[start + 5 * step + 1], ALPHA[start + 5 * step - 1], ALPHA[start + 4 * step + (step > 1 ? 1 : 0)], ALPHA[start + 6 * step], ALPHA[Math.max(0, start + 5 * step - 2)]], r).filter((c, i, a) => c !== undefined && c !== next && a.indexOf(c) === i);
  if (cand.length < 3) return null;
  const seq = shown.join(", ");
  return {
    cat: "logical", diff, prompt: `What comes next?  ${seq}, ?`, right: L(next), wrong: cand.slice(0, 3).map((c) => L(c)),
    explanation: `The letters move ${step} place${step > 1 ? "s" : ""} forward each time, so after ${shown[4]} comes ${next}.`,
    mn: { prompt: `Дараагийн үсэг аль вэ?  ${seq}, ?`, explanation: `Үсэг тутамд цагаан толгойн дарааллаар ${step} байр урагшилж байна: ${shown[4]} → ${next}.` },
  };
}

function letterWeave(r: R, diff: Diff): QDef | null {
  const a = int(r, 0, 8), b = int(r, 16, 25);
  const t = [ALPHA[a], ALPHA[b], ALPHA[a + 1], ALPHA[b - 1], ALPHA[a + 2], ALPHA[b - 2]], next = ALPHA[a + 3];
  const cand = shuffle([ALPHA[b - 3], ALPHA[a + 4], ALPHA[a + 2], ALPHA[b - 1], ALPHA[a + 5]], r).filter((c, i, arr) => c !== next && arr.indexOf(c) === i);
  if (cand.length < 3) return null;
  return {
    cat: "logical", diff, prompt: `What comes next?  ${t.join(", ")}, ?`, right: L(next), wrong: cand.slice(0, 3).map((c) => L(c)),
    explanation: `Two series are woven together: ${ALPHA[a]}, ${ALPHA[a + 1]}, ${ALPHA[a + 2]}, … goes forward and ${ALPHA[b]}, ${ALPHA[b - 1]}, ${ALPHA[b - 2]}, … goes backward. The next term continues the forward series: ${next}.`,
    mn: { prompt: `Дараагийн үсэг аль вэ?  ${t.join(", ")}, ?`, explanation: `Хоёр цуваа ээлжлэн орсон: ${ALPHA[a]}, ${ALPHA[a + 1]}, ${ALPHA[a + 2]}, … урагш, ${ALPHA[b]}, ${ALPHA[b - 1]}, ${ALPHA[b - 2]}, … хойш явна. Дараагийн гишүүн урагш явах цувааг үргэлжлүүлнэ: ${next}.` },
  };
}

const WORDS = ["CAT", "DOG", "SUN", "MAP", "BOX", "FISH", "MOON", "STAR", "TREE", "BIRD", "LAMP", "CAKE", "ROAD", "FIRE", "SNOW", "WIND", "BOOK", "DOOR", "RAIN", "SHIP", "HORSE", "RIVER", "CLOUD", "TIGER", "PIANO", "LEMON", "BREAD", "CHAIR"];
const shiftWord = (w: string, k: number) => w.split("").map((c) => ALPHA[ALPHA.indexOf(c) + k]).join("");
const canShift = (w: string, k: number) => w.split("").every((c) => ALPHA.indexOf(c) + k >= 0 && ALPHA.indexOf(c) + k <= 25);

function letterCode(r: R, diff: Diff, decode: boolean): QDef | null {
  const k = diff === 3 ? int(r, 1, 3) : diff === 4 ? int(r, 2, 4) : int(r, 3, 5);
  const pool = WORDS.filter((w) => (diff === 3 ? w.length === 3 || w.length === 4 : diff === 4 ? w.length === 4 || w.length === 5 : w.length >= 5) && canShift(w, k));
  if (pool.length === 0) return null;
  const w = pick(r, pool), coded = shiftWord(w, k);
  const places = `${k} place${k > 1 ? "s" : ""}`;
  const wrongPool = decode
    ? [canShift(coded, -k + 1) ? shiftWord(coded, -k + 1) : "", canShift(coded, -k - 1) ? shiftWord(coded, -k - 1) : "", canShift(coded, k) ? shiftWord(coded, k) : "", w.split("").reverse().join("")]
    : [canShift(w, k - 1) ? shiftWord(w, k - 1) : "", canShift(w, k + 1) ? shiftWord(w, k + 1) : "", canShift(w, -k) ? shiftWord(w, -k) : "", coded.split("").reverse().join("")];
  const right = decode ? w : coded;
  const wrong = wrongPool.filter((x, i, a) => x && x !== right && a.indexOf(x) === i);
  if (wrong.length < 3) return null;
  return {
    cat: "logical", diff,
    prompt: decode
      ? `In a code, each letter is replaced by the letter ${places} after it in the alphabet. What word does ${coded} stand for?`
      : `In a code, each letter is replaced by the letter ${places} after it in the alphabet. How is the word ${w} written in this code?`,
    right: L(right), wrong: wrong.slice(0, 3).map((x) => L(x)),
    explanation: decode ? `Each coded letter is ${places} after the real one, so move every letter ${places} back: ${coded} → ${w}.` : `Move every letter ${places} forward: ${w.split("").map((c) => `${c}→${ALPHA[ALPHA.indexOf(c) + k]}`).join(", ")}, giving ${coded}.`,
    mn: {
      prompt: decode
        ? `Нэг кодод үсэг бүрийг цагаан толгойн дарааллаар ${k} байр урагш шилжүүлдэг. ${coded} нь ямар үгийг заасан бэ?`
        : `Нэг кодод үсэг бүрийг цагаан толгойн дарааллаар ${k} байр урагш шилжүүлдэг. ${w} гэсэн үг энэ кодоор хэрхэн бичигдэх вэ?`,
      explanation: decode ? `Кодлосон үсэг бүр жинхэнэ үсгээс ${k} байр урагш тул үсэг бүрийг ${k} байр хойш буцаана: ${coded} → ${w}.` : `Үсэг бүрийг ${k} байр урагш шилжүүлнэ: ${w.split("").map((c) => `${c}→${ALPHA[ALPHA.indexOf(c) + k]}`).join(", ")}, үр дүн нь ${coded}.`,
    },
  };
}

// ------------------------------------------------------------------ overlapping groups

const CLUBS: { en: string; mn: string }[] = [
  { en: "chess", mn: "шатрын" }, { en: "football", mn: "хөлбөмбөгийн" }, { en: "basketball", mn: "сагсан бөмбөгийн" },
  { en: "swimming", mn: "усан сэлэлтийн" }, { en: "tennis", mn: "теннисийн" },
];

function clubs(r: R, diff: Diff): QDef | null {
  const [c1, c2] = shuffle(CLUBS, r).slice(0, 2);
  const both = int(r, 2, 9), only1 = int(r, 3, 14), only2 = int(r, 3, 14), none = int(r, 2, 8);
  const total = only1 + only2 + both + none, a = only1 + both, b = only2 + both;
  const askBoth = diff === 4;
  const value = askBoth ? both : only1;
  const traps = askBoth ? [a + b - total, a + b, Math.abs(a - b), total - none - a] : [a, b - both, total - none - b, only2];
  const wrong = wrongNumbers(r, value, traps, 1);
  if (!wrong) return null;
  const premise = {
    en: `In a group of ${total} students, ${a} are in the ${c1.en} club, ${b} are in the ${c2.en} club and ${none} are in neither.`,
    mn: `Нэг бүлэгт ${total} сурагч байна. Тэдний ${a} нь ${c1.mn} дугуйланд, ${b} нь ${c2.mn} дугуйланд явдаг, ${none} нь аль ч дугуйланд явдаггүй.`,
  };
  return {
    cat: "logical", diff,
    prompt: askBoth ? `${premise.en} How many are in both clubs?` : `${premise.en} How many are only in the ${c1.en} club?`,
    right: L(String(value)), wrong: wrong.map((x) => L(String(x))),
    explanation: askBoth
      ? `${total} − ${none} = ${total - none} students are in at least one club. Adding the two clubs counts the overlap twice: ${a} + ${b} = ${a + b}, so ${a + b} − ${total - none} = ${both} are in both.`
      : `${total} − ${none} = ${total - none} are in at least one club, and ${a} + ${b} − ${total - none} = ${both} are in both. Only the ${c1.en} club: ${a} − ${both} = ${only1}.`,
    mn: {
      prompt: askBoth ? `${premise.mn} Хэд нь хоёуланд нь явдаг вэ?` : `${premise.mn} Хэд нь зөвхөн ${c1.mn} дугуйланд явдаг вэ?`,
      explanation: askBoth
        ? `${total} − ${none} = ${total - none} сурагч ядаж нэг дугуйланд явдаг. ${a} + ${b} = ${a + b} нь давхцлыг хоёр удаа тоолсон тул хоёуланд нь явдаг нь ${a + b} − ${total - none} = ${both}.`
        : `Ядаж нэг дугуйланд ${total} − ${none} = ${total - none} сурагч явдаг, хоёуланд нь явдаг нь ${a} + ${b} − ${total - none} = ${both}. Зөвхөн ${c1.mn} дугуйланд: ${a} − ${both} = ${only1}.`,
    },
  };
}

// ------------------------------------------------------------------ assembly

const MAKERS: Record<Diff, ((r: R, d: Diff) => QDef | null)[]> = {
  1: [letterSeries, ordering, weekday],
  2: [ordering, weekday, month, conditional, letterSeries],
  3: [syllogism, ordering, (r, d) => letterCode(r, d, false), letterWeave, conditional],
  4: [syllogism, clubs, (r, d) => letterCode(r, d, false), conditional],
  5: [syllogism, clubs, ordering, (r, d) => letterCode(r, d, true)],
};
/** How many of each maker per difficulty (sums to 24). */
const SHARE: Record<Diff, number[]> = { 1: [8, 8, 8], 2: [5, 5, 4, 5, 5], 3: [6, 6, 5, 3, 4], 4: [6, 6, 6, 6], 5: [6, 6, 6, 6] };

/** 120 questions, grouped by difficulty (24 each), deterministic. */
export function generateLogical(seen: Set<string> = new Set()): QDef[] {
  const r = rng(0x4c4f4731); // "LOG1"
  const out: QDef[] = [];
  for (const diff of DIFFS) {
    MAKERS[diff].forEach((make, i) => out.push(...collect(SHARE[diff][i], seen, () => make(r, diff), `logical ${diff}/${i}`)));
  }
  return out;
}
