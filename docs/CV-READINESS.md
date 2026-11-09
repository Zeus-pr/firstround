# CV readiness (v1)

Deterministic scorer + Grok extraction. The model fills a fact schema; First Round's algorithm owns the score.

## Weights

| Dimension             | Weight |
| --------------------- | -----: |
| Evidence completeness |   0.20 |
| Outcome quality       |   0.25 |
| Target-role coverage  |   0.25 |
| Career consistency    |   0.15 |
| Communication clarity |   0.15 |

Missing metrics lower proof quality; they do not invent failure. Career gaps and non-linear paths are never penalized. Contact email, location, and links are a separate sendability checklist.

Bands: 85+ ready, 70–84 improve, below 70 limited.

## API (Bearer Firebase token)

1. `POST /files/upload-url` with purpose `cv`
2. Client PUT to R2
3. `POST /cv/register` `{ fileKey, contentType, sizeBytes, originalFilename? }`
4. `POST /cv/analyze` `{ cvDocumentId }` → facts + readiness
5. `GET /cv/readiness/latest`

## Env (api)

| Variable       | Required    | Notes                           |
| -------------- | ----------- | ------------------------------- |
| `XAI_API_KEY`  | for analyze | xAI / Grok key                  |
| `XAI_MODEL`    | optional    | default `grok-4-fast-reasoning` |
| `XAI_BASE_URL` | optional    | default `https://api.x.ai/v1`   |

Without `XAI_API_KEY`, register still works; analyze returns 503.
