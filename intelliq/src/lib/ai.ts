import Anthropic from "@anthropic-ai/sdk";
import type { Feedback } from "./feedback";

export type AiInput = {
  assessment: string;
  performance: number;
  accuracy: number;
  total: number;
  correct: number;
  unanswered: number;
  durationSec: number;
  categories: { name: string; correct: number; total: number; performance: number; hardestCorrect: number | null }[];
  feedback: Pick<Feedback, "strengths" | "improvements" | "observations">;
};

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** Default model for this feature. Override with ANTHROPIC_MODEL. */
export const DEFAULT_AI_MODEL = "claude-opus-5-5";

const SYSTEM = [
  "You are a supportive learning coach inside INTELLIQ, a practice cognitive-skills app.",
  "Use ONLY the data provided. Do not invent numbers, scores, norms or comparisons with other people.",
  "Never state, estimate or imply an IQ score or percentile. This is a practice tool, not a validated IQ test.",
  "Domains with fewer than 3 questions are low-confidence; say so when relevant.",
  "Write 2 short paragraphs of plain-language explanation, then 3 concrete practice recommendations as a bulleted list, tied to the weakest domains in the data.",
  "No headings, no markdown other than '- ' bullets. Keep it under 220 words.",
].join(" ");

/** Pure: builds the user message. Contains no personal identifiers. */
export function buildAiPrompt(i: AiInput, lang: "en" | "mn"): string {
  const lines = i.categories.map(
    (c) => `- ${c.name}: ${c.correct}/${c.total} correct, performance ${c.performance}%${c.hardestCorrect ? `, hardest correct difficulty ${c.hardestCorrect}/5` : ""}`,
  );
  return [
    `Write in ${lang === "mn" ? "Mongolian (Монгол хэл)" : "English"}.`,
    `Assessment: ${i.assessment}`,
    `Overall: performance ${i.performance}/100 (difficulty-weighted), accuracy ${i.accuracy}%, ${i.correct}/${i.total} correct, ${i.unanswered} unanswered, ${Math.round(i.durationSec / 60)} min.`,
    "Domains:",
    ...lines,
    "Rule-based observations already shown to the user (do not contradict them):",
    ...[...i.feedback.strengths, ...i.feedback.improvements, ...i.feedback.observations].map((b) => `- ${b.en}`),
  ].join("\n");
}

/**
 * Calls Claude through the official SDK. The client reads ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL, used by
 * the tests' mock provider) from the environment.
 *
 * - Thinking is on by default for this model, and thinking tokens count toward max_tokens, so max_tokens is
 *   generous and effort is `low` (a ~200-word explanation does not need deep reasoning).
 * - No sampling parameters and no prefill: both are rejected by current models.
 * - Server-side refusal fallback (`fallbacks: "default"`) is requested; a refusal that still comes back is
 *   surfaced as an error and never cached.
 */
export async function generateAiInsight(i: AiInput, lang: "en" | "mn"): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI not configured");
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  let res;
  try {
    res = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_AI_MODEL,
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: buildAiPrompt(i, lang) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new Error(`AI provider error ${e.status ?? "network"}`);
    throw e;
  }
  if (res.stop_reason === "refusal") throw new Error("AI request was declined by the provider's safeguards");
  const text = res.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error(res.stop_reason === "max_tokens" ? "AI response was cut off before any text" : "Empty AI response");
  return text;
}
