# Source register

Operator-accepted pilot sources can ingest when `enabled=true`, `kill_switch=false`, and `legal_status` is `pilot_operator_accepted` (or later counsel-approved). Counsel review remains tracked below.

| source_key             | Display name                        | Jurisdiction | Intended use                                       | Legal status            | Enabled | Kill switch |
| ---------------------- | ----------------------------------- | ------------ | -------------------------------------------------- | ----------------------- | ------- | ----------- |
| naukri_apify           | Naukri via Apify actor              | IN           | Shared job corpus                                  | pilot_operator_accepted | on      | off         |
| linkedin_apify         | LinkedIn via Apify actor            | IN           | Shared job corpus + identity evidence (not email)  | pilot_operator_accepted | on      | off         |
| company_careers_schema | Employer careers JobPosting JSON-LD | IN           | Prefer first-party postings                        | pending_counsel         | off     | off         |
| invited_channel        | Address published in the job post   | IN           | Direct email when the employer invites CV by email | pending_counsel         | off     | off         |

## Recipient / contact data

Architecture still requires counsel’s written view before inferred emails and Hunter retention are enabled in product policy flags:

- Pattern-inferred work emails (firstname.lastname@company)
- LinkedIn-derived person data used as identity evidence (never as an email source by itself)
- Hunter (or other) verification responses retained in Postgres

## Sign-off

| Item                   | Owner   | Status              |
| ---------------------- | ------- | ------------------- |
| Pilot operator accept  | Prajesh | accepted (U6 start) |
| Source register review | Counsel | pending             |
| Recipient data review  | Counsel | pending             |

## Ops secrets (Railway api)

Set in Variables UI — do not paste into chat:

- `APIFY_TOKEN`
- `OPS_TOKEN` (Bearer for `POST /jobs/ingest/:sourceKey`)
- Optional: `APIFY_NAUKRI_ACTOR_ID` (default / pilot: `valig~naukri-jobs-scraper`)
- Optional: `APIFY_LINKEDIN_ACTOR_ID` (default `jobspipe~jobspipe-job-search` with `sources: ["linkedin"]`)
