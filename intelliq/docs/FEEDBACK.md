# Personalised feedback

## Rule-based engine (always on)
`src/lib/feedback.ts`: pure and deterministic, bilingual (en/mn), covered by `feedback.test.ts`.
Every sentence is generated from the numbers of that attempt; nothing is written that the data does not show.

| Output | Rule |
|---|---|
| Strongest domain | highest performance among domains with >= 2 questions (needs >= 2 such domains) |
| Also strong | other domains >= 75% |
| Hard items | domain where a difficulty 4-5 question was answered correctly |
| Areas for improvement | weakest domain if < 60% or >= 20 points below the best; others < 50%; **capped at the weakest 3** |
| Balanced profile | >= 3 domains and best-to-worst gap < 15 points |
| Unanswered | >= 20% unanswered (explains that unanswered counts as incorrect) |
| Speed time-outs | any unanswered processing-speed items |
| Previous attempt | same signed-in user, same assessment: overall delta, plus the **three largest** domain changes (>= 10 points) |
| Recommendations | practice tips for the weakest domains only; a maintenance tip when nothing is weak |
| Low confidence | fewer than 10 questions, or no domain with >= 2 questions: says domain comparisons are tentative |

Comparisons always carry the caveat that different questions may have been served and that this is
practice progress, not a change in IQ. Guests have no history, so they get no comparison.

## Optional AI explanation
`src/lib/ai.ts` + `POST /api/results/[id]/insights`. Disabled unless `ANTHROPIC_API_KEY` is set.
- Runs only when the user clicks the button; the result is cached per language on the result row.
- Sends **only aggregate numbers** (scores, domain names, counts). No name, email or account id.
- The system prompt forbids stating or estimating an IQ or percentile, forbids invented numbers, and asks for caution on domains with < 3 questions.
- Only the result's owner may request it; rate-limited to 6 per hour per IP.
- Uses the official `@anthropic-ai/sdk`. Env: `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`), optional `ANTHROPIC_BASE_URL`.
- Request: low effort, `max_tokens` large enough for the model's own reasoning, no sampling parameters, the server-side fallback beta, 45 s timeout and one retry. A refusal, a cut-off answer, an empty answer or a provider error is reported as a failure; none of them touches the rule-based feedback.
- If the provider fails, the page shows an error and the rule-based feedback is unaffected.

## Verification status
The request shape (auth header, beta header, parameters it must not send), caching, privacy and failure handling are tested against a local mock provider (`src/lib/ai.test.ts`, `tests/03`).
It has **not** been exercised against the live Anthropic API, because no key was available.
