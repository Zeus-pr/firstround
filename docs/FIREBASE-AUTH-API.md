# Firebase Auth on the Nest API

Project: **`firstround-space`** (account `prajeshchoudhury42@gmail.com`).

The browser signs in with the Firebase Web SDK and sends `Authorization: Bearer <ID_TOKEN>` on protected API calls. Nest verifies the token with **firebase-admin** (`checkRevoked: true`). `ownerId` for R2 keys is always the verified `uid`, never a body field.

## Protected routes

All `/files/*` endpoints require a valid Bearer token:

- `GET /files/status`
- `POST /files/upload-url` — body `{ purpose, contentType, sizeBytes }`
- `POST /files/download-url` — body `{ fileKey }`

Public (no auth): `/health`, `POST /waitlist`.

## Railway env (api service)

| Variable                | Notes                                               |
| ----------------------- | --------------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | `firstround-space`                                  |
| `FIREBASE_CLIENT_EMAIL` | Service account email                               |
| `FIREBASE_PRIVATE_KEY`  | PEM; store newlines as `\n` in the Railway variable |

Production boot fails if these are missing.

## Create the service account (one-time)

1. Open [Firebase Console → Project settings → Service accounts](https://console.firebase.google.com/project/firstround-space/settings/serviceaccounts/adminsdk) while logged in as `prajeshchoudhury42@gmail.com`.
2. Generate a new private key (JSON). Do not commit it.
3. From the JSON, set on Railway **api**:
   - `FIREBASE_PROJECT_ID` ← `project_id`
   - `FIREBASE_CLIENT_EMAIL` ← `client_email`
   - `FIREBASE_PRIVATE_KEY` ← `private_key` (keep `\n` escapes)

Locally you can put the same three vars in `apps/api/.env` (gitignored), or set `GOOGLE_APPLICATION_CREDENTIALS` to the JSON path.

## Client header

```http
Authorization: Bearer <firebaseIdToken>
```

Get the token with `await user.getIdToken()` after Firebase sign-in on the web app.
