# Gmail connect (pilot)

Connects a test-user Gmail mailbox to First Round. Does not send mail yet.

## Scopes

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`

## API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/gmail/status` | Bearer | `{ connected, email, scopes, onboardingStep }` |
| `POST` | `/gmail/connect` | Bearer | `{ authorizeUrl }` — redirect the browser |
| `GET` | `/gmail/callback` | none | Google redirect; stores encrypted refresh token; redirects to `/desk` |
| `DELETE` | `/gmail/disconnect` | Bearer | Removes the stored grant |

## Railway api env

| Variable | Notes |
| --- | --- |
| `GOOGLE_GMAIL_CLIENT_ID` | OAuth Web client “First Round Gmail” |
| `GOOGLE_GMAIL_CLIENT_SECRET` | Same client |
| `GOOGLE_GMAIL_REDIRECT_URI` | `https://api.firstround.space/gmail/callback` |
| `LOCAL_KEK_BASE64` | 32-byte key, base64 (`openssl rand -base64 32`). Required before storing real tokens. |
| `WEB_ORIGIN` | Must include `https://firstround.space` (and localhost for local desk) |

Do not commit secrets. Do not paste secrets into chat.

## Google Cloud checklist

1. Project `firstround-space`, account `prajeshchoudhury42@gmail.com`
2. Gmail API enabled
3. OAuth client redirect URI matches `GOOGLE_GMAIL_REDIRECT_URI`
4. Test users include every pilot Gmail
5. Keep Publishing status = Testing until verification/CASA
