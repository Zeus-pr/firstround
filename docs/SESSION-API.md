# Session API

After Firebase signup or sign-in, the web app must call the Nest session endpoint so the user exists in Postgres (`users`, `workspaces`, `profiles`).

## Endpoints

Both require `Authorization: Bearer <Firebase ID token>`.

- `POST /session` — upsert the signed-in user; returns `{ ok: true, user }`
- `GET /session/me` — same upsert/read behavior

`user.created` is `true` only on the first insert.

## Onboarding step

`user.onboardingStep` starts at `account`, then advances through `cv` → `readiness` → `preferences` → `gmail` → `done` in later layers.

## Ops

Apply migration `0001_session_profile` on Railway Postgres (`pnpm --filter @firstround/db db:migrate` with `DATABASE_URL`).
