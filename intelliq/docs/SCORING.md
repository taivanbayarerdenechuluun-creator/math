# Scoring

Implemented in `src/lib/scoring.ts` (pure, unit-tested). Scores are always computed on the server from the
stored selections when the test is finalized. Anything a client sends about its score is ignored.

## Concepts kept separate
| Concept | Meaning | Status |
|---|---|---|
| Raw score | correct / total questions | computed |
| Accuracy | correct / total, as a percentage | computed |
| Cognitive performance score | difficulty-weighted accuracy, 0–100 | computed |
| Percentile rank | position within a reference population | **not computed**: no validated norm sample exists |
| Estimated IQ | norm-referenced ability estimate | **not computed**: same reason; we do not invent one |

## Cognitive performance score
`performance = 100 × Σ(w·correct) / Σ(w)` where `w` is the difficulty (1–5) of each served question.
- Hard questions count more, so a path through easy questions cannot equal a path through hard ones.
- An unanswered served question counts as incorrect at its own weight.
- Questions never reached (early submit or timeout) count as incorrect at weight 1.
- Category scores use the same formula within the category.

Because adaptive tests serve different questions to different people, scores are only comparable between
runs of the same assessment version. The results page says so.

## Limitations (shown to users)
INTELLIQ is a practice tool, not a clinically validated instrument. Results vary with sleep, focus,
familiarity and test conditions. Any IQ or percentile claim would require norming on a representative sample.
