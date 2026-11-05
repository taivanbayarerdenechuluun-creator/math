import { abstract } from "./abstract";
import { logical } from "./logical";
import { memory } from "./memory";
import { numerical } from "./numerical";
import { spatial } from "./spatial";
import { speed } from "./speed";
import { verbal } from "./verbal";
import { spatial3d } from "./spatial3d";
import { reaction } from "./speed-reaction";
import { ABSTRACT_PROMPT_MN, mnAbstractExpl, mnLogical, mnNumerical, mnVerbal, type MnSpec } from "./mn";
import { GENERATED } from "./gen";
import type { QDef } from "./types";

const withMn = (list: QDef[], mn: MnSpec[]): QDef[] =>
  list.map((q, i) => ({ ...q, mn: { prompt: mn[i].p, explanation: mn[i].e, right: mn[i].r, wrong: mn[i].w } }));
const abstractMn: QDef[] = abstract.map((q, i) => ({ ...q, mn: { prompt: ABSTRACT_PROMPT_MN, explanation: mnAbstractExpl[i] } }));

// The 3D and reaction items are appended LAST so the global index of every earlier question (which seeds the
// deterministic option shuffle) stays the same as in databases that were seeded before they existed.
const ordered: QDef[] = [
  ...withMn(logical, mnLogical), ...abstractMn, ...withMn(numerical, mnNumerical), ...withMn(verbal, mnVerbal),
  ...spatial, ...memory, ...speed, ...spatial3d, ...reaction,
];

const counters: Record<string, number> = {};
/**
 * Every bank question with its Mongolian text and a stable key such as "numerical-007": first the 120 hand-written
 * questions, then the 840 generated ones (src/data/bank/gen). Keys count up within a category in this order, so the
 * hand-written questions keep the keys and option shuffles of databases seeded before the generated ones existed.
 */
export const BANK: QDef[] = [...ordered, ...GENERATED].map((q) => {
  counters[q.cat] = (counters[q.cat] ?? 0) + 1;
  return { ...q, key: `${q.cat}-${String(counters[q.cat]).padStart(3, "0")}` };
});

/** The 120 hand-written questions (the first entries of BANK); their tests assert exact, hand-verified content. */
export const CORE_BANK: QDef[] = BANK.slice(0, ordered.length);

export const CATEGORIES = [
  { slug: "logical", nameEn: "Logical Reasoning", nameMn: "Логик сэтгэлгээ", descEn: "Sequences, deductions and rule-finding.", descMn: "Дараалал, дүгнэлт, дүрэм олох." },
  { slug: "abstract", nameEn: "Abstract Reasoning", nameMn: "Хийсвэр сэтгэлгээ", descEn: "Patterns and relationships between shapes.", descMn: "Дүрс хоорондын хэв маяг, холбоо." },
  { slug: "numerical", nameEn: "Numerical Reasoning", nameMn: "Тооллын сэтгэлгээ", descEn: "Number series and quantitative problems.", descMn: "Тооны цуваа, тоон бодлого." },
  { slug: "verbal", nameEn: "Verbal Reasoning", nameMn: "Хэл зүйн сэтгэлгээ", descEn: "Analogies, vocabulary and relationships.", descMn: "Аналоги, үгсийн сан, холбоо." },
  { slug: "spatial", nameEn: "Spatial Reasoning", nameMn: "Орон зайн сэтгэлгээ", descEn: "Mental rotation and visualisation.", descMn: "Оюун ухаанаар эргүүлэх, дүрслэх." },
  { slug: "memory", nameEn: "Memory", nameMn: "Ой тогтоолт", descEn: "Short-term and working memory.", descMn: "Богино хугацааны болон ажлын ой." },
  { slug: "speed", nameEn: "Processing Speed", nameMn: "Боловсруулах хурд", descEn: "Rapid, accurate recognition.", descMn: "Хурдан бөгөөд үнэн зөв танилт." },
] as const;

export const ASSESSMENTS = [
  { slug: "full-battery", titleEn: "Full Cognitive Battery", titleMn: "Бүрэн танин мэдэхүйн багц", descEn: "A balanced test across all seven cognitive domains.", descMn: "Долоон чадварыг тэнцвэртэй хамарсан тест.", questionCount: 28, durationSec: 35 * 60, categorySlugs: "" },
  { slug: "reasoning-core", titleEn: "Reasoning Core", titleMn: "Сэтгэлгээний цөм", descEn: "Logical, abstract and numerical reasoning.", descMn: "Логик, хийсвэр, тооллын сэтгэлгээ.", questionCount: 18, durationSec: 20 * 60, categorySlugs: "logical,abstract,numerical" },
  { slug: "memory-speed", titleEn: "Memory & Speed", titleMn: "Ой ба хурд", descEn: "Working memory and processing speed.", descMn: "Ажлын ой ба боловсруулах хурд.", questionCount: 12, durationSec: null, categorySlugs: "memory,speed" },
  { slug: "quick-check", titleEn: "Quick Check", titleMn: "Хурдан шалгалт", descEn: "Ten adaptive questions across all domains.", descMn: "Бүх чадварыг хамарсан арван асуулт.", questionCount: 10, durationSec: null, categorySlugs: "" },
  ...CATEGORIES.map((c) => ({
    slug: `${c.slug}-focus`,
    titleEn: `${c.nameEn} Focus`,
    titleMn: `${c.nameMn} — дасгал`,
    descEn: `Eight adaptive questions on ${c.nameEn.toLowerCase()}.`,
    descMn: `${c.nameMn}-ийн тухай найман асуулт.`,
    questionCount: 8,
    durationSec: null,
    categorySlugs: c.slug as string,
  })),
];
