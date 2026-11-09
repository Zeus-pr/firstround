# Firstround Autopilot architecture

> **Document control**
> Version 2.0, 8 November 2026 (supersedes 1.x). Status: design baseline for implementation. It has **not** yet been reconciled against the codebase.
> Companion: `firstround-proprietary-algorithms.md` (v2.0). Where the two disagree, the algorithm specification owns scoring formulas and weights; this document owns system behaviour, safety policy, and operations.
> Items marked **[verify]** depend on third-party behaviour or legal interpretation and must be confirmed by test or by counsel before launch.
> External facts re-checked on 8 November 2026: Gmail scope tiers, India DPDP timeline, Cloudflare Workflows limits. The v2.0 change list is in section 22.

## 1. Product definition

Firstround is a job-specific outreach system. It finds relevant live jobs, identifies a likely role owner or recruiter, verifies one work email, drafts a truthful email from the candidate's Gmail, and stops follow-ups after a reply.

It does not claim to auto-submit every employer application form. The primary journey is direct job outreach.

A job proceeds only when every gate below passes, in this order. Each gate is an independent decision with its own stored score. A strong score on one gate never compensates for a weak score on another.

| Gate                  | Minimum | Meaning                                              |
| --------------------- | ------: | ---------------------------------------------------- |
| 1. Job trust          |  75/100 | The posting is real, fresh, and safe to send a CV to |
| 2. Job match          |  78/100 | The candidate fits the live role                     |
| 3. Person-job match   |  80/100 | The contact likely owns or recruits for that role    |
| 4. Address identity   |  75/100 | The address plausibly belongs to that person         |
| 5. Mailbox confidence |  90/100 | The selected work email is safe to send              |

This prevents a valid address from being used when it belongs to the wrong person, and prevents a relevant person from being used when their address is uncertain.

Scale note: this document stores scores on 0 to 100. The algorithm specification uses 0 to 1 for the same quantities (0.80 equals 80/100). Every threshold lives in one configuration registry (Appendix C).

**Invited-channel path.** When the posting itself tells applicants to email a CV to a specific address, the employer has invited that contact. Gates 3 and 4 are then replaced by an invitation check: the address must appear verbatim in the captured source text. Gate 5 still applies, with one change: an `accept_all` result is allowed on this path, because the employer published the address for exactly this purpose. Invalid, disposable, and unknown results still reject. Role-based addresses (hr@, careers@, jobs@) are allowed on this path and nowhere else. Recommended policy, to be confirmed in the Review-mode pilot.

## 2. Full customer flow

1. The user signs up and uploads a CV, their job preferences, and optional portfolio links.
2. Firstround extracts a structured profile and calculates CV readiness.
3. If readiness is 85 or more, the user continues. If it is below 85, they can Supercharge their CV or take an actionable checklist and improve it themselves.
4. The user connects Gmail through Google OAuth and chooses Review mode or Autopilot.
5. The shared India job corpus refreshes every day through Apify source adapters.
6. Firstround scores all eligible jobs for that candidate, saves the top 50, and selects at most 10 for contact research.
7. For each of those 10, Firstround finds a likely role owner or recruiter, creates a small set of email candidates, and asks Hunter to verify only the best one or two.
8. Eligible job-contact pairs become personalized email drafts with the approved CV attached and selected LinkedIn, GitHub, or portfolio links.
9. In Review mode, the user can edit and approve drafts by evening. In Autopilot, every fully eligible draft is queued for the send window. The user gets a final notice with a cancel control (default 15 minutes before the first send). Nothing sends if the user has paused, reconnected Gmail, or changed the CV or preferences since the draft was made.
10. Firstround watches only its own Gmail threads. Every inbound message in those threads is classified (human reply, auto-reply, out-of-office, bounce, opt-out, wrong-person redirect). A human reply stops future follow-ups and notifies the user immediately. The other classes follow the reply policy in section 21.13.
11. Without a reply, follow-up one sends after two business days and follow-up two after five business days, counted in the recipient's locale and skipping weekends and listed holidays. Then the campaign ends.

## 3. CV Supercharge

### 3.1 What the score means

The CV score is Firstround's readiness score. It must never be presented as a universal ATS result.

| Dimension             | Weight | What it checks                                                                                                                          |
| --------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence completeness |     20 | Roles, dates, tools, scope, and responsibilities                                                                                        |
| Outcome quality       |     25 | Numbers, scale, impact, before/after, delivery, quality, revenue, conversion, or time saved when provided                               |
| Target-role coverage  |     25 | Evidence that supports the selected job family and level                                                                                |
| Career consistency    |     15 | Chronology errors, contradictions, and implausible claims. Gaps, career breaks, lateral moves, and non-linear paths are never penalised |
| Communication clarity |     15 | Specific, parseable, concise bullets with clear headings                                                                                |

These weights mirror algorithm specification section 1.3, which is the canonical definition (version 1.x of the two documents disagreed). Contact details, location, and working profile links are a pass/fail **sendability checklist** that blocks sending but is not scored.

| Score    | Product response                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------- |
| 85–100   | Profile is ready for outreach                                                                        |
| 70–84    | Show exact missing evidence and offer Supercharge or a self-service checklist                        |
| Below 70 | Explain that match and outreach quality will be limited; offer Supercharge without blocking the user |

### 3.2 Supercharge workflow

1. Parse PDF or DOCX.
2. Extract only facts in the CV or supplied links.
3. Ask narrow factual questions for missing facts, such as team size, project scale, metric, time period, or tools.
4. Draft improved bullets.
5. Show original and suggested bullets together.
6. Require user acceptance before saving a new master CV.
7. Use only the accepted CV version in applications and attachments.
8. Show a claim register: every statement that may be used in outreach, with its source (CV, clarification answer, or link). Require the candidate to confirm the claims are accurate. Firstround never invents or upgrades a claim; the attestation records who vouched for it.
9. Allow role-family variants (for example a Product CV and an Analytics CV) built from the same fact bank. Each variant is accepted separately and chosen deterministically by job family.
10. Treat every upload as hostile. Allow only PDF and DOCX, cap size and page count, scan for malware, render to a canonical PDF in a sandbox, strip active content and metadata from the attachment copy, and store the SHA-256 of the exact bytes that will be attached.

No fine-tuning should be used at launch. A structured candidate fact bank, accepted CV version, and later edit feedback are more reliable than training on a small noisy CV dataset.

## 4. Gmail connection and reply tracking

### 4.1 OAuth scope strategy (re-checked 8 November 2026)

Google classifies Gmail scopes in three tiers. `gmail.send` is **sensitive**: it needs app verification but no annual security assessment. `gmail.readonly`, `gmail.modify`, `gmail.compose`, `gmail.insert`, `gmail.metadata`, and `https://mail.google.com/` are **restricted**: they need verification plus an annual third-party security assessment (CASA). An app's tier is set by its most restrictive scope. `gmail.labels` is non-sensitive but only edits label definitions; applying a label to a message needs `gmail.modify`.

| Need                                                                         | Scope            | Tier       |
| ---------------------------------------------------------------------------- | ---------------- | ---------- |
| Send the outreach message                                                    | `gmail.send`     | Sensitive  |
| Detect replies, bounces, and auto-replies in campaign threads; Pub/Sub watch | `gmail.readonly` | Restricted |
| Create drafts inside the user's Gmail                                        | `gmail.compose`  | Restricted |
| Apply a label to messages                                                    | `gmail.modify`   | Restricted |

**Recommended launch scope set: `gmail.send` + `gmail.readonly`.** It is the narrowest set that supports the product promise, and it removes the ability to modify, trash, or relabel the user's mail, which `gmail.modify` would grant for no product benefit. Two earlier design elements change as a result:

- Phase 1 "Gmail draft creation" needs `gmail.compose`, which is restricted. Keep Review-mode drafts inside the Firstround dashboard and send with `gmail.send` after approval.
- The `Firstround/Outreach` label is optional and needs `gmail.modify`. Track campaigns by stored thread ID, never by label.

`gmail.readonly` is mailbox-wide. The promise to read only campaign threads is therefore enforced by Firstround's own code and audit trail, not by Google. Build that enforcement as a technical control (section 4.3) and describe it truthfully on the consent page.

**Timing risk.** Restricted-scope verification plus the security assessment has a multi-week lead time and a recurring cost. Until verification completes, the Google Cloud project is limited to test users (Google documents a cap of 100), and refresh tokens for apps left in Testing status can expire after seven days **[verify in the Cloud console]**. A launch to 100 paying customers is therefore gated on verification, not only on engineering. Plan a closed pilot of at most 100 named testers first, and start verification in Phase 0.

Sources:

- [Google Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Gmail API overview](https://developers.google.com/workspace/gmail/api/guides)

The consent page must say clearly:

> Firstround creates and sends job-outreach emails from your Gmail. It reads only replies in Firstround-created conversation threads so it can stop follow-ups and show them to you.

Google's own consent screen will describe `gmail.readonly` as viewing "email messages and settings". Explain in plain language, on the Firstround page before the Google redirect, exactly what is read (threads Firstround created, plus bounce notices for them), what is stored, and for how long. Users can untick individual scopes on Google's consent screen, so always read back the granted scopes. Refuse to run campaigns, with a clear explanation, when `gmail.send` or `gmail.readonly` was not granted.

### 4.2 Gmail security

- Use OAuth state, nonce, and PKCE.
- Encrypt Gmail refresh tokens with AES-256-GCM before database storage.
- Store key version with encrypted data. Use envelope encryption: a per-record data key, encrypted by a key-encryption key held in a managed KMS (AWS KMS, Google Cloud KMS, or HashiCorp Vault), not in application environment variables. Support key rotation without downtime and rehearse it. Platform secret storage holds only the KMS credentials.
- Never log token values, message bodies, or attachments.
- Do not depend on a Gmail label (it needs `gmail.modify`). Identify campaign mail by stored thread ID and RFC Message-ID.
- Store Gmail thread ID, Gmail message ID, RFC Message-ID, recipient email, and campaign ID on every send.
- Disconnect means token revocation, encrypted-token deletion, and cancellation of future campaigns.
- Keep only minimum audit and billing records after disconnect.
- Isolate send capability. Run the Gmail sender as a separate service that can read only the outbox, is the only place token-decryption rights exist, and enforces a hard per-mailbox daily ceiling independent of application code. A compromised web app must not be able to mint arbitrary sends.
- Alert on anomalies: sends with no outbox record, volume above the user's cap, token use from unexpected networks, repeated invalid-grant errors.
- Treat token revocation and password-change signals as pause triggers.
- Default to personal Gmail accounts. Warn on, or block, Google Workspace accounts, especially when the account domain matches the candidate's current employer: the mail is visible to that employer's administrators and may breach the candidate's employment terms.

### 4.3 Reply flow

Use Gmail users.watch with Google Cloud Pub/Sub. Store Gmail history ID. For each mailbox change, query only history since that ID and inspect only messages that match an active Firstround thread or a known In-Reply-To/References header.

Google says a Gmail watch must be renewed at least every seven days and recommends daily renewal.

Source: [Gmail push notifications](https://developers.google.com/workspace/gmail/api/guides/push)

Do not poll entire inboxes. This is slower, costs more, and reads data unrelated to Firstround.

Implementation details that matter:

- `history.list` returns message and thread identifiers. Match those against stored active thread IDs first, and fetch message content only for matches. This is the enforcement point for the campaign-threads-only promise. Log every fetch with campaign ID and reason.
- Gmail labels attach to individual messages, so a recruiter's reply cannot be assumed to inherit any label **[verify]**. Match on thread ID and the In-Reply-To/References headers, never on label.
- Treat Pub/Sub as a hint, not the source of truth. Add a bounded safety-net sweep every few hours that calls `threads.get` only for campaign threads still awaiting a reply, so a lost push cannot cause a follow-up to someone who already answered. Alert when sweep and push results differ.
- Renew `users.watch` daily and alert on any mailbox whose watch is older than 48 hours.
- Every inbound message passes through the reply classifier (algorithm specification, ReplyIQ) before any campaign state changes. Anything unclassifiable fails safe: pause follow-ups and notify the candidate.

## 5. Shared job corpus

### 5.1 Collect once, match many times

Do not run an Apify search individually for every user. Ingest jobs by role-location cluster into one shared corpus, then score that corpus for each candidate.

Examples:

- Product Manager: Bengaluru, Hyderabad, Mumbai, remote.
- Backend Engineer: India and remote.
- Data Analyst: Bengaluru and Pune.
- Marketing Manager: Delhi NCR and Mumbai.

This reduces repeated scraper work at 100-customer scale.

### 5.2 Apify job provider

Start with an Apify Naukri adapter for India. The current Naukri Actor presents results in a reusable jobs schema and is a good India-first source, but should not be hard-wired through the product.

Source: [Naukri Job Scraper on Apify](https://apify.com/jobspipe/naukri-jobs-scraper)

Provider contract fields:

- provider and provider job ID;
- source URL and application URL;
- title, company, location, work mode, employment type;
- description and posting time;
- named poster and hiring-team records if exposed;
- actor run and dataset identifiers;
- capture timestamp.

Run jobs asynchronously. Store run input, actor run ID, dataset ID, source, status, timing, and error. Ingest results through webhooks or later dataset fetch. The dashboard must never wait for a scraper run.

Source: [Apify API documentation](https://docs.apify.com/api)

### 5.3 Source health

Track:

- run success rate;
- job freshness;
- percentage with full description;
- duplicate rate;
- percentage with application URL or named person;
- cost per usable canonical job.

Disable a failing source automatically and show a stale indicator for old data.

### 5.4 Source register and legal review

Every source (job board, ATS feed, scraper actor, LinkedIn-derived data, company site, verification vendor) gets a register entry before it can be enabled in production: owner, data categories, terms-of-service and contractual position, personal data involved, lawful basis, retention, kill switch, and risk rating. A source whose terms have not been reviewed can run only in staging. This matters most for any source that scrapes a platform whose terms restrict scraping: the "permitted scraper" in section 21.1 is permitted only when the register says why. Platform terms, account bans, and legal claims are a business-continuity risk as well as a compliance risk. Firstround must keep working, with reduced coverage, if any single scraped source is lost.

### 5.5 Prefer structured, first-party job sources

Add these ahead of, or beside, scraped boards:

- public applicant-tracking-system job feeds (for example Greenhouse, Lever, Ashby, SmartRecruiters, Workable, and India-relevant systems such as Zoho Recruit, Darwinbox, and Keka), which expose clean titles, locations, posting dates, closed status, and the company's real domain;
- schema.org `JobPosting` structured data on company careers pages, which most companies publish for Google for Jobs;
- direct careers pages for the candidate's top target companies.

These carry higher trust, give canonical company domains (which strengthens email-pattern evidence), cut scraper cost, and let Firstround detect a closed job reliably before sending. Naukri stays as the India-breadth source, not the only source. **[verify]** each feed's terms and rate limits.

### 5.6 Poster type and invited channel

Classify every posting as direct employer, staffing/consultancy posting for an unnamed client, confidential employer, or aggregator repost. Consultancy and confidential postings are legitimate and common in India, but the right contact is the poster, the client company cannot be verified, and trust and contact rules differ (algorithm specification sections 2.2 and 4.5). Capture, with the exact source span, any address or instruction telling applicants where to send a CV. De-obfuscate forms such as "name [at] company dot com" with a strict parser, never a model. A captured address is the strongest contact evidence available (section 7.1).

## 6. Job normalization and score

### 6.1 Canonical job

For each raw job:

1. Resolve company spelling and likely company/careers domain.
2. Normalize title to function, specialty, seniority, and people-manager level.
3. Extract location, work mode, employment type, salary if disclosed, and must-have requirements.
4. Convert HTML safely to structured description text.
5. Detect expired or closed jobs.
6. Deduplicate using company domain, normalized title, city/remote, and description fingerprint.
7. Classify poster type (direct, consultancy, confidential, aggregator repost).
8. Capture any explicit application email or instruction as an invited channel, with the exact source span.
9. Estimate liveness from age, repost count, closed-status signals, and re-check history, to catch ghost and evergreen postings.

Keep all original source URLs. Designate the freshest and most complete duplicate as canonical.

### 6.2 Hard exclusions

Reject before semantic scoring when:

- company is excluded;
- job is stale or closed;
- location, work mode, or work authorization conflicts;
- seniority is materially outside preference;
- mandatory requirement clearly conflicts;
- candidate has already contacted or declined the same canonical job.

### 6.3 Score

| Signal                                                                       | Points |
| ---------------------------------------------------------------------------- | -----: |
| Function fit                                                                 |     28 |
| Requirement evidence (must-have and preferred, weighted by evidence quality) |     27 |
| Scope and seniority                                                          |     18 |
| Location and working preferences                                             |     12 |
| Career direction (goals, industry, optional compensation)                    |     15 |

Use AI for job-description extraction and semantic comparison. Deterministic rules decide eligibility. Store the evidence spans and human-readable reasons behind every score.

### 6.4 Daily selection

Selection is a cost-aware cascade, because contact research and verification cost money and many jobs will have no safe contact:

1. Score all eligible jobs. Save the best 50 in the dashboard, ranked by JobPriority (algorithm specification section 3.5).
2. Compute a free contactability prior for each of the 50 from data already held: an invited address, a named poster or hiring team, an ATS-sourced company domain, a known company email pattern, past bounce or reply history for the company, and recipient capacity.
3. Run person discovery on the best 15 to 20 jobs by JobPriority times contactability prior, inside a per-candidate daily research budget.
4. Spend verifier credits only on jobs whose person and address-identity gates already pass, at most two candidates per job.
5. Rank the survivors by expected campaign value (algorithm specification section 6) under the portfolio rules, and take at most 10.
6. If fewer than 10 survive, send fewer. Never relax a gate to fill a quota, and never pay for research beyond the budget.

Also: skip previously contacted canonical jobs, and do not pay for person or email research outside the research set. The dashboard should present "three excellent campaigns today" as a success (see section 17.1 for the expected funnel).

## 7. Person discovery

### 7.1 Contact hierarchy

| Priority | Contact                                                                            | Use when                                                                                                                 |
| -------: | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
|        0 | Address or instruction in the posting itself telling applicants where to send a CV | Source text captured verbatim. The employer has invited this contact. Role-based addresses are allowed on this path only |
|        1 | Named hiring manager or hiring-team person                                         | Explicitly shown with role                                                                                               |
|        2 | Job poster or named recruiter                                                      | Source shows a current person                                                                                            |
|        3 | Relevant internal recruiter                                                        | Company, function, and location align                                                                                    |
|        4 | Likely role owner                                                                  | Current manager/director/VP for team                                                                                     |
|        5 | Founder or executive                                                               | Small company or leadership-owned role                                                                                   |

A LinkedIn job poster can be a selected recruiter and their email is not shown to candidates, so it is useful but not proof that they own the job.

Source: [LinkedIn job poster profile](https://www.linkedin.com/help/linkedin/answer/a417018/job-poster-profile-on-job-posting)

### 7.2 Evidence sources

Use:

- job poster or hiring team from the source;
- company careers, team, and leadership pages;
- public hiring announcements;
- permitted LinkedIn scraper output about current company/title/work history;
- public professional pages confirming current employment.

Every fact needs source URL, source type, timestamp, and evidence text. Firstround must label inferred role ownership as inferred.

### 7.3 Person-job score

| Signal                                 | Points |
| -------------------------------------- | -----: |
| Explicitly named in job or hiring team |     35 |
| Current employment at company          |     20 |
| Function/team alignment                |     20 |
| Suitable seniority                     |     10 |
| Location/workforce alignment           |      5 |
| Recent hiring/team evidence            |      5 |
| Freshness and cross-source agreement   |      5 |

Select a person only at 80 or more, and only if they lead the next candidate by at least 10 points unless they were explicitly named. Keep up to two fallbacks but email one recipient only.

### 7.4 AI role

AI can infer team, normalize unusual titles, rank sourced people, and explain its ranking. It cannot invent names, titles, emails, employers, or job relationships.

### 7.5 Additional rules for India and ambiguous cases

- **Recruiter versus hiring manager.** For most India mid-level roles the sourced recruiter or talent-acquisition owner is the better first contact. For director level and above, and at small companies, prefer the functional leader. Store this as policy by company-size band and seniority, and tune it from outcomes.
- **Name ambiguity.** Common names (many people called Rahul Sharma or S. Kumar at large employers) make pattern-generated addresses dangerous, because the address may belong to a different employee. Score name-collision risk (company size, name frequency, department count). When risk is high, require direct public evidence, not only a pattern.
- **Indian name structures.** Handle initials-first and initials-last forms, single names, patronymic and regional ordering, and variant transliterations when matching local parts and generating candidates. Never infer gender, religion, caste, or region from a name. Use the first name only in salutations.
- **Role filter.** Exclude payroll, HR-operations, admin, and HR-business-partner contacts unless the source ties them to hiring for this role.
- **Staffing firms.** When the posting is a consultancy posting, the consultancy recruiter is the owner. Never guess the unnamed client's hiring manager.
- **Job-change check.** If evidence suggests the person left the company or changed team, treat it as a conflict signal, not as a weaker positive.

## 8. Email discovery and Hunter verification

### 8.1 Email candidates

Order:

1. Explicit public work email.
2. Company email pattern supported by at least two independently sourced, current corporate emails.
3. Up to three generated candidates for the selected person only.

Examples:

- firstname.lastname@company.com
- firstname@company.com
- f.lastname@company.com

Never generate every possible email combination.

### 8.2 Local checks

Before Hunter:

- syntax, length, Unicode and domain normalization;
- company domain match;
- MX lookup;
- Null MX detection;
- disposable domain and historic hard-bounce suppression;
- current company pattern evidence/freshness;
- local-part match to selected name;
- current-employment/job-change evidence.

A Null MX record explicitly states that a domain accepts no email.

Source: [RFC 7505](https://www.rfc-editor.org/info/rfc7505/)

### 8.3 Hunter policy

Hunter currently documents 0.5 credits per verifier call. It can return valid, invalid, accept_all, webmail, disposable, or unknown. A 202 result means verification continues.

Source: [Hunter API v2](https://hunter.io/api-documentation/v2.md)

| Result                       | Firstround decision                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| valid and score 90+          | Eligible if person score 80+                                                                |
| valid and score 80–89        | Not sendable at launch. May go to second-verifier arbitration (section 8.5); otherwise hold |
| valid and score below 80     | Reject                                                                                      |
| accept_all                   | Treat as uncertain; skip by default (exception: invited channel, section 1)                 |
| unknown or SMTP blocked      | Hold/skip; do not repeat immediately                                                        |
| invalid, disposable, webmail | Reject                                                                                      |
| claimed email/privacy error  | Permanently suppress                                                                        |

If the first candidate fails, verify one fallback only if it was nearly as strong. Cap verification at two candidates per job. If neither passes, mark the job No safe contact found.

### 8.4 Separate scores

Persist:

- job match score;
- person-job score;
- email evidence score;
- mailbox confidence;
- final campaign eligibility.

Do not hide these behind one generic score.

### 8.5 Verifier arbitration and calibration rig

Do not depend on one verifier. Put verification behind a provider interface so a second service can be added. For an address that Hunter returns as valid with a score of 80 to 89, a second independent verifier may be queried once. The address becomes eligible only when both agree it is valid and Firstround's own identity evidence passes. Cap total verifier spend per job.

Maintain a verifier benchmark rig: a panel of mailboxes Firstround controls across Google Workspace, Microsoft 365, Zoho, and a self-hosted server, with catch-all on and off and known-good and known-bad addresses, re-run weekly against every verifier. It is the only way to measure verifier accuracy by mail-provider type before enough first-party outcome data exists. Never send test mail to third parties for this purpose.

Store each domain's mail provider and catch-all behaviour as features, because accept-all handling differs sharply by provider.

Spam traps: published, scraped, or pattern-generated addresses can be spam traps, and verification does not reliably detect them. That is a second reason to send only to verified, identity-supported addresses, and to treat any complaint or blocklist signal as grounds for domain-level suppression.

## 9. Draft generation

### 9.1 Grounded draft pipeline

1. Candidate fact pack from accepted CV/profile.
2. Job fact pack from canonical job.
3. Recipient fact pack from sourced information.
4. Structured message plan.
5. Draft generation.
6. Factual and style gate.
7. One corrective pass if needed.
8. Save draft and evidence record.

### 9.2 Draft standards

- Initial email: 70–120 words.
- One role-specific opening.
- At most two candidate evidence points.
- One small ask: conversation, CV share, or right contact.
- CV PDF attachment and selected profile links.
- No second attachment in follow-ups by default.
- Do not volunteer tool or automation details, and never deny them if the recipient asks directly.
- Close with one courteous line that makes stopping easy, for example inviting the recipient to say if this reached the wrong person or if they would rather not be contacted.
- No open or click tracking, no link shorteners, and at most three links.
- Salutation uses the recipient's first name only. Never infer gender or honorifics.
- Attach one CV PDF, under 1 MB where possible, and record its hash.
- No fake familiarity, referral, recipient praise, or unsupported achievement.
- No claim about recipient not directly supported by source.

Every factual clause needs source IDs. Unsupported facts are removed or rewritten as non-factual interest.

### 9.3 Anti-slop gate

Reject drafts with:

- generic openings;
- praise usable for any company;
- copied job-description wording with no candidate evidence;
- more than one question;
- unsupported claims;
- recipient name/title mismatch;
- over-length body;
- user-disliked phrases.

Use a model critic for language quality, but deterministic validators decide citations, length, required fields, and prohibited phrases.

## 10. Daily campaign process

| Time in candidate timezone         | Action                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 06:00–07:30                        | Refresh shared corpus                                                                                                                   |
| 07:30–09:30                        | Score jobs, research contact, verify email, draft ten maximum                                                                           |
| 09:30                              | Notify candidate                                                                                                                        |
| 19:00 (default)                    | Review-mode approval cut-off                                                                                                            |
| From 19:30 (default, configurable) | Send approved drafts one at a time with random spacing. Send all fully eligible drafts only if Autopilot is on, after the cancel notice |
| Next business morning              | Process replies and scheduled follow-ups                                                                                                |

The evening window is a starting hypothesis, not a finding. Recruiters often triage mail in the morning, and a message sent the previous evening arrives among overnight mail. Test "queue in the evening, send in the recipient's next morning window" against evening sending in the experiment framework (section 21.20) before fixing a default. Sends are never a burst: one at a time per mailbox, spaced with jitter.

Campaign state:

| Event                                         | Action                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Day 0                                         | Initial message                                                                              |
| Business day 2 without reply                  | Follow-up one in the same thread, only if the job is still live and no stop condition exists |
| Business day 5 without reply                  | Follow-up two in the same thread, then close                                                 |
| Human reply                                   | Stop and notify immediately                                                                  |
| Out-of-office with a return date              | Defer the next follow-up until after that date; do not stop                                  |
| Auto-acknowledgement ("application received") | Stop follow-ups; not positive contact evidence                                               |
| Opt-out or "do not contact"                   | Stop; suppress the recipient globally                                                        |
| Wrong person or redirect                      | Stop; record the new contact as evidence; tell the candidate who to try next                 |
| Hard bounce                                   | Stop and suppress the address                                                                |
| Temporary failure                             | No new initial message; bounded status check                                                 |
| Candidate replies in the thread themselves    | Stop automation for that thread                                                              |
| Candidate marks "hired" or pauses the search  | Cancel all queued campaigns                                                                  |
| Gmail token revoked                           | Pause all campaigns                                                                          |

Default is Review mode. Autopilot is explicit user opt-in after they understand the rules.

Autopilot guard rails:

- a final notice with a cancel control before the first send each day;
- automatic fall-back to Review mode if the candidate has not opened the dashboard for seven days, has changed the CV or preferences after the draft was made, has reported a wrong contact, or if a complaint or hard bounce occurred in the last 24 hours;
- a one-tap "pause everything" and "I'm hired" control on every screen.

## 11. Credits

Use outreach-campaign credits.

One credit includes:

- matched live job;
- one selected contact;
- email verification;
- grounded draft;
- initial send;
- up to two follow-ups;
- reply tracking and campaign history.

Consume the credit only after Gmail confirms the initial send. Drafts, skipped jobs, user-rejected drafts, and failed verification cost zero user credits.

This matches GetMoreInterviews' disclosed model: one credit equals one hiring manager emailed about one role with follow-ups included.

Source: [GetMoreInterviews FAQ](https://getmoreinterviews.ai/)

Sell 100 outreach campaigns, not 100 messages.

### 11.1 Commercial rules to settle before launch

- **Refunds.** Decide and publish whether a credit is refunded on a hard bounce, on a wrong-contact report, and on a job found to be fraudulent after sending. Recommended: automatic refund for a hard bounce within 72 hours and for confirmed fraud; goodwill review for wrong-contact reports.
- **Expiry.** State whether credits expire, and honour that in the ledger.
- **True unit cost.** Cost per sent campaign is the provider cost of every job researched, including those that never reached a send, divided by sent campaigns. A "no safe contact" outcome costs money and earns nothing. Price from this number and from contactable yield (section 17.1), not from the cost of the sent campaigns alone.
- **India billing.** A payment provider supporting UPI and cards (for example Razorpay), compliance with RBI recurring-payment rules (pre-debit notification and additional authentication), GST invoices (confirm the applicable rate with an accountant), and refunds consistent with consumer-protection law. The immutable ledger is already planned.
- **Abuse.** Prevent free-trial farming across accounts and cap sends per payment instrument.

## 12. Technical architecture

The existing project is Next.js 15, React 19, TypeScript, Firebase Auth, Vinext/Cloudflare, and its product plan names Railway Postgres and Cloudflare R2. Keep that direction.

| Layer                        | Recommendation                                                                                       | Reason                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Web app                      | Existing Next.js App Router + TypeScript                                                             | Preserve current app                                                                                     |
| Identity                     | Existing Firebase Auth                                                                               | Avoid auth rewrite                                                                                       |
| API                          | Next server routes and Cloudflare Worker endpoints                                                   | Fits deployment                                                                                          |
| Durable workflow             | Cloudflare Workflows                                                                                 | Multi-day delays, retries, approval wait                                                                 |
| Fan-out                      | Cloudflare Queues with dead-letter queue                                                             | Ingestion, scoring, verification, notifications                                                          |
| Database                     | Railway PostgreSQL                                                                                   | Transactional credits, sends, and state                                                                  |
| ORM                          | Drizzle ORM                                                                                          | Typed schema/migrations                                                                                  |
| Files                        | Cloudflare R2                                                                                        | CV originals and accepted PDFs                                                                           |
| CV parsing                   | Node 22 Railway worker                                                                               | Better PDF/DOCX reliability than edge runtime                                                            |
| Gmail                        | Gmail REST adapter using fetch/OAuth                                                                 | Works with Worker environment                                                                            |
| AI                           | Vercel AI SDK adapters                                                                               | Provider portable                                                                                        |
| Monitoring                   | Sentry plus redacted structured logs                                                                 | Operational debugging                                                                                    |
| Postgres access from Workers | Cloudflare Hyperdrive or a connection pooler in front of Railway Postgres                            | Workers cannot hold long-lived database connections. Verify compatibility and latency early **[verify]** |
| Keys and secrets             | Managed KMS for token envelope keys; platform secrets for service credentials                        | Key rotation and access audit                                                                            |
| Scheduling                   | Cloudflare Cron Triggers start the daily fan-out; a per-candidate daily run key prevents double runs | Predictable, idempotent batches                                                                          |
| Feature flags                | Flag service or an audited Postgres flag table                                                       | Required by section 21.10                                                                                |
| Notifications                | Email, web push, and WhatsApp or SMS for replies                                                     | Replies are the value event, and speed matters in India                                                  |
| Tenant isolation             | Postgres row-level security keyed to workspace ID, set per transaction                               | Defence in depth beyond service-layer checks                                                             |

Cloudflare Workflows supports durable steps, retries, sleeps, and external waits. It should own the day-0/day-2/day-5 campaign state.

Source: [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)

Limits re-checked on 8 November 2026: a step can sleep for up to 365 days; an instance supports 10,000 steps by default (configurable higher); each step may persist 1 MiB; sleeping instances do not count against concurrency; completed-instance state is retained only 30 days on the paid plan. A campaign (a few dozen steps over five business days) fits comfortably. Workflows history is not an audit log: the audit trail lives in Postgres. Make every step idempotent, and make every queue consumer idempotent, because Queues deliver at least once.

Queues are for fan-out and short retry work. Their delay limit is 24 hours, so they should not own the five-day campaign schedule.

Source: [Cloudflare Queues limits](https://developers.cloudflare.com/queues/platform/limits/)

### Packages

Core:

- zod
- drizzle-orm and drizzle-kit
- postgres or Railway-selected driver
- jose
- oauth4webapi
- pino
- @sentry/nextjs

AI:

- ai
- @ai-sdk/openai
- @ai-sdk/anthropic if selected
- @ai-sdk/google if selected

Document worker:

- mammoth
- unpdf
- tesseract.js only for image-only CV fallback

Other:

- @aws-sdk/client-s3 for R2
- @react-email/components for HTML/plain-text email

## 13. Database model

Profile tables:

- users, workspaces, workspace_members;
- candidate_profiles, candidate_preferences, resume_versions, portfolio_links;
- gmail_connections, encrypted_token_envelopes, consents.

Job tables:

- job_source_runs, raw_jobs, canonical_companies, company_domains;
- canonical_jobs, job_sources, job_match_scores, job_shortlists, job_declines.

Person/email tables:

- people, person_employments, person_source_evidence;
- job_contact_candidates, email_candidates, email_pattern_evidence;
- email_verifications, email_suppressions.

Campaign/billing tables:

- campaigns, campaign_contacts, message_drafts, sent_messages, reply_events;
- campaign_workflow_runs, notification_events;
- credit_ledger, provider_usage_events, idempotency_keys, audit_events, dead_letter_events.

Safety, policy, and learning tables:

- source_register, policy_versions, config_versions, feature_flags;
- outbox, campaign_state_transitions, gmail_sync_state, gmail_fetch_log;
- reply_classifications, invited_channels, recipient_capacity, recipient_suppressions, recipient_requests;
- data_subject_requests, deletion_jobs, retention_schedules;
- model_registry, prompt_registry, evaluation_runs, experiment_assignments, canary_cohorts;
- shortlist_feedback, wrong_contact_reports, outcome_labels, fairness_audits;
- verifier_benchmark_runs, domain_mail_profiles.

Required uniqueness:

- one active campaign per candidate plus canonical job;
- one initial message per campaign;
- one daily verification per email unless transient retry is justified;
- one credit debit per campaign;
- one active Gmail connection per connected account;
- one outbox record per campaign step (initial, follow-up one, follow-up two);
- one daily batch per candidate per local date;
- one recipient_capacity row per recipient key and window, updated by compare-and-set;
- campaign state changes only through a transition table that rejects illegal transitions (Appendix A).

## 14. Reliability rules

Daily workflow:

1. confirm active user and Gmail connection;
2. load approved profile and preferences;
3. retrieve eligible canonical jobs;
4. score and save explanation;
5. save 50 shortlist;
6. select 10 campaign candidates;
7. resolve person, candidate email, verification, and draft;
8. schedule send deadline and notify.

Campaign workflow:

1. wait until deadline;
2. check approval or Autopilot;
3. acquire campaign lock;
4. re-check job is live, email remains eligible, Gmail token valid, and no reply exists;
5. send through the outbox lease (section 21.2). Gmail itself has no idempotency key, so the idempotency is Firstround's;
6. reconcile the Gmail draft, thread, and message before any retry;
7. debit one credit only after send confirmation;
8. sleep to day 2, then send follow-up one only if still eligible;
9. sleep to day 5, then send follow-up two only if still eligible;
10. close campaign.

### 14.1 Send reconciliation pattern

Prefer a two-step send so the draft is the idempotency handle: create the message as a Gmail draft, store the draft ID, then send that draft. If the send call times out, fetch the draft. If it still exists, the send did not happen and a retry is safe. If it is gone, the message was sent, and Firstround looks it up by thread and Message-ID before debiting. This needs `gmail.compose`, which is restricted **[verify draft-send semantics in test]**.

With the recommended launch scope set (`gmail.send` + `gmail.readonly`) drafts cannot be created. Fall back to searching the user's Sent mail for the stored Message-ID or a unique token, and keep a mailbox-level lease so that no second attempt starts until reconciliation finishes. Confirm by test whether Gmail preserves a client-supplied Message-ID **[verify]**. If it rewrites it, reconcile on recipient, subject, send time, and thread.

Failure handling:

| Failure                          | Action                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Apify failure                    | Exponential retry, retain last corpus, mark source stale                                                                 |
| Hunter 202/timeout               | Bounded poll/retry, never send before final result                                                                       |
| Gmail invalid grant              | Pause campaigns and request reconnect                                                                                    |
| Gmail timeout after send request | Reconcile Gmail thread/message before retry                                                                              |
| Database failure after send      | Reconcile before credit debit; never resend blindly                                                                      |
| AI invalid output                | One correction pass, then skip with logged reason                                                                        |
| Pub/Sub disruption               | Recover from stored Gmail history ID, backed by the safety-net sweep (section 4.3)                                       |
| Verifier outage                  | Hold affected jobs; never send on an unverified address; try the next job                                                |
| Daily batch fails midway         | Resume from the daily run key; never regenerate drafts already approved                                                  |
| Clock or timezone fault          | Evaluate send windows server-side in the candidate's stored timezone; refuse to send if clocks disagree beyond tolerance |

## 15. Dashboard

Screens:

1. Today: drafts, deadline, status, and credit impact.
2. Job pipeline: 50 shortlisted jobs, score, explanations, contact status, skip reason.
3. Campaigns: draft, pending review, sent, follow-up one, follow-up two, replied, bounced, closed.
4. Inbox: only campaign replies.
5. CV Supercharge: score parts, accepted CV, improvement checklist.
6. Preferences: target roles, locations, exclusions, cap, send window, Review/Autopilot.
7. Credits: balance and immutable ledger.
8. Data/access: Gmail connection, disconnect, deletion request.
9. Safety controls: pause everything, "I'm hired", Autopilot cancel window, report a wrong contact, report a problem with a draft, and a personal never-contact list.

Every campaign view must show job-match evidence, person-selection evidence, email verification outcome, attached CV version, drafted source facts, and schedule.

## 16. Privacy and security

- Validate Firebase identity token for every user request.
- Enforce tenant isolation in database/service layer.
- Encrypt refresh tokens; redact logs.
- Validate signed webhooks/push identities.
- Retrieve Gmail messages only for Firstround campaign threads.
- Store only campaign-relevant reply bodies.
- Support consent, revocation, export, deletion, retention, and contact suppression.
- Honor Hunter claimed-email suppression.
- Rate-limit user and provider calls.
- Store all secrets outside the codebase.

### 16.1 India data protection (DPDP) and recipient rights

Facts checked on 8 November 2026: the Digital Personal Data Protection Rules, 2025 were notified on 13 to 14 November 2025, and the Act is being brought into force in stages. Institutional provisions took effect immediately, consent-manager registration follows at about 12 months (around November 2026), and the main duties of data fiduciaries (notice, consent, security, breach reporting, retention and erasure, children's data) apply about 18 months after notification, around mid-May 2027. Firstround's launch window overlaps that date, so build to the final rules now rather than retrofit.

Design requirements:

- **Candidates.** Itemised notice and consent per purpose (CV processing, Gmail access, sending on their behalf, any model improvement). Withdrawal as easy as consent. A named grievance contact. An age gate: no accounts under 18. A breach-response playbook. Retention and erasure that cascade to every store and vendor.
- **Recipients.** Recruiters and hiring managers are data principals too. Firstround holds their name, title, employer, and work email, some of it inferred. The Act contains an exclusion for data a person made publicly available themselves. Whether that covers each source, and especially a pattern-inferred address the person never published, is a question for counsel **[verify with counsel]**. Do not assume it does. Provide a public recipient page where a person can see why they were contacted, request removal, and set preferences. Any removal is global and permanent through the recipient key.
- **Foreign recipients.** Limit recipients to India at launch. Add other jurisdictions (the EU and UK in particular) only after a legal basis and notice process exist.
- **Cross-border processing.** Record where each processor stores data (Railway, Cloudflare, Apify, Hunter, LLM providers, Sentry) and keep that list current. The Rules take a restricted-destination approach, so be ready to change region.
- **Vendors.** Signed processing terms with each vendor. LLM calls on no-retention, no-training terms. Scrub CVs and email bodies from error reports.
- **Deletion orchestration.** One deletion job covering Firebase, Postgres, R2, caches, Apify datasets, vendor-side data, and backups (by expiry), with a verifiable completion record.

## 17. 100-customer capacity

Assumptions: 100 active users, maximum 10 new campaigns/user/workday, 20 workdays, one verification/job average, two follow-ups if there is no reply.

| Metric                     | Monthly maximum |
| -------------------------- | --------------: |
| New campaigns              |          20,000 |
| Initial messages           |          20,000 |
| Follow-ups                 |          40,000 |
| Maximum Gmail sends        |          60,000 |
| Hunter calls at one/job    |          20,000 |
| Hunter credits at 0.5/call |          10,000 |
| Hunter calls at two/job    |          40,000 |
| Hunter credits at 0.5/call |          20,000 |

Cost controls:

- shared scraper clusters;
- contact research only for top 10;
- verification cache with date;
- two candidates/job maximum;
- exclude accept_all and unknown from Autopilot;
- stop immediately on reply;
- daily user/global caps.

Hunter documents 0.5 credits per verifier request. Source: [Hunter API credit usage](https://help.hunter.io/en/articles/1970956-hunter-api)

Apify actor and AI pricing change. Calculate actual provider cost from provider_usage_events before publishing subscriptions.

### 17.1 Expected funnel (planning model, not a measurement)

The 100-customer table above is a ceiling. Because every gate must pass, real sends will be well below it. Model the funnel explicitly and replace each assumption with Review-mode data:

jobs scored, then trust, then match (78+), then person found (80+, or an invited channel), then address identity, then mailbox (90+), then recipient capacity, then sent.

Measure the pass rate at each stage by role family, company-size band, and source. For illustration only: if just 20 percent of matched jobs end with a safe contact, a candidate needs about 50 researched jobs to produce 10 sends, which would exceed the research budget. Decide now what the product promises (for example "up to 10, typically 3 to 6 safe campaigns") and show unused capacity honestly.

Use the saved 50 as an "apply with a prepared kit" list for jobs with no safe contact: a tailored cover note and CV highlights that the candidate submits through the employer's own application page. This adds value at no verification cost and keeps the product from feeling empty on low-yield days.

### 17.2 Scale ladder

|   Users | Architecture change                                                                                                                |
| ------: | ---------------------------------------------------------------------------------------------------------------------------------- |
|     100 | Single Postgres, one worker pool, one verifier plus the benchmark rig                                                              |
|   1,000 | Read replica, queue partitioning by tenant, domain-level verification cache, per-provider budgets, second verifier mandatory       |
|  10,000 | Partition events and outbox tables, dedicated sender fleet, KMS throughput planning, multi-region failover, SOC 2 Type II in place |
| 100,000 | Separate data platform for outcome learning, regional data residency, enterprise trust programme                                   |

Recipient capacity becomes the binding constraint as users grow, because many candidates compete for the same recruiters. Allocating scarce recipient slots fairly between candidates is a design problem, not an afterthought (algorithm specification section 6.2).

## 18. Quality gates

Track:

- job-shortlist acceptance/decline;
- contactable-job coverage;
- draft approval/edit rate;
- human replies;
- days to first reply;
- credits per reply;
- high-confidence hard-bounce rate;
- wrong-contact rate;
- unsupported-claim events;
- duplicate sends;
- job freshness;
- unknown/accept-all rate by domain;
- reply-class mix (human, auto, opt-out, wrong-person) and opt-out rate per 1,000 sends;
- inbox placement from seed mailboxes at Gmail, Microsoft 365, and Zoho;
- complaint and block signals per recipient domain;
- contactable yield and cost per sent campaign, by role family;
- shortlist acceptance rate (the fastest early label for MatchRank);
- self-reported interview rate;
- fairness slice gaps (section 21.14).

Do not expand Autopilot until:

- duplicate sends are zero;
- the upper 95 percent confidence bound of the high-confidence hard-bounce rate is below 3 percent over at least 300 sends (zero bounces in 100 sends only proves an upper bound of about 3 percent);
- every send has job/person/email evidence;
- every send has score explanation;
- unsupported factual claims are zero.

Reply rate does not prove email validity. It also depends on candidate fit, job demand, timing, and job status.

## 19. Delivery phases

### Phase 0: foundation

- Confirm deployment accounts and repository versions.
- Add Railway Postgres schema, migrations, encrypted token storage, provider interfaces, and audit events.
- Start Google OAuth verification, privacy policy, data deletion, and security work.
- Add monitoring/redacted logs.
- Create the source register and obtain counsel's view on each scraped source and on recipient data.
- Set up KMS envelope encryption and rehearse a key rotation.
- Draft DPDP-aligned notices, consent records, and the recipient removal page.
- Build the verifier benchmark rig.
- Write the campaign state machine and invariants (Appendix A) and the simulation harness (section 21.18).
- Complete a threat model for the Gmail sender and token store.

### Phase 1: review-only

- CV upload/parsing/readiness/Supercharge.
- Apify Naukri ingestion, canonical corpus, normalization, deduplication, matching.
- Contact scoring, Hunter verification, grounded drafts.
- Dashboard drafts and approval. Drafts live in Firstround; Gmail draft creation only if `gmail.compose` is deliberately accepted into the scope set.
- Closed pilot of at most 100 named testers until Google verification completes.
- Candidate must approve before send.

### Phase 2: automation

- Cloudflare Workflows for daily run and follow-ups.
- Gmail send, Pub/Sub watch, reply-stop.
- Credits/billing.
- Autopilot opt-in.
- Dead-letter queue and operational alerts.

### Phase 3: calibration

- Optimize shared role-location clusters.
- Learn from replies, bounces, redirects, and public job changes.
- Improve company-pattern evidence.
- Benchmark against external contact data on the same job sample.
- Add further job sources only after health testing.

### Phase 4: platform and standards

- Partner and ATS integrations that offer employers a structured, consented inbound channel.
- Recruiter preference registry (section 21.22).
- Country packs (name conventions, holidays, legal rules, send windows) before any market beyond India.
- Third-party audits and certifications; public methodology and trust centre.

### Phase exit criteria

| Exit                 | Criteria                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 to 1         | Source register complete; KMS and rotation rehearsed; state machine and simulation harness passing; legal review of sources and recipient data recorded        |
| Phase 1 to 2         | At least 300 reviewed sends; zero unsupported claims; wrong-contact rate and hard-bounce upper bound inside gates; reply classifier meets its gold-set targets |
| Phase 2 to Autopilot | All go-live gates in section 21.12                                                                                                                             |
| Phase 3 onward       | Calibration plots per band; fairness slice report; canary and rollback exercised                                                                               |

## 20. Critical decisions

1. Use Apify/Naukri first, through an adapter.
2. Share job corpus across customers.
3. Use AI for extraction, ranking, and grounded writing; deterministic policy controls sending.
4. Verify one or two strong email candidates only.
5. Treat accept_all and unknown as uncertain.
6. One credit buys one job-contact campaign and two follow-ups.
7. Review mode first; Autopilot is opt-in.
8. Workflows own multi-day timing; Queues own fan-out.
9. Railway Postgres owns financial and campaign state; Firebase continues as identity.
10. Do not claim Apollo-wide parity until Firstround has measured first-party outcome data and a direct benchmark.
11. Use least-privilege Gmail scopes (`gmail.send` + `gmail.readonly`). No `gmail.modify`, no label dependency.
12. Use five gates, with an invited-channel path for postings that name where to send a CV.
13. Selection is a cost-aware cascade. Send fewer rather than relax a gate.
14. Every source has a register entry and a kill switch. No single scraped source is a single point of failure.
15. Classify every reply. Only human replies and explicit stop signals end a campaign; an out-of-office defers.
16. Recipients have rights: a public removal path, global suppression, and India-only recipients at launch.
17. Safety claims rest on confidence bounds from measured data, never on point estimates or vendor claims.
18. Fairness and responsible-AI controls are release-blocking.

## 21. Production hardening additions

This section adds requirements discovered in the production-readiness audit. These are required for a system that must work predictably at scale, rather than merely demonstrate the workflow.

### 21.1 Resolve product-brief conflicts before implementation

The current project product brief states that users approve every letter, that there is no LinkedIn scraper, and that there are no guessed-email blasts. The requested operating model adds user-controlled Autopilot, permitted LinkedIn scraping, and generated email candidates verified through Hunter.

Update the product decision record before implementation:

| Current brief                                              | Production decision                                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User approves every letter                                 | Review mode remains the default. Autopilot is an explicit, revocable user setting after the user has seen the rules.                                                    |
| No LinkedIn scraper                                        | Use the permitted scraper only for current role and company identity evidence. It is never an email source by itself.                                                   |
| No guessed-email blasts                                    | Generate at most three pattern candidates for one selected person, verify at most two, and send one email only. This is controlled candidate resolution, never a blast. |
| One verified person, role, approved first email per credit | Preserve this in Review mode; change the wording to one eligible person and role per credit when Autopilot is on.                                                       |

The product positioning should remain: direct, relevant candidate outreach. It should never be positioned as a bulk mail engine.

### 21.2 Exactly-once effective sending

A distributed system cannot guarantee literal exactly-once delivery across Gmail, Postgres, and workflow retries. It can achieve effectively-once sending through an outbox and reconciliation design.

Required flow:

1. Create a database outbox record inside the same transaction that moves a campaign to ready_to_send.
2. Assign an immutable client request ID and RFC Message-ID before calling Gmail.
3. Mark outbox as sending with a lease. Only one worker can hold that lease.
4. Call Gmail.
5. If Gmail returns success, persist Gmail message and thread identifiers, then mark outbox sent and debit credit in one database transaction.
6. If the network times out, do not send again. Search/reconcile Gmail by the known Message-ID, recipient, and campaign thread before deciding the send failed.
7. If a workflow is retried, it reads the outbox state first.
8. Record every transition in audit_events.

A credit debit must be idempotent. The database must enforce one debit event per campaign.

Gmail has no native idempotency key, so exactly-once effect is built from the outbox lease plus the reconciliation pattern in section 14.1. The same outbox pattern applies to each follow-up and to candidate notifications, so a retry can never produce a second follow-up or a second alert.

### 21.3 Gmail reliability details

A Gmail send response can confirm API acceptance without proving final delivery. Gmail's own error guidance says a successful response cannot be assumed to mean delivery, and Gmail enforces daily per-user sending limits shared with all user clients. Handle API quota or sending-limit errors as a campaign pause, never by switching to another Gmail account or bypassing limits.

Source: [Gmail API error handling](https://developers.google.com/workspace/gmail/api/guides/handle-errors)

Required behavior:

- Apply per-user concurrency limits. Do not send ten messages in parallel from one mailbox.
- Use exponential backoff for transient Gmail errors.
- Parse delivery-status notifications and mailer-daemon messages associated with Firstround sends.
- Distinguish hard bounce, temporary failure, auto-reply, human reply, and provider quota failure.
- Hard bounce: stop campaign, suppress address, preserve diagnostic code, and refund credit only if product policy promises it.
- Temporary failure: do not retry a new initial message; let Gmail transport retry or queue a bounded later status check.
- Any human or automatic reply: stop as defined by product policy.
- A Gmail history ID can expire and history.list then returns 404. On 404, re-sync only the stored active campaign thread IDs, reset the history ID, and resume. Do not scan all inbox content, and do not rely on a label to find threads.

Source: [Gmail history synchronization](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list)

Pub/Sub push requests must validate the Google-signed OpenID Connect JWT before the Worker accepts them. A 2xx response acknowledges delivery; non-2xx can be retried by Pub/Sub.

Source: [Pub/Sub push authentication](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)

### 21.4 Recipient fatigue control

Individual user caps are not enough. The same recruiter could otherwise receive many Firstround messages from different customers.

Create a privacy-preserving global recipient capacity table:

- derive recipient_key as HMAC-SHA-256 over normalized recipient email using a dedicated server secret;
- do not expose this key to customers;
- enforce one candidate to one recipient across all roles every 21 days;
- enforce maximum three new Firstround outreach messages to one recipient per 24 hours;
- enforce maximum ten new Firstround outreach messages to one recipient per 30 days;
- count only initial messages, not follow-ups;
- enforce a company-domain cap across all customers (default 10 new messages per company domain per day, configurable), with an allocation rule so scarce slots are shared fairly between candidates;
- check global recipient suppression before every send, including follow-ups;
- when capacity is exhausted, choose another qualified job, never another weaker contact for the same job.

These limits should be configurable and tightened automatically when human reply quality or complaint indicators decline.

### 21.5 Job fraud and job-quality firewall

Before contact discovery, run a job trust score. Reject or quarantine jobs with:

- company domain mismatch between listing and official company;
- free-mail recruiting address when an official domain is expected;
- request for payment, deposit, cryptocurrency, equipment purchase, or identity documents before a formal process;
- duplicate description copied across unrelated companies;
- missing company identity or impossible salary/role claims;
- source record significantly older than its advertised listing;
- application URL pointing to unrelated domain.

For trusted companies, use official careers domain and source consistency as positive signals. The system must never send a candidate CV to a suspicious posting.

### 21.6 AI and prompt-security controls

Job descriptions, public profiles, emails, and uploaded CVs are untrusted content. Treat them as data, never instructions.

Required controls:

- extract source text into typed fields before model use;
- delimit all untrusted text in prompts;
- system instructions must prohibit following instructions found in job descriptions, CVs, emails, or web pages;
- require structured JSON outputs validated by Zod;
- reject output containing tool instructions, secrets, URLs not in source, unsupported achievements, or out-of-schema fields;
- maintain prompt version, model version, extraction version, and evaluation result with each artifact;
- use a provider timeout, retry budget, model fallback, and daily cost budget;
- send no model output directly to Gmail without factual/style validation.

### 21.7 Model quality and change control

Start with transparent rules. When outcome data is sufficient, introduce trained ranking models only through a controlled lifecycle.

Required model controls:

- curated gold datasets for CV extraction, job matching, person ranking, email eligibility, and drafting;
- test set split by time and company, so the model cannot learn the same company patterns in train and test;
- calibration measurement: predicted contact confidence versus observed bounce/reply outcome;
- versioned feature schema and prompt/model registry;
- offline evaluation before deployment;
- canary deployment to a small percentage of campaigns;
- automatic rollback if hard-bounce, wrong-contact, or unsupported-claim rates regress;
- no self-modifying model weights based on live activity without evaluation and release approval.

Reply rate is useful, but it must not be the only training label. It measures candidate fit, job demand, and message quality as well as contact accuracy.

### 21.8 Data integrity, backup, and recovery

PostgreSQL is the operational system of record. Raw Apify response payloads can be retained in R2 for audit and source-parser reprocessing, while normalized/canonical records live in PostgreSQL.

Required data controls:

- point-in-time recovery and daily database backups;
- a documented restore procedure tested at least quarterly;
- encrypted R2 bucket, private objects, signed short-lived download URLs, and lifecycle retention rules;
- database migration review, forward-only migration strategy, and tested rollback plan;
- content hash for every raw object and parsed payload;
- source parser version on each raw job and canonical job record;
- immutable audit trail for scoring, recipient choice, verification, generated draft, approval, send, reply, credit, and suppression;
- separate production/staging credentials and data;
- no real customer Gmail tokens or CVs in staging.

Recommended resilience targets:

| Measure                                         | Target                               |
| ----------------------------------------------- | ------------------------------------ |
| API and dashboard availability                  | 99.9 percent monthly                 |
| Duplicate campaign sends                        | Zero tolerated                       |
| Daily draft batch available by deadline         | 99 percent of healthy-provider days  |
| Recovery point objective for Postgres           | 15 minutes or less                   |
| Recovery time objective for campaign processing | 4 hours or less                      |
| Maximum unsent reply-notification delay         | 15 minutes excluding provider outage |

### 21.9 Observability and operations

Create a trace ID at job ingestion and carry it through normalization, scoring, contact discovery, Hunter verification, draft generation, Gmail send, and reply.

Dashboards and alerts must cover:

- Apify source freshness and parser error rate;
- job deduplication anomaly;
- Hunter result mix, latency, and cost;
- Gmail API 429s, invalid grants, send uncertainty, bounces, and reply-processing lag;
- workflow retries, cancelled campaigns, and dead-letter events;
- duplicate-send safety guard activation;
- tenant-specific and platform-wide daily spending;
- automated draft rejection reasons;
- backlog age for queues/workflows.

Use an internal operator console with read-only evidence first. Any operator override must require an audited reason and must never silently send mail for a customer.

### 21.10 Deployment and release engineering

Use separate development, staging, and production environments.

Before a release:

1. Run schema migration checks.
2. Run provider contract tests against sandbox/test accounts.
3. Run end-to-end campaigns with dedicated test Gmail accounts and test contacts.
4. Verify initial send, timeout reconciliation, reply stop, bounce stop, follow-ups, token revocation, Gmail history 404 re-sync, credit debit/refund, and workflow cancellation.
5. Deploy via canary release.
6. Monitor error, duplicate-send, bounce, and provider cost signals before full rollout.

Feature flags are required for:

- Autopilot;
- each job source;
- each LLM provider/model;
- Hunter verification policy;
- generated-email pattern use;
- Gmail sending;
- follow-up schedule;
- credit charging.

### 21.11 Gmail policy fit

Firstround's design must remain a user-benefiting productivity feature, not a way to bypass Gmail abuse protections. Google expressly prohibits using multiple accounts to bypass account limitations or distributing spam/unsolicited commercial mail. Firstround must maintain user consent, strict job relevance, small daily volume, recipient-frequency caps, and no sending workaround for Gmail limits.

Source: [Google Workspace User Data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)

### 21.12 Go-live gates

Autopilot must remain off platform-wide until all gates pass:

- Google OAuth restricted-scope verification and required assessment complete;
- no duplicate sends in end-to-end test suite and pilot;
- upper 95 percent confidence bound of the high-confidence hard-bounce rate below three percent over at least 300 sends;
- all outbound messages have complete job, person, email, and CV provenance;
- Gmail token encryption, revocation, deletion, and access audit verified;
- reply stop, bounce stop, history 404 resync, and Gmail timeout reconciliation tested;
- backup restore test successful;
- source health and job-fraud firewall active;
- global recipient-frequency protection active;
- alerting and dead-letter processes tested;
- counsel's written view on each scraped source and on recipient personal data recorded in the source register;
- recipient removal page live, and global suppression tested end to end;
- matched-pair fairness audit passed (section 21.14);
- penetration test completed with no open high-severity findings;
- every kill switch in section 21.17 exercised in staging and production;
- reply classifier meets its gold-set targets, and measured stop latency (human reply to follow-up cancelled) is within target;
- Gmail sender isolation and per-mailbox ceiling verified;
- DPDP-aligned notices and consent records in place.

### 21.13 Reply classification and handling (ReplyIQ)

Replies are the product's value event and its main stop signal, so they need a specified policy, not a single "any reply stops" rule.

| Class                             | Typical signals                                         | Campaign action                                                              | Learning label                             |
| --------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| Human reply (positive or neutral) | From the recipient or a colleague, no automated headers | Stop; notify immediately; offer reply assistance (always candidate-approved) | Positive contact outcome                   |
| Interview or call request         | Scheduling language                                     | Stop; urgent notification                                                    | Strongest positive outcome                 |
| Redirect to another person        | "Please contact X"                                      | Stop; store the named contact as new evidence; suggest next step             | Positive relevance, new ownership evidence |
| Rejection or no opening           | Explicit decline                                        | Stop; close the job for this candidate                                       | Contact may be right; job outcome negative |
| Apply-through-portal request      | Link or instruction                                     | Stop; notify with the link                                                   | Positive relevance                         |
| Out-of-office                     | Auto-Submitted or similar header, return date           | Defer the next follow-up past the return date                                | None                                       |
| Auto-acknowledgement              | "Application received"                                  | Stop follow-ups                                                              | None                                       |
| Opt-out or complaint              | "Stop", "remove me", "unsubscribe"                      | Stop; global recipient suppression; review if abusive                        | Negative for that recipient only           |
| Hard bounce                       | Delivery-status notification with a 5.x.x code          | Stop; suppress the address                                                   | Negative address evidence                  |
| Soft bounce                       | 4.x.x code                                              | No new initial message; bounded status check                                 | None                                       |
| Unclassifiable                    | Low classifier confidence                               | Pause follow-ups; notify the candidate                                       | Routed to human review                     |

Rules:

- Evaluate deterministic header and structure rules first (automated-message headers, delivery-status content types, known bounce senders), then a classifier for the rest.
- Store the class, confidence, classifier version, and the evidence span with every classification.
- Fail safe: uncertainty pauses follow-ups; it never sends one.
- Sample classified messages for human audit each week and feed corrections to the gold set.

### 21.14 Responsible AI and fairness

Firstround ranks jobs, ranks people, and writes on a candidate's behalf. Each can encode bias, so fairness is a release-blocking control.

- **Feature allow-list.** No ranking or drafting input may be derived from name, photo, age or date of birth, gender, religion, caste, marital status, disability, or inferred nationality or region. College prestige and employer prestige are used only when the candidate states them as a preference, never inferred as quality. Employment gaps and career breaks are never penalised.
- **Proxy review.** Every new feature is reviewed for proxy risk before release.
- **Matched-pair testing.** Without collecting demographic data, test fairness by swapping names (across regions, genders, and naming conventions) in otherwise identical CVs, and by swapping recipient names, and confirm scores, shortlists, and drafts do not change materially. Run on every release candidate.
- **Voluntary slice audits.** If the product ever collects self-identified attributes, collect them voluntarily, under separate consent, store them apart from operational data, and use them only for audit.
- **Explainability and contest.** Every decision has stored human-readable reasons, visible to the candidate, who can correct a wrong fact or exclude a company.
- **Recipient fairness.** No targeting by inferred recipient demographics; neutral salutations.
- **Human oversight.** Autopilot is opt-in; a kill switch exists; humans audit sampled drafts and classifications.
- **Regulatory watch.** Employment-related AI rules are developing (for example the EU AI Act's treatment of recruitment systems). Firstround acts for candidates, but reassess if it ever ranks or filters candidates for employers.
- **Documentation.** Model cards, dataset sheets, and a risk register, kept current.

### 21.15 Abuse and misuse prevention

- **Fabricated claims.** The claim-register attestation (section 3.2), plus checks for impossible dates and contradictions, and a block on sending claims that fail them.
- **Identity.** Compare the Gmail account's name with the CV's name and flag mismatches; require step-up authentication to enable Autopilot or change sending settings.
- **Harassment.** The 21-day candidate-to-recipient cooldown, global recipient and company caps, and global opt-out. Detect and block one recipient being targeted from many accounts.
- **Multi-account abuse.** One Gmail account per Firstround account, device and payment-instrument signals, and no bypass of Gmail limits.
- **Non-job use.** Every send must trace to a posting. Candidate edits in Review mode pass the same validators as generated text (links, commercial content, harassment, scams). Only the accepted CV can be attached.
- **Rate limiting and anomaly detection** on every user and provider path.

### 21.16 Security programme

- **Threat model.** Maintain a STRIDE-style model for the Gmail sender, token store, upload pipeline, webhooks, and operator console. Review it quarterly and before each major change.
- **Supply chain.** Dependency and secret scanning, pinned lockfiles, a software bill of materials, protected branches, least-privilege CI, signed builds.
- **Testing and disclosure.** Penetration test before the pilot and annually; a vulnerability-disclosure policy and a security.txt.
- **Staff access.** SSO with MFA, just-in-time privileged access, audited production access, and no routine staff reading of CVs or replies. Break-glass access needs a recorded reason.
- **Data protection.** Field-level encryption for reply bodies and CV text; egress allow-lists on the sender service.
- **Assurance roadmap.** Google's annual security assessment; SOC 2 Type I at pilot and Type II afterwards; ISO 27001 as demand requires; a DPDP compliance register.
- **Rotation.** Scheduled rotation of keys and service secrets, rehearsed.

### 21.17 Incident response and kill switches

Severity levels, an on-call rota, and runbooks exist before Autopilot. Kill switches, each tested and each requiring an audited reason:

- stop all sends platform-wide;
- stop one candidate, one source, one verifier, one model or prompt version, or one recipient domain;
- disable Autopilot platform-wide while keeping Review mode.

Playbooks required: a wrong-recipient or wrong-CV send (candidate notice, recipient apology template, root cause), a suspected token compromise (revoke, rotate, notify, check Google's reporting requirements **[verify]**), a personal-data breach under DPDP, a provider outage, and a complaint or blocklisting. Post-incident reviews are blameless, and every incident becomes a regression test.

### 21.18 Testing strategy

- **Invariants as property tests.** Encode the invariants in Appendix A and run them against randomised event sequences that include duplicates, reordering, and retries.
- **Simulation harness.** Fake Gmail, Pub/Sub, Hunter, and Apify services with fault injection: timeout after a successful send, duplicate and out-of-order pushes, history 404, 429s, partial outages, clock skew, workflow restart mid-step.
- **Replay.** Replay redacted production traces into staging to reproduce incidents deterministically.
- **Contract tests** against real provider sandboxes weekly, to catch API drift.
- **LLM tests.** Gold sets, a prompt-injection corpus, and a regression suite built from past incidents.
- **Load and chaos.** Ten-times daily fan-out load test; quarterly game days (restore from backup, revoke a token, lose a vendor).
- **Staging data.** Synthetic CVs and test mailboxes only.

### 21.19 Service-level objectives and error budgets

| Indicator                                      | Target                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| Duplicate sends                                | 0                                                                      |
| Follow-ups sent after a human reply            | 0, with stop latency measured and alerted                              |
| Unsupported factual claims in sent mail        | 0                                                                      |
| Credit and send mismatches                     | 0                                                                      |
| Reply notification delay (p95)                 | Under 5 minutes; hard ceiling 15 minutes excluding provider outage     |
| Daily draft batch ready by deadline            | 99 percent of healthy-provider days                                    |
| Wrong-contact rate and hard-bounce upper bound | Set after the pilot from measured data; inside the gates in section 18 |

An error-budget policy applies: when a budget is exhausted, freeze feature releases and Autopilot expansion until it recovers.

### 21.20 Experimentation governance

Any change that affects outbound content, selection, timing, or thresholds is an experiment with a recorded hypothesis, primary metric, and guardrail metrics (bounce, complaint, opt-out, wrong contact, unsupported claim).

- Randomise at the right unit: by candidate for message style, by company or recipient for contact policies, to avoid contamination.
- Compute power first. Reply rates are low single-digit percentages, so detecting a one-point change needs thousands of sends per arm. Do not run experiments that cannot reach that size.
- Pre-register stop rules; no peeking without sequential methods.
- Experiments never relax a safety gate, and never send anything outside Review approval or Autopilot rules.
- Keep a registry, mutually exclusive experiment layers, and a long-term holdout group.
- Tell candidates that experiments exist.

### 21.21 Deliverability programme

- Weekly inbox-placement tests from seed mailboxes at Gmail, Microsoft 365, and Zoho, and per-domain monitoring of bounces, blocks, and complaints.
- New-sender ramp: for a mailbox with little sending history, cap early volume and ramp up (for example a few messages a day in the first week).
- Plain, human-looking messages: no tracking, no link shorteners, few links, one modest attachment.
- Test, as an experiment, whether attachments reduce placement at strict corporate filters, and whether "CV on request" or a hosted link performs better for those domains.
- Domain-level suppression and cool-off when complaint or blocklist signals appear.
- DSN taxonomy maintained and tested (section 21.13).

### 21.22 Trust, transparency, and the path to an industry standard

A standard is adopted when others can rely on it. Plan for that:

- **Trust centre.** Methodology, data flows, subprocessors, security posture, certifications, incident history, and a public status page.
- **Recruiter preference registry.** Recruiters can verify their work address (by a challenge to that address), claim the roles and regions they own, state a preferred channel (apply link or email), set candidate caps, and opt out. It is opt-in, consented data that becomes first-party ownership truth for OwnerGraph and a reason recruiters prefer outreach that arrives through Firstround.
- **Responsible Outreach Charter.** Evidence-backed claims only, hard caps, global opt-out, no deception, and published aggregate quality metrics (bounce, opt-out, wrong-contact) each quarter.
- **Independent assurance.** Third-party audit of fairness and methodology, and consented privacy-preserving evaluation sets that outsiders can use to benchmark contact accuracy.
- **Employer-side channel.** Work with ATS vendors on a structured, consented inbound path so the best outcome is routing into the employer's own process, not another inbox message.
- **Open evidence schema.** Publish the job-contact-evidence schema so partners can interoperate.

## 22. What changes from the earlier design

The central product flow remains the same. The additions above make it production-grade:

- campaigns are reconciled through an outbox, rather than relying on a workflow call alone;
- recipient capacity protects recruiters and sending reputation across customers;
- suspicious jobs are blocked before candidate data is sent;
- model changes are evaluated and canaried rather than learned blindly;
- Gmail watch expiry, history loss, push authentication, quota behavior, bounces, and send ambiguity have explicit recovery paths;
- backup, restore, audit, monitoring, staging, and feature flags are defined before launch;
- the original product brief receives deliberate updates where it conflicts with Autopilot and permitted LinkedIn identity evidence.

### Version 2.0 additions

- Two documents reconciled: CV and match weights now mirror the algorithm specification; the mailbox-confidence bands no longer conflict (80 to 89 is not sendable at launch); address identity is now an explicit gate; the follow-up and reply rules now agree.
- Gmail scope strategy corrected: restricted versus sensitive tiers, a least-privilege recommendation, the consequences for draft creation and labels, and the verification timing risk.
- Invited-channel path, poster-type handling, and a cost-aware selection cascade with a funnel model.
- Source register, structured ATS and `JobPosting` sources, and legal review of scraped sources.
- Reply classification, out-of-office deferral, opt-out handling, and Autopilot guard rails.
- India-specific rules: name ambiguity and structures, recruiter versus manager policy, DPDP timeline and recipient rights, India-only recipients at launch, and billing.
- Send reconciliation without native Gmail idempotency; sender isolation; KMS envelope encryption.
- Fairness, abuse prevention, security programme, incident response, testing, SLOs, experimentation governance, deliverability programme, and a trust and standards roadmap.
- Appendices: campaign state machine and invariants, open decisions, and the configuration registry.

## Appendix A. Campaign state machine and invariants

States: `drafted`, `pending_approval`, `approved`, `queued` (outbox record exists), `sending` (lease held), `uncertain_send` (needs reconciliation), `sent`, `awaiting_followup_1`, `followup_1_sent`, `awaiting_followup_2`, `followup_2_sent`, `closed_no_reply`.
Stop states: `replied`, `opted_out`, `bounced`, `cancelled_by_user`, `cancelled_by_policy`, `expired` (job closed or deadline passed), `paused` (token revoked, quota, or kill switch).

| From                | To                  | Guard                                                                              |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| drafted             | pending_approval    | All five gates stored and valid under current policy version                       |
| pending_approval    | approved            | Candidate approved, or Autopilot on and cancel window elapsed                      |
| approved            | queued              | Outbox record created in the same transaction                                      |
| queued              | sending             | Lease acquired; job live, no suppression, no reply, token valid, capacity reserved |
| sending             | sent                | Gmail identifiers stored and credit debited in one transaction                     |
| sending             | uncertain_send      | Timeout or ambiguous Gmail response                                                |
| uncertain_send      | sent or queued      | Reconciliation proves sent or proves not sent                                      |
| sent                | awaiting_followup_1 | Initial send confirmed                                                             |
| awaiting_followup_n | followup_n_sent     | Same guards as queued, plus no stop-class reply                                    |
| followup_2_sent     | closed_no_reply     | Schedule complete                                                                  |
| any non-terminal    | a stop state        | Reply class, bounce, opt-out, user action, policy, or kill switch                  |

Illegal transitions are rejected by the database. Every transition writes an audit record with actor, reason, and policy, model, and prompt versions.

Invariants (each is a property test):

1. At most one initial send per campaign.
2. A credit debit exists if and only if the initial send is confirmed, exactly once.
3. No send occurs in a stop state or while paused.
4. No send occurs unless all five gates held under the policy versions in force at decision time, and the pre-send re-checks passed within the last few minutes.
5. Every sent message has complete job, person, address, and CV provenance.
6. No message goes to a suppressed recipient, whether globally suppressed or suppressed by this candidate.
7. Recipient and company caps are never exceeded.
8. Follow-ups use the same thread, the same mailbox, and the same CV version as the initial message.
9. The draft hash at approval equals the draft hash at send.
10. Gmail content is fetched only for active campaign threads, and every fetch is logged.
11. Tokens are decrypted only inside the sender and reply services.
12. Every state transition has an audit record.

## Appendix B. Open decisions

| #   | Decision                                                               | Recommended default                                          | Needed before |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | ------------- |
| 1   | Gmail scope set                                                        | `gmail.send` + `gmail.readonly`                              | Phase 0       |
| 2   | Accept `gmail.compose` for Gmail drafts?                               | No; drafts stay in Firstround                                | Phase 1       |
| 3   | Credit refund and expiry policy                                        | Refund on hard bounce within 72 hours and on confirmed fraud | Phase 2       |
| 4   | Invited-channel policy (accept-all, role-based mailboxes)              | Allowed on that path only                                    | Phase 1 pilot |
| 5   | Default send time                                                      | Evening window until experiment says otherwise               | Phase 2       |
| 6   | Follow-up spacing                                                      | Business days 2 and 5                                        | Phase 2       |
| 7   | Recipient jurisdictions at launch                                      | India only                                                   | Phase 1       |
| 8   | Counsel's view on LinkedIn-derived and pattern-inferred recipient data | Required in writing                                          | Phase 0       |
| 9   | Second verifier vendor                                                 | Pick one for arbitration and the benchmark rig               | Phase 1       |
| 10  | Notification channels                                                  | Email, push, and WhatsApp or SMS                             | Phase 2       |
| 11  | Verification cadence (CASA assessor, timeline, budget)                 | Start in Phase 0                                             | Phase 0       |
| 12  | Promise on daily volume                                                | "Up to 10, typically fewer"                                  | Phase 1       |

## Appendix C. Configuration registry

Every threshold is configuration with an owner, an experiment record, and a version.

| Parameter                                   |                                           Launch value |
| ------------------------------------------- | -----------------------------------------------------: |
| Job trust minimum                           |                                                     75 |
| Job match minimum                           |                                                     78 |
| Person-job minimum                          |                                                     80 |
| Owner margin minimum                        |                 10 points (waived if explicitly named) |
| Address identity minimum                    |                                                     75 |
| Mailbox confidence minimum                  |                                                     90 |
| Draft specificity minimum                   |       85 (rescaled when a dimension is not applicable) |
| CV readiness threshold                      |                                                     85 |
| New campaigns per candidate per day         |                                             10 maximum |
| Research set per candidate per day          |                                          15 to 20 jobs |
| Verified candidates per job                 |                                              2 maximum |
| Campaigns per company per candidate per day |                                              2 maximum |
| Candidate-to-recipient cooldown             |                                                21 days |
| Platform recipient cap                      |                         3 per 24 hours; 10 per 30 days |
| Platform company-domain cap                 |                                             10 per day |
| Follow-up schedule                          |                                  Business days 2 and 5 |
| Autopilot cancel notice                     |                                             15 minutes |
| Autopilot idle fall-back                    |                                                 7 days |
| Autopilot hard-bounce stop                  | Upper 95 percent bound at 3 percent, minimum 300 sends |
| Watch renewal                               |                               Daily; alert at 48 hours |
| Reply notification ceiling                  |                                             15 minutes |
