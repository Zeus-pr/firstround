# Job corpus (U6)

Shared India job corpus. Desk never waits on a scraper.

## Sources

| source_key     | Provider                         | Default actor                  |
| -------------- | -------------------------------- | ------------------------------ |
| naukri_apify   | Apify Naukri (valig)             | `valig~naukri-jobs-scraper`    |
| linkedin_apify | Apify JobsPipe (LinkedIn filter) | `jobspipe~jobspipe-job-search` |

## API

| Method | Path                      | Auth        | Notes                                 |
| ------ | ------------------------- | ----------- | ------------------------------------- |
| GET    | `/jobs/corpus/status`     | Firebase    | Counts, sources, recent runs          |
| GET    | `/jobs/canonical`         | Firebase    | Non-quarantined, non-stale by default |
| POST   | `/jobs/ingest/:sourceKey` | `OPS_TOKEN` | Starts Apify run, normalizes, upserts |

Ingest body: `{ "keywords": "backend engineer", "location": "Bengaluru", "maxJobs": 50 }`

## Trust

Algorithm version `job-trust-1`. Score &lt; 75 → `quarantined=true` (not contactable). Failed ingest marks prior links from that source `stale=true` and keeps the last corpus.

## Railway api env

- `APIFY_TOKEN` (required for live ingest)
- `OPS_TOKEN` (required for ingest route)
- `APIFY_NAUKRI_ACTOR_ID` / `APIFY_LINKEDIN_ACTOR_ID` optional overrides

Do not paste secrets into chat.
