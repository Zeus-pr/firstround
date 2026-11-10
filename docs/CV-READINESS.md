# CV readiness (v2 · LetterProof)

Deterministic scorer + Grok extraction + vision for hard PDFs. The model fills a fact schema with per-field confidence; First Round's algorithm owns the score.

## Unique product rules

- Soft priors: ordinary CVs land in **supercharge**, not failure.
- Career gaps and non-linear paths are never penalized.
- Missing metrics lower proof quality; they do not invent failure.
- Outcome and clarity count proof lines. Extra specific lines cannot dilute a score.
- Suggestions coach the CV already on the desk. They do not rewrite it and they do not change the stored score.
- Low extract confidence softens certainty; it does not invent a harsh fail.
- Dual coaching lists: **genuine gaps** vs **under-emphasised**.
- Never claim this is a universal ATS score. It is First Round LetterProof.

## Bands

| Score  | Band          | CTA         |
| ------ | ------------- | ----------- |
| 80–100 | `ready`       | Continue    |
| 60–79  | `supercharge` | Suggestions |
| 0–59   | `strengthen`  | Strengthen  |

## Weights

| Dimension             | Weight |
| --------------------- | -----: |
| Evidence completeness |   0.20 |
| Outcome quality       |   0.25 |
| Target-role coverage  |   0.25 |
| Career consistency    |   0.15 |
| Communication clarity |   0.15 |

Contact email, location, and links are a separate sendability checklist outside the weighted total.

## Parse pipeline

1. Text layer (pdf-parse / mammoth)
2. If sparse or multi-column suspected → render first pages (max 3)
3. Grok vision on those page images (layout-aware). No local Tesseract OCR.
4. Taxonomy normalize skills/titles (`taxonomy-v1`)
5. Score with confidence blend + soft prior

## API (Bearer Firebase token)

1. `POST /files/upload-url` with purpose `cv`
2. Client PUT to R2
3. `POST /cv/register` `{ fileKey, contentType, sizeBytes, originalFilename? }`
4. `POST /cv/analyze` `{ cvDocumentId }` → facts + readiness (band, recommendation, checks, confidence, parse, normalized). The API hashes the file bytes. If this account already has a score for that hash, that score is returned and the duplicate file is deleted.
5. `POST /cv/suggestions` `{ cvDocumentId }` → short coaching lines from the stored score plus one fast model call (same handler as `POST /cv/supercharge`). Costs 5 credits when the model answers; a model failure returns the algorithm gaps and does not debit. The stored total does not change.
6. `GET /cv/readiness/latest` → score plus any saved suggestions
7. `GET /cv/documents/:id/download` → short-lived URL for that account's file
8. `DELETE /cv/documents/:id` → removes that CV, its score, and the stored file. Another account's id returns 404. The last CV on the account sets onboarding back to `account`.
9. `GET /credits` → balance + supercharge cost

## Suggestions credits

| Item      | Value                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Cost      | 5 credits when the model returns grounded lines (production)                                             |
| Ledger    | `credit_ledger`, idempotent per CV extraction (`cv_supercharge:`)                                        |
| Test mode | `CREDITS_TEST_MODE=1` (or non-production): no debit, auto-top balance to 1000                            |
| Model     | `grok-4.20-0309-non-reasoning` (override with `XAI_SUGGESTIONS_MODEL`). 20s cap, then the algorithm gaps |

Skip the model on the web: show `genuineGaps` / `underEmphasised`; no debit.

## Env (api)

| Variable                | Required    | Notes                                              |
| ----------------------- | ----------- | -------------------------------------------------- |
| `XAI_API_KEY`           | for analyze | xAI / Grok key                                     |
| `XAI_MODEL`             | optional    | extract default `grok-4.3`                         |
| `XAI_SUGGESTIONS_MODEL` | optional    | suggestions default `grok-4.20-0309-non-reasoning` |
| `XAI_BASE_URL`          | optional    | default `https://api.x.ai/v1`                      |

Without `XAI_API_KEY`, register still works; analyze returns 503.
Page render soft-fails to text-only if canvas/pdfjs fails; vision still needs `XAI_API_KEY`.
