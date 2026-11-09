# Cloudflare R2 storage (First Round)

Bucket: **`firstround-cv`** (APAC, private). The Nest API never proxies bytes. Clients upload/download with short-lived presigned URLs.

## Endpoints

- `GET /files/status` — whether R2 env is configured and the bucket is reachable
- `POST /files/upload-url` — `{ purpose, contentType, sizeBytes, ownerId }` → `{ fileKey, uploadUrl, method, headers, expiresAt }`
- `POST /files/download-url` — `{ fileKey, ownerId }` → `{ downloadUrl, expiresAt }`

Key layout: `<purpose>/<ownerId>/<yyyy>/<mm>/<uuid>.<ext>` (`purpose`: `cv` | `avatar` | `attachment`).

## Env

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=firstround-cv`, optional `R2_ENDPOINT`.

Create an R2 API token (Object Read & Write, scoped to `firstround-cv`) in the Cloudflare dashboard:

https://dash.cloudflare.com/e1e2ce8ab37dba30e2fed136e733d405/r2/api-tokens

Paste Access Key ID + Secret into Railway **api** service variables.

## CORS

Bucket CORS allows PUT/GET/HEAD from `https://firstround.space`, `https://www.firstround.space`, and local Next (`http://localhost:3000`, `http://127.0.0.1:3000`) with `content-type` / `content-length`.
