import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import { dictionaries, type Key } from "./i18n";
import type { FullResult } from "./results";
import type { Bi } from "./feedback";

type Lang = "en" | "mn";
type Doc = InstanceType<typeof PDFDocument>;

const VIOLET = "#8B5CF6";
const BLUE = "#3B82F6";
const CYAN = "#22D3EE";
const INK = "#0B1020";
const MUTED = "#55627A";
const LINE = "#D9DEEA";
const SOFT = "#F3F4FA";

const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans", "files");
const FONTS: Record<string, string> = {
  L: "noto-sans-latin-400-normal.woff", LB: "noto-sans-latin-700-normal.woff",
  C: "noto-sans-cyrillic-400-normal.woff", CB: "noto-sans-cyrillic-700-normal.woff",
  X: "noto-sans-cyrillic-ext-400-normal.woff", XB: "noto-sans-cyrillic-ext-700-normal.woff",
};

// Mongolian needs Cyrillic plus the extended block for Ө/Ү, so text is split into script runs.
const EXT = /[Ѡ-ԯ]/;
const CYR = /[Ѐ-џҐґҰұ№]/;
const script = (ch: string) => (EXT.test(ch) ? "X" : CYR.test(ch) ? "C" : "L");

export function splitRuns(text: string): { script: "L" | "C" | "X"; text: string }[] {
  const runs: { script: "L" | "C" | "X"; text: string }[] = [];
  for (const ch of text) {
    const s = /\s/.test(ch) && runs.length ? runs[runs.length - 1].script : (script(ch) as "L" | "C" | "X");
    if (runs.length && runs[runs.length - 1].script === s) runs[runs.length - 1].text += ch;
    else runs.push({ script: s, text: ch });
  }
  return runs;
}

const NEWLINE = String.fromCharCode(10);
const WHITESPACE = new RegExp(String.raw`\s+`);

function setup(doc: Doc) {
  for (const [k, f] of Object.entries(FONTS)) doc.registerFont(k, path.join(FONT_DIR, f));
}

/**
 * Writes text with manual layout. PDFKit's "continued" text cannot align or wrap runs that use different
 * fonts, so each word is measured per script run, lines are broken between whole words only, and
 * left/center/right alignment uses the measured line width. Updates doc.y to just below the text.
 */
function write(doc: Doc, text: string, o: { size?: number; bold?: boolean; color?: string; x?: number; y?: number; width?: number; align?: "left" | "center" | "right"; gap?: number } = {}) {
  const size = o.size ?? 10;
  const x0 = o.x ?? doc.x;
  const y0 = o.y ?? doc.y;
  const width = o.width ?? doc.page.width - doc.page.margins.right - x0;
  const lh = size * 1.28 + (o.gap ?? 2);
  const fontFor = (sc: string) => sc + (o.bold ? "B" : "");
  doc.fontSize(size).fillColor(o.color ?? INK);

  const runWidth = (r: { script: string; text: string }) => (doc.font(fontFor(r.script)), doc.widthOfString(r.text));
  doc.font(fontFor("L"));
  const space = doc.widthOfString(" ");

  type Word = { runs: ReturnType<typeof splitRuns>; w: number };
  let cy = y0;
  const flush = (line: Word[]) => {
    const lw = line.reduce((acc, w) => acc + w.w, 0) + space * Math.max(0, line.length - 1);
    let cx = x0 + (o.align === "center" ? (width - lw) / 2 : o.align === "right" ? width - lw : 0);
    for (const [i, w] of line.entries()) {
      if (i) cx += space;
      for (const r of w.runs) {
        doc.font(fontFor(r.script)).text(r.text, cx, cy, { lineBreak: false });
        cx += runWidth(r);
      }
    }
    cy += lh;
  };

  for (const para of text.split(NEWLINE)) {
    const words: Word[] = para.split(WHITESPACE).filter(Boolean).map((wd) => {
      const runs = splitRuns(wd);
      return { runs, w: runs.reduce((acc, r) => acc + runWidth(r), 0) };
    });
    if (!words.length) { cy += lh * 0.6; continue; }
    let line: Word[] = [];
    let lw = 0;
    for (const w of words) {
      const add = line.length ? space + w.w : w.w;
      if (line.length && lw + add > width) { flush(line); line = [w]; lw = w.w; }
      else { line.push(w); lw += add; }
    }
    flush(line);
  }
  doc.x = x0;
  doc.y = cy;
}

const hexagon = (doc: Doc, cx: number, cy: number, r: number) => {
  const pts = Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos((Math.PI / 3) * i - Math.PI / 2), cy + r * Math.sin((Math.PI / 3) * i - Math.PI / 2)]);
  doc.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) doc.lineTo(p[0], p[1]);
  doc.closePath();
};

function radar(doc: Doc, cx: number, cy: number, R: number, items: { label: string; value: number }[]) {
  const n = items.length;
  const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))] as const;
  for (const f of [0.25, 0.5, 0.75, 1]) {
    items.forEach((_, i) => (i === 0 ? doc.moveTo(...pt(i, R * f)) : doc.lineTo(...pt(i, R * f))));
    doc.closePath().lineWidth(0.6).strokeColor(LINE).stroke();
  }
  items.forEach((_, i) => doc.moveTo(cx, cy).lineTo(...pt(i, R)).lineWidth(0.5).strokeColor(LINE).stroke());
  items.forEach((it, i) => (i === 0 ? doc.moveTo(...pt(i, (R * it.value) / 100)) : doc.lineTo(...pt(i, (R * it.value) / 100))));
  doc.closePath().fillOpacity(0.28).fillAndStroke(VIOLET, VIOLET).fillOpacity(1);
  items.forEach((it, i) => {
    const [x, y] = pt(i, (R * it.value) / 100);
    doc.circle(x, y, 2.4).fill(VIOLET);
    const [lx, ly] = pt(i, R + 14);
    const w = 90;
    const al = Math.abs(lx - cx) < 8 ? "center" : lx > cx ? "left" : "right";
    const x0 = al === "center" ? lx - w / 2 : al === "left" ? lx : lx - w;
    write(doc, `${it.label}`, { size: 8, color: MUTED, x: x0, y: ly - 5, width: w, align: al });
  });
}

export async function buildReportPdf(r: FullResult, lang: Lang): Promise<Buffer> {
  const dict = dictionaries[lang];
  const t = (k: Key) => dict[k];
  const tt = (en: string, mn: string) => (lang === "mn" ? mn : en);

  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `INTELLIQ report ${r.reportCode}`, Author: "INTELLIQ", Subject: "Practice cognitive assessment report" }, bufferPages: true });
  setup(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const W = doc.page.width, M = 48, CW = W - M * 2;
  const bottom = () => doc.page.height - 70;
  const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };
  const title = lang === "mn" ? r.titleMn : r.titleEn;

  // ----- header -----
  const g = doc.linearGradient(0, 0, W, 0);
  g.stop(0, VIOLET).stop(0.6, BLUE).stop(1, CYAN);
  doc.rect(0, 0, W, 110).fill(g);
  hexagon(doc, M + 16, 45, 16);
  doc.lineWidth(2.4).strokeColor("#FFFFFF").stroke();
  doc.circle(M + 16, 45, 4).fill("#FFFFFF");
  write(doc, "INTELLIQ", { size: 22, bold: true, color: "#FFFFFF", x: M + 44, y: 30 });
  write(doc, tt("Practice assessment report", "Дадлага тестийн тайлан"), { size: 11, color: "#EAF2FF", x: M + 44, y: 58 });
  write(doc, `${t("r.code")}: ${r.reportCode}`, { size: 9, color: "#FFFFFF", x: M, y: 86, width: CW, align: "right" });
  write(doc, `${title}  ·  ${r.createdAt.slice(0, 10)}`, { size: 10, color: "#FFFFFF", x: M, y: 86, width: CW * 0.7 });
  doc.y = 130;

  // ----- overall -----
  const top = doc.y;
  const ringX = M + 52, ringY = top + 52, ringR = 40;
  doc.circle(ringX, ringY, ringR).lineWidth(9).strokeColor(LINE).stroke();
  const frac = Math.max(0.001, Math.min(1, r.performance / 100));
  const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * frac;
  const sx = ringX + ringR * Math.cos(a0), sy = ringY + ringR * Math.sin(a0);
  const ex = ringX + ringR * Math.cos(a1), ey = ringY + ringR * Math.sin(a1);
  // A full circle cannot be drawn as one arc (start == end), so 100% is a plain circle.
  if (frac >= 0.999) doc.circle(ringX, ringY, ringR).lineWidth(9).strokeColor(VIOLET).stroke();
  else doc.path(`M ${sx} ${sy} A ${ringR} ${ringR} 0 ${frac > 0.5 ? 1 : 0} 1 ${ex} ${ey}`).lineWidth(9).lineCap("round").strokeColor(VIOLET).stroke();
  write(doc, String(r.performance), { size: 24, bold: true, x: ringX - 40, y: ringY - 15, width: 80, align: "center" });
  write(doc, "/ 100", { size: 8, color: MUTED, x: ringX - 40, y: ringY + 12, width: 80, align: "center" });

  const stats: [string, string][] = [
    [t("r.raw"), `${r.correct} / ${r.total}`], [t("r.accuracy"), `${r.accuracy}%`], [t("r.time"), `${Math.floor(r.durationSec / 60)}:${String(r.durationSec % 60).padStart(2, "0")}`],
    [t("r.correct"), String(r.correct)], [t("r.incorrect"), String(r.incorrect)], [t("r.unanswered"), String(r.unanswered)],
  ];
  const sx0 = M + 130, bw = (CW - 130 - 16) / 3;
  stats.forEach(([label, val], i) => {
    const x = sx0 + (i % 3) * (bw + 8), y = top + 6 + Math.floor(i / 3) * 52;
    doc.roundedRect(x, y, bw, 44, 6).fill(SOFT);
    write(doc, val, { size: 15, bold: true, x, y: y + 7, width: bw, align: "center" });
    write(doc, label, { size: 7.5, color: MUTED, x, y: y + 28, width: bw, align: "center" });
  });
  doc.y = top + 118;
  write(doc, `${t("r.perf")}: ${t("r.perf.d")}`, { size: 8, color: MUTED, x: M, y: doc.y, width: CW });
  doc.moveDown(0.8);

  // ----- radar + category breakdown -----
  const catName = (slug: string) => dict[`cat.${slug}` as Key];
  const section = (label: string) => { ensure(60); doc.moveDown(0.4); write(doc, label, { size: 13, bold: true, x: M, y: doc.y, width: CW }); doc.moveDown(0.3); };

  section(t("r.radar"));
  if (r.categories.length >= 3) {
    ensure(230);
    radar(doc, W / 2, doc.y + 105, 78, r.categories.map((c) => ({ label: catName(c.slug), value: c.performance })));
    doc.y += 205;
  } else write(doc, t("r.radar.min"), { size: 9, color: MUTED, x: M, y: doc.y, width: CW });

  section(t("r.details"));
  for (const c of r.categories) {
    ensure(34);
    const y = doc.y;
    write(doc, catName(c.slug), { size: 10, bold: true, x: M, y, width: CW * 0.5 });
    write(doc, `${c.correct}/${c.total}  ·  ${c.performance}%`, { size: 9, color: MUTED, x: M, y, width: CW, align: "right" });
    doc.roundedRect(M, y + 15, CW, 6, 3).fill(LINE);
    if (c.performance > 0) doc.roundedRect(M, y + 15, (CW * c.performance) / 100, 6, 3).fill(VIOLET);
    doc.y = y + 28;
  }

  // ----- feedback -----
  const fb = r.feedback;
  section(t("r.fb"));
  write(doc, fb.summary[lang], { size: 10, x: M, y: doc.y, width: CW });
  doc.moveDown(0.5);
  const list = (label: string, items: Bi[], color: string) => {
    if (!items.length) return;
    ensure(40);
    write(doc, label, { size: 10.5, bold: true, color, x: M, y: doc.y, width: CW });
    doc.moveDown(0.15);
    for (const b of items) {
      ensure(30);
      const y = doc.y;
      doc.circle(M + 4, y + 5, 1.8).fill(color);
      write(doc, b[lang], { size: 9.5, x: M + 14, y, width: CW - 14 });
    }
    doc.moveDown(0.4);
  };
  list(t("r.fb.strengths"), fb.strengths, "#059669");
  list(t("r.fb.improve"), fb.improvements, "#D97706");
  list(t("r.fb.obs"), fb.observations, "#0891B2");
  list(t("r.fb.recs"), fb.recommendations, VIOLET);

  // ----- methodology -----
  ensure(150);
  doc.moveDown(0.6);
  const my = doc.y;
  doc.roundedRect(M, my, CW, 128, 8).fill(SOFT);
  write(doc, tt("Methodology and limitations", "Арга зүй ба хязгаарлалт"), { size: 11, bold: true, x: M + 14, y: my + 12, width: CW - 28 });
  write(doc, [
    tt("Questions are served adaptively: within each cognitive domain, two correct answers in a row raise the difficulty and a miss lowers it. The performance score is difficulty-weighted accuracy (0-100) and is only comparable between runs of the same assessment version.",
      "Асуултууд дасан зохицох байдлаар ирдэг: чадвар бүрт дараалан хоёр зөв хариулбал хүндрэл нэмэгдэж, алдвал буурна. Гүйцэтгэлийн оноо нь хүндрэлээр жинлэсэн нарийвчлал (0-100) бөгөөд зөвхөн ижил хувилбартай тестүүдийн хооронд харьцуулагдана."),
    tt("This is a practice tool, not a clinically validated instrument. It does not report an IQ score or a percentile rank because those require a validated norm sample. Results vary with sleep, focus and familiarity. Domains with fewer than 3 questions are low-confidence.",
      "Энэ бол дасгалын хэрэгсэл бөгөөд клиникийн баталгаажсан хэрэгсэл биш. Баталгаажсан норм түүвэр шаардлагатай тул IQ оноо, хувь (percentile) гаргадаггүй. Үр дүн нойр, анхаарал, туршлагаас хамаарна. 3-аас цөөн асуулттай чадвар нь найдвар багатай."),
  ].join("\n\n"), { size: 8, color: MUTED, x: M + 14, y: my + 30, width: CW - 28 });
  doc.y = my + 140;

  // ----- footers -----
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 40;
    doc.moveTo(M, y - 8).lineTo(W - M, y - 8).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.page.margins.bottom = 0; // allow writing in the footer area without auto-paging
    write(doc, `INTELLIQ · ${r.reportCode} · ${tt("practice report, not an IQ test", "дадлагын тайлан, IQ тест биш")}`, { size: 7.5, color: MUTED, x: M, y, width: CW * 0.8 });
    write(doc, `${i + 1} / ${range.count}`, { size: 7.5, color: MUTED, x: M, y, width: CW, align: "right" });
  }
  doc.end();
  return finished;
}
