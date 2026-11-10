#!/usr/bin/env bash
# Fill Naukri corpus toward ~1000 unique canonical jobs.
# Dedup is by fingerprint — re-runs with same keywords mostly upsert, so use diverse clusters.
# Usage:
#   export API_URL=https://api.firstround.space
#   export OPS_TOKEN=...   # from Railway api variables — do not paste into chat
#   bash scripts/fill-corpus-clusters.sh

set -euo pipefail

API_URL="${API_URL:?set API_URL}"
OPS_TOKEN="${OPS_TOKEN:?set OPS_TOKEN}"

ingest() {
  local keywords="$1"
  local location="$2"
  local max="${3:-40}"
  echo "→ ${keywords} @ ${location} (max ${max})"
  curl -sS -X POST "${API_URL}/jobs/ingest/naukri_apify" \
    -H "Authorization: Bearer ${OPS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"keywords\":\"${keywords}\",\"location\":\"${location}\",\"maxJobs\":${max}}"
  echo
}

# ~30 clusters × up to 40 ≈ raw volume; unique canonical will be lower after fingerprint dedupe.
ingest "backend engineer" "Bengaluru" 40
ingest "backend engineer" "Hyderabad" 40
ingest "backend engineer" "Pune" 30
ingest "frontend engineer" "Bengaluru" 40
ingest "frontend engineer" "Mumbai" 30
ingest "fullstack developer" "Bengaluru" 40
ingest "fullstack developer" "Chennai" 30
ingest "product manager" "Bengaluru" 40
ingest "product manager" "Mumbai" 30
ingest "product manager" "Gurugram" 30
ingest "data analyst" "Bengaluru" 40
ingest "data analyst" "Pune" 30
ingest "data scientist" "Bengaluru" 40
ingest "data scientist" "Hyderabad" 30
ingest "devops engineer" "Bengaluru" 40
ingest "devops engineer" "Hyderabad" 30
ingest "android developer" "Bengaluru" 30
ingest "ios developer" "Bengaluru" 30
ingest "QA engineer" "Bengaluru" 30
ingest "QA automation" "Pune" 30
ingest "category manager" "Mumbai" 40
ingest "category manager" "Kolkata" 30
ingest "revenue manager" "India" 40
ingest "GTM strategy" "Delhi" 30
ingest "assistant manager revenue" "India" 40
ingest "business analyst" "Bengaluru" 40
ingest "business analyst" "Mumbai" 30
ingest "program manager" "Bengaluru" 30
ingest "engineering manager" "Bengaluru" 40
ingest "SRE" "Bengaluru" 30
ingest "machine learning engineer" "Bengaluru" 40
ingest "growth manager" "Bengaluru" 30
ingest "salesforce developer" "Hyderabad" 30
ingest "Java developer" "Pune" 40
ingest "React developer" "Bengaluru" 40

echo "Done. Unique count = canonical rows after trust quarantine; duplicates collapse on fingerprint."
