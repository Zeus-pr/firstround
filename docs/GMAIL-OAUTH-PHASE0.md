# Gmail OAuth verification (Phase 0 — human)

Start this now. Restricted scopes take weeks.

## Account

Use the Google Cloud project tied to Firebase Auth for `firstround-space` (`prajeshchoudhury42@gmail.com`) unless First Round later moves identity.

## Scopes (locked)

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`

Do **not** request `gmail.compose`, `gmail.modify`, or full mail scope for Phase 0/1.

## Checklist

1. Cloud Console → APIs → enable Gmail API.
2. OAuth consent screen → External → app name First Round.
3. Add scopes above; publish privacy policy URL (`/privacy` after Phase 0 frontend merges).
4. Add ≤100 test users for the closed pilot.
5. Start verification; budget for CASA annual assessment on the readonly scope.
6. Record the OAuth client ID in Railway secrets when the backend Gmail adapter lands (Phase 1/2). Do not commit secrets.

## Product copy before Google redirect (Phase 1)

Explain that First Round sends outreach from the user’s Gmail and reads only threads First Round created, plus bounce notices for those threads.
