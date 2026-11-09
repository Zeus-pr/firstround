# Source register (Phase 0 draft)

Engineering draft for counsel review. Nothing here authorises scraping or contact research until counsel signs off in writing.

| source_key             | Display name                        | Jurisdiction | Intended use                                       | Legal status    | Kill switch |
| ---------------------- | ----------------------------------- | ------------ | -------------------------------------------------- | --------------- | ----------- |
| naukri_apify           | Naukri via Apify actor              | IN           | Shared job corpus only                             | pending_counsel | off         |
| company_careers_schema | Employer careers JobPosting JSON-LD | IN           | Prefer first-party postings                        | pending_counsel | off         |
| invited_channel        | Address published in the job post   | IN           | Direct email when the employer invites CV by email | pending_counsel | off         |

## Recipient / contact data

Architecture requires counsel’s written view before Phase 1 on:

- Pattern-inferred work emails (firstname.lastname@company)
- Any LinkedIn-derived person data (First Round does not scrape LinkedIn; still confirm boundary)
- Hunter (or other) verification responses retained in Postgres

## Sign-off

| Item                   | Owner   | Status  |
| ---------------------- | ------- | ------- |
| Source register review | Counsel | pending |
| Recipient data review  | Counsel | pending |
| Date                   |         |         |

Until both rows are signed, Phase 0 does not exit to Phase 1.
