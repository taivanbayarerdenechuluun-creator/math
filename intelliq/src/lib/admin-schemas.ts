import { z } from "zod";
import { figKey, type Fig } from "./figures";

const shape = z.enum(["square", "circle", "triangle", "diamond", "star", "cross", "arrow"]);
const fill = z.enum(["solid", "outline", "light"]);

const glyph = z.object({ k: z.literal("glyph"), shape, rot: z.number().min(0).max(360).optional(), fill: fill.optional(), n: z.number().int().min(1).max(9).optional() }).strict();
const grid = z
  .object({ k: z.literal("grid"), cells: z.array(z.array(z.union([z.literal(0), z.literal(1)])).min(1).max(8)).min(1).max(8), full: z.boolean().optional() })
  .strict()
  .refine((g) => g.cells.every((r) => r.length === g.cells[0].length), "Grid rows must have equal length")
  .refine((g) => g.cells.some((r) => r.includes(1)), "Grid needs at least one filled cell");

const iso = z
  .object({ k: z.literal("iso"), heights: z.array(z.array(z.number().int().min(0).max(4)).min(1).max(4)).min(1).max(4) })
  .strict()
  .refine((g) => g.heights.every((r) => r.length === g.heights[0].length), "Stack rows must have equal length")
  .refine((g) => g.heights.some((r) => r.some((h) => h > 0)), "Stack needs at least one cube");

const reaction = z
  .object({ k: z.literal("reaction"), minMs: z.number().int().min(800).max(4000), maxMs: z.number().int().min(1000).max(6000), limitMs: z.number().int().min(600).max(3000) })
  .strict()
  .refine((r) => r.maxMs > r.minMs, "maxMs must be greater than minMs");

export const figureSchema = z.union([glyph, grid, iso]);
export const stemSchema = z.union([glyph, grid, iso, reaction, z.object({ k: z.literal("seq"), items: z.array(z.union([glyph, grid, iso, z.null()])).min(2).max(8) }).strict()]);

const optionSchema = z.object({
  id: z.string().max(40).optional(),
  label: z.string().trim().max(200).default(""),
  labelMn: z.string().trim().max(200).nullable().optional(),
  figure: figureSchema.nullable().optional(),
  isCorrect: z.boolean(),
});

const ASSET_URL = /^\/api\/assets\/[a-f0-9]{32}\.(png|jpg|webp|gif)$/;

export const questionSchema = z
  .object({
    categorySlug: z.string().min(2).max(20),
    prompt: z.string().trim().min(3).max(1000),
    difficulty: z.number().int().min(1).max(5),
    explanation: z.string().trim().min(3).max(2000),
    promptMn: z.string().trim().max(1000).nullable().default(null),
    explanationMn: z.string().trim().max(2000).nullable().default(null),
    stimulusMn: z.string().trim().max(300).nullable().default(null),
    timeLimitSec: z.number().int().min(5).max(300).nullable().default(null),
    stimulus: z.object({ text: z.string().trim().min(1).max(300).optional(), fig: figureSchema.optional() }).strict().refine((s) => s.text || s.fig, "Stimulus needs text or a figure").nullable().default(null),
    stimulusSec: z.number().int().min(2).max(60).nullable().default(null),
    figure: stemSchema.nullable().default(null),
    imageUrl: z.string().regex(ASSET_URL, "Image must be an uploaded asset").nullable().default(null),
    active: z.boolean().default(true),
    options: z.array(optionSchema).min(2).max(6),
  })
  .superRefine((q, ctx) => {
    const fail = (message: string, path: (string | number)[] = ["options"]) => ctx.addIssue({ code: "custom", message, path });
    if (q.options.filter((o) => o.isCorrect).length !== 1) fail("Exactly one option must be marked correct");
    q.options.forEach((o, i) => { if (!o.label && !o.figure) fail("Each option needs a label or a figure", ["options", i]); });
    const keys = q.options.map((o) => (o.figure ? figKey(o.figure as Fig) : `t:${o.label.toLowerCase()}`));
    if (new Set(keys).size !== keys.length) fail("Options must be distinct");
    if (q.figure?.k === "reaction") {
      if (q.options.length !== 4) fail("Reaction items need exactly four pads");
      const need = Math.ceil((q.figure.maxMs + q.figure.limitMs) / 1000) + 2;
      if (!q.timeLimitSec || q.timeLimitSec < need) fail(`Set a time limit of at least ${need} s (longest delay + limit + margin)`, ["timeLimitSec"]);
    }
    if (q.stimulus && !q.stimulusSec) fail("Set how many seconds the stimulus is shown", ["stimulusSec"]);
    if (!q.stimulus && q.stimulusSec) fail("stimulusSec needs a stimulus", ["stimulusSec"]);
  });

export type QuestionInput = z.infer<typeof questionSchema>;

export const assessmentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes").min(3).max(50),
  titleEn: z.string().trim().min(2).max(80),
  titleMn: z.string().trim().min(2).max(80),
  descEn: z.string().trim().min(2).max(300),
  descMn: z.string().trim().min(2).max(300),
  questionCount: z.number().int().min(3).max(60),
  durationSec: z.number().int().min(60).max(7200).nullable().default(null),
  adaptive: z.boolean().default(true),
  difficultyMin: z.number().int().min(1).max(5).default(1),
  difficultyMax: z.number().int().min(1).max(5).default(5),
  categoryWeights: z.record(z.string().min(2).max(20), z.number().int().min(1).max(5)).default({}),
  categorySlugs: z.array(z.string().min(2).max(20)).max(7).default([]),
  questionIds: z.array(z.string().min(1).max(40)).max(400).default([]),
  active: z.boolean().default(true),
}).refine((a) => a.difficultyMin <= a.difficultyMax, { message: "difficultyMin must not exceed difficultyMax", path: ["difficultyMin"] });

export const announcementSchema = z.object({ title: z.string().trim().min(2).max(100), body: z.string().trim().min(2).max(500) });
export const roleSchema = z.object({ name: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,19}$/, "UPPER_SNAKE_CASE, 3-20 chars") });
export const settingSchema = z.object({ key: z.enum(["maintenance", "registrationOpen", "leaderboardEnabled"]), value: z.enum(["0", "1"]) });
export const userUpdateSchema = z.object({ roleName: z.string().min(2).max(20).optional(), disabled: z.boolean().optional() });

export const ASSET_URL_PATTERN = ASSET_URL;
