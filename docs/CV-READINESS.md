# CV readiness (v2 · LetterProof)

Deterministic scorer + Grok extraction + OCR/vision for hard PDFs. The model fills a fact schema with per-field confidence; First Round's algorithm owns the score.

## Unique product rules

- Soft priors: ordinary CVs land in **supercharge**, not failure.
- Career gaps and non-linear paths are never penalized.
- Missing metrics lower proof quality; they do not invent failure.
- Low extract confidence softens certainty; it does not invent a harsh fail.
- Dual coaching lists: **genuine gaps** vs **under-emphasised**.
- Never claim this is a universal ATS score. It is First Round LetterProof.

## Bands

| Score  | Band          | CTA         |
| ------ | ------------- | ----------- |
| 80–100 | `ready`       | Continue    |
| 60–79  | `supercharge` | Supercharge |
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
2. If sparse or multi-column suspected → render first pages → OCR (tesseract)
3. If still hard → Grok vision on page images (layout-aware)
4. Taxonomy normalize skills/titles (`taxonomy-v1`)
5. Score with confidence blend + soft prior

## API (Bearer Firebase token)

1. `POST /files/upload-url` with purpose `cv`
2. Client PUT to R2
3. `POST /cv/register` `{ fileKey, contentType, sizeBytes, originalFilename? }`
4. `POST /cv/analyze` `{ cvDocumentId }` → facts + readiness (band, recommendation, checks, confidence, parse, normalized)
5. `GET /cv/readiness/latest`

## Env (api)

| Variable       | Required    | Notes                           |
| -------------- | ----------- | ------------------------------- |
| `XAI_API_KEY`  | for analyze | xAI / Grok key                  |
| `XAI_MODEL`    | optional    | default `grok-4-fast-reasoning` |
| `XAI_BASE_URL` | optional    | default `https://api.x.ai/v1`   |

Without `XAI_API_KEY`, register still works; analyze returns 503.
OCR/vision soft-fail to text-only if render libs fail.
