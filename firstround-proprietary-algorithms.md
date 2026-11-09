# Firstround proprietary algorithm specification

> **Document control**
> Version 2.0, 8 November 2026 (supersedes 1.x). Companion: `firstround-autopilot-architecture.md` (v2.0).
> This document owns scoring formulas, weights, and the learning loop. The architecture document owns system behaviour, safety policy, and operations. Scores here are on 0 to 1; the architecture document stores the same quantities on 0 to 100 (0.80 equals 80/100).
> Numbers in this document are launch priors chosen to be reviewable. None is a measured result until the evaluation framework (section 9) says so.

## Purpose

Firstround cannot become an industry leader through a scraper, Hunter verification, or an email-writing model alone. Those are replaceable components.

The defensible system is a continuously improving decision engine that answers four questions better than competitors:

1. Is this job genuinely worth this candidate's time?
2. Who is most likely to own or recruit for this exact job?
3. Is this email both likely deliverable and likely attached to that person?
4. Which ten campaigns today have the highest expected value without damaging candidate or recipient trust?

The product should treat these as separate probabilistic decisions. A large language model may assist extraction and explanation, but it should not be the source of truth.

## Algorithm stack

| Engine | Output | Initial method | Long-term method |
|---|---|---|---|
| Profile intelligence | Structured candidate evidence | Rules plus schema extraction | Versioned profile graph |
| Job intelligence | Canonical job, trust, freshness, requirements | Rules plus extractor | Job/entity graph |
| MatchRank | Probability that candidate should pursue job | Weighted score | Calibrated ranking model |
| OwnerGraph | Probability a person owns/recruits for job | Evidence-weighted graph score | Learning-to-rank model |
| AddressProof | Probability address reaches chosen person | Evidence and verification score | Calibrated deliverability model |
| CampaignRank | Expected value of sending now | Deterministic expected value | Contextual ranking model |
| DraftGuard | Truthful, specific, human-sounding message | Evidence compiler and validators | Learned ranker over message variants and style profile, always under deterministic validators |
| OutcomeLoop | Trusted labels and feedback | Event ledger | Versioned training and calibration pipeline |
| ReplyIQ | Class and meaning of every inbound message | Header rules plus rules-first classifier (section 13) | Calibrated classifier with human audit |
| FairnessGuard | Bias and harm checks across all engines | Feature allow-list and matched-pair tests (section 14) | Continuous slice monitoring and independent audit |

The engines must expose inputs, evidence, score, threshold, algorithm version, and decision reason. No black-box decision may send an email.

### Design principles

1. **Abstain before guessing.** A missing or uncertain decision costs one campaign. A wrong decision costs a recruiter's trust and a candidate's reputation.
2. **Eligibility and ranking are separate.** Deterministic rules decide whether something may be sent. Models only rank what is already eligible.
3. **Claims follow evidence.** No confidence figure is stated until observed outcomes support it, and support means a confidence bound, not a point estimate.
4. **Every decision is reproducible.** Inputs, versions, and reasons are stored so a decision can be replayed and explained.
5. **Learn only from labels that mean what they claim.** A reply is not proof of fit, and silence is not proof of a bad contact.
6. **Fairness is a constraint, not a report.** No engine may use protected or proxy attributes (section 14).
7. **Reversibility.** Every threshold, model, and prompt is versioned, canaried, and roll-backable.

## 1. Profile intelligence

### 1.1 Candidate evidence graph

Convert an accepted CV and approved links into atomic facts rather than a blob of text.

Core node types:

- Person
- Employment
- Project
- Skill
- Tool
- Industry
- Achievement
- Credential
- Work sample
- Role preference
- Location preference
- Constraint

Core edge types:

- worked_at
- used_skill
- delivered_project
- achieved_outcome
- has_scope
- targets_role
- excludes_company
- prefers_location
- supports_claim

Example:

| Atomic fact | Source |
|---|---|
| Managed a three-person analytics team | CV bullet, accepted version 3 |
| Built weekly retention dashboard in SQL and Looker | CV bullet, accepted version 3 |
| Increased activation by 12 percent | User-approved clarification |
| Targets Product Analyst or Growth Analyst jobs | Candidate preference |

The source pointer is required. Every later draft claim must resolve to one or more facts.

### 1.2 Capability representation

Use two representations together:

1. A controlled taxonomy for job function, skill, seniority, industry, tool, and scope.
2. Embeddings for semantic similarity between phrases that taxonomy does not cover.

The taxonomy prevents semantic similarity from producing nonsensical results. For example, a candidate with data-analysis experience may be semantically close to an analytics engineer job but still lack an explicit engineering requirement.

Maintain mappings:

- Product Analyst maps to analytics, product, experimentation, SQL, stakeholder communication.
- Growth Analyst maps to experimentation, funnel analysis, lifecycle, SQL, dashboards.
- Seniority maps to expected scope, years, leadership, and ambiguity handling.

These mappings should be versioned and reviewed. They are product intellectual property.

### 1.3 CV readiness algorithm

The onboarding score is not just a content score. It determines confidence in all downstream matching.

Initial calculation:

| Dimension | Weight | Example evidence |
|---|---:|---|
| Evidence completeness | 0.20 | Roles, dates, tools, scope |
| Outcome quality | 0.25 | Metrics, before/after, scale |
| Target-role coverage | 0.25 | Skills and projects relevant to target roles |
| Career consistency | 0.15 | Chronology errors, contradictions, and implausible claims. Gaps, career breaks, lateral moves, and non-linear paths are not penalised |
| Communication clarity | 0.15 | Specific, parseable, concise bullets |

Readiness score equals the weighted sum after each dimension is normalized to 0–100.

Important rule: missing evidence is not negative evidence. A candidate without a stated metric loses points for incomplete proof, not because Firstround assumes poor performance.

Career consistency exists to catch errors (overlapping full-time roles, end dates before start dates, impossible tenures), not to judge a career's shape. Employment gaps, career breaks, caregiving, relocation, and non-linear paths carry no penalty.

Contact details, location, and working links are a pass/fail sendability checklist outside this score. The architecture document mirrors these weights.

### 1.4 Claim verification levels

Each atomic fact carries a verification level, which controls whether it may appear in a message:

| Level | Meaning | May appear in outreach |
|---|---|---|
| L3 | Corroborated by an external artefact the candidate links (public repository, published work, certificate page) | Yes |
| L2 | In the accepted CV and attested by the candidate | Yes |
| L1 | Candidate's answer to a clarification question, attested | Yes |
| L0 | Inferred by the system | Never, except as non-factual interest |

Verification level reduces unsupported-claim risk; it does not change a requirement's coverage multiplier in section 3.2.

## 2. Job intelligence

### 2.1 Canonical job graph

Create a graph:

- Job node
- Company node
- Company-domain node
- Source-post node
- Team node
- Location node
- Requirement node
- Person node where job poster/hiring team exists

A canonical job can have many source-post nodes. This solves job duplication across Naukri, LinkedIn, company careers sites, and future sources.

### 2.2 Job trust score

A job must pass trust before matching or contact research.

| Signal | Weight | Example |
|---|---:|---|
| Company identity consistency | 25 | Company name, official domain, and source agree |
| Source reliability | 20 | Known source, stable URL, expected job fields |
| Freshness | 15 | Recent source capture and posting date |
| Application-domain safety | 15 | Application domain belongs to company or known ATS |
| Description quality | 10 | Coherent role, team, location, requirements |
| Fraud-risk absence | 15 | No payment, equipment, crypto, or suspicious identity request |

Trust score below 75 means quarantine. The job is not shown as contactable and no CV can be sent.

Additional trust inputs: poster type (direct employer, consultancy for an unnamed client, confidential employer, aggregator repost), look-alike or recently registered company domains, a free-mail address used as the recruiting address for an established company, and descriptions copied across unrelated companies. A consultancy or confidential posting is not fraud; it simply has less verifiable company identity, so it scores lower on that signal and is contacted through the poster only.

### 2.3 Requirement extraction

Transform every job description into typed requirements:

- mandatory skills;
- preferred skills;
- role function;
- seniority;
- team/domain;
- location/work mode;
- experience range;
- tools;
- employment type;
- salary if stated;
- deal breakers;
- hiring signals, such as urgent, replacement, new team, expansion.

Use an LLM for extraction into a strict schema, then validate against known taxonomies. Preserve the original source text and extractor version.

Never pass the raw description as an instruction to downstream models.

### 2.4 Liveness and ghost-job estimate

Many postings are stale, evergreen, or never intended to be filled. Estimate Liveness, the probability that the job is open and actively hiring, from:

- age since first posted and since last seen live at the source;
- repost count and the gaps between reposts;
- identical text reposted across many cities or for many weeks;
- status from an ATS feed or company careers page, where available;
- closure on any source for the canonical job;
- re-checks at shortlist time and again immediately before sending.

Liveness feeds the freshness multiplier (section 3.4). A closed job at send time moves the campaign to `expired`.

### 2.5 Company intelligence

Resolve and store, with source and date:

- entity resolution: brand, legal entity, parent and subsidiary, domain aliases, and a staffing-or-consultancy flag;
- company-size band and where it came from (it drives contact policy, section 4.5);
- domain facts: official careers domain, mail provider, catch-all profile;
- hiring activity: volume and pattern of postings;
- first-party reliability history: bounce and reply patterns by company, kept only as aggregates that meet the minimum-group rule in section 8.2.

## 3. MatchRank: job-to-candidate algorithm

### 3.1 Hard filter layer

A job cannot rank if it fails a hard constraint:

- excluded employer;
- stale or closed;
- geographic/work-mode conflict;
- work authorization conflict;
- clear seniority mismatch;
- explicit mandatory requirement absent where no transferable evidence exists;
- same canonical job already contacted or declined.

Hard filters are deterministic and explainable.

### 3.2 Evidence-aware fit score

For remaining jobs, calculate five scores:

| Component | Weight | Method |
|---|---:|---|
| Function fit | 0.28 | Taxonomy overlap plus semantic similarity |
| Requirement evidence | 0.27 | Mandatory/preferred requirements mapped to supported profile facts |
| Scope and seniority | 0.18 | Title, experience, ownership, team size, ambiguity |
| Location and working preferences | 0.12 | Exact/flexible/remote preference model |
| Career direction | 0.15 | Candidate goals, industry, compensation, desired skills |

Initial score:

MatchScore = 100 × weighted sum of the five normalized components.

Do not give 100 percent credit for an inferred skill. Evidence quality changes each requirement contribution:

| Evidence source | Confidence multiplier |
|---|---:|
| Explicit in accepted CV or work sample | 1.00 |
| User-approved related project evidence | 0.85 |
| Strong semantic similarity only | 0.55 |
| Assumed from title alone | 0.25 |
| No evidence | 0.00 |

This is a major quality difference from basic keyword matching.

The multipliers above are expert priors, not learned values. Treat them as launch policy, record them in configuration, and test them against labelled job-match pairs before changing them.

Distinguish absence from contradiction. A mandatory requirement with no evidence is uncertainty; evidence that contradicts it (a posting asking eight years of experience for a candidate with three) is a negative signal and can trigger the hard filter. Uncovered mandatory requirements reduce the Requirement evidence component sharply; uncovered preferred requirements affect ranking only.

**From score to probability.** MatchScore is a score, not a probability. Calibrate it into MatchProbability with isotonic or Platt calibration against shortlist accept and decline labels first (the earliest and densest labels), and against reply and interview outcomes later. Until a calibration exists, section 6 ranks on MatchScore and must be labelled uncalibrated.

### 3.3 Requirements coverage

For each required skill:

RequirementCoverage = evidence confidence × recency factor × depth factor.

- Evidence confidence comes from the table above.
- Recency factor declines for old employment unless the candidate still uses the skill.
- Depth factor accounts for one mention versus repeated project-level use.

Mandatory requirements receive higher penalty when uncovered. Preferred requirements affect ranking but not eligibility.

### 3.4 Freshness multiplier

Freshness should alter priority, not merely display a date.

FreshnessMultiplier is a function of age and the Liveness estimate (section 2.4). Until enough data exists, use a transparent placeholder curve, versioned and labelled unvalidated: 1.00 for up to 3 days after posting, falling linearly to 0.60 at 14 days and 0.30 at 30 days, and 0 at 45 days or when any source shows the job closed. These numbers are reviewable placeholders, not findings. Replace them with survival analysis on re-check data (time until closure) by role family and source, and do not pretend the curve is learned before then.

### 3.5 Top-50 selection

The top 50 list is selected by:

JobPriority = MatchScore × JobTrust × FreshnessMultiplier.

All three inputs are scaled 0–1 for multiplication.

This means a highly matched but suspicious or stale job cannot outrank a slightly lower-fit, verified fresh job.

## 4. OwnerGraph: job-to-person algorithm

### 4.1 Graph objective

OwnerGraph selects the one person most likely to help with a specific job. It does not merely find a senior person at the company.

Nodes:

- canonical job;
- company;
- team/function;
- location;
- person;
- employment;
- hiring post;
- recruiter role;
- public source;
- email candidate.

Edges:

- posted_job;
- listed_on_hiring_team;
- works_at;
- recruits_for;
- leads_team;
- located_in;
- announced_hiring;
- supports_identity;
- current_as_of.

### 4.2 Candidate retrieval

Retrieve in this order:

0. an address or instruction in the posting itself (invited channel, section 4.6);
1. explicitly listed hiring manager/hiring team;
2. source job poster;
3. recruiter at company in matching job family/location;
4. team manager/director one level above the advertised role;
5. founder only for small or founder-led companies.

The scraper's people output supplies names and titles. Company pages and public hiring evidence strengthen identity. The algorithm does not create people from language-model imagination.

### 4.3 Owner probability features

| Feature group | Examples |
|---|---|
| Direct linkage | Listed on job, job poster, named in hiring announcement |
| Current employment | Current company, title, date observed, employment-source agreement |
| Team alignment | Title/function maps to job team |
| Seniority fit | Recruiter, team lead, director, VP, founder depending company size |
| Geography | Same country/city/business unit as job |
| Recency | Recent activity, fresh title/employment evidence |
| Source quality | Official company source > current public profile > weak inference |
| Conflict signals | Former employee, unrelated team, generic HR, old title |
| Name ambiguity | Probability that another employee at the company shares the normalised name |
| Role type | Talent acquisition, hiring manager, HR operations, payroll, or administration |

Initial score:

OwnerScore(person, job) = sigmoid of weighted feature sum.

At launch, the weights are transparent and reviewed. Later, fit a learning-to-rank model on labelled outcomes, but preserve hard constraints and evidence requirements.

### 4.4 Pairwise confidence and abstention

The top score alone is insufficient. Calculate:

OwnerMargin = top candidate score minus second candidate score.

Send only when:

- top OwnerScore is at least 0.80;
- OwnerMargin is at least 0.10, unless the person is explicitly listed on the job;
- current-employment evidence is fresh;
- candidate has no conflict signal.

Otherwise abstain. The system should prefer fewer correct contacts over more uncertain emails.

Record the abstention reason, because the reasons drive improvement: no sourced person, below the score threshold, margin too small, stale employment evidence, conflict signal, name ambiguity, consultancy with no named poster, recipient capacity, or suppression.

### 4.5 Company-size policy

Company size changes who is likely to own hiring:

| Company profile | Preferred contact |
|---|---|
| Early-stage/small | Founder or direct functional lead |
| Mid-size | Functional hiring manager or recruiter |
| Enterprise | Relevant recruiter, talent partner, or named hiring team member |
| Staffing or consultancy posting | The posting consultant. Never guess the unnamed client's hiring manager |

Company-size bands must be stored as policy data, not buried inside prompts.

### 4.6 Invited channel

If a posting tells applicants to send a CV to a specific address, that address is the selected recipient and OwnerGraph ranking is skipped. Safeguards:

- the address and its source span are stored verbatim, extracted by a strict de-obfuscation parser, never by a model;
- the address domain should relate to the company or to the consultancy; a mismatch lowers job trust (section 2.2);
- a free-mail address is never Autopilot-eligible; Review mode shows a warning;
- role-based addresses (hr@, careers@, jobs@) are allowed on this path only;
- the recipient and company caps still apply, because an invitation to send a CV is not an invitation to receive unlimited messages;
- messages on this path make no claims about a named person, because none was identified.

## 5. AddressProof: person-to-email algorithm

### 5.1 Goal

AddressProof estimates two different probabilities:

- P(mailbox receives mail)
- P(mailbox belongs to selected person)

A verifier primarily helps the first. Firstround's identity evidence helps the second.

### 5.2 Candidate generation

Generate candidates only for selected people:

1. direct public corporate email;
2. pattern inferred from two or more independently sourced current company emails;
3. maximum three candidate addresses derived from supported patterns.

Pattern evidence tracks:

- company domain;
- pattern shape;
- supporting addresses;
- source quality;
- source date;
- employee current-status evidence.

### 5.3 Address identity score

| Signal | Weight |
|---|---:|
| Direct public source ties address to person | 0.40 |
| Pattern support and independence | 0.20 |
| Local-part name correspondence | 0.15 |
| Corporate-domain match | 0.10 |
| Person current employment evidence | 0.10 |
| Pattern freshness | 0.05 |

AddressIdentityScore is separate from Hunter.

**Name-collision adjustment.** A pattern-derived address can reach a different person with the same name. Estimate the collision risk as 1 minus e to the power of minus (N times f), where N is the company's likely headcount in the relevant country and f is the frequency of the normalised name from a versioned name-frequency table. Frequency is used only to count likely collisions; it is never used to infer origin, gender, or any other attribute, and the table stores no such attributes. Then:

AdjustedIdentity = AddressIdentityScore × (1 − CollisionRisk × (1 − DirectEvidence))

where DirectEvidence is 1 when a public source ties the address to the person and 0 for pattern-only evidence. High collision risk therefore demands direct evidence. Initials-first names raise f and are handled explicitly.

### 5.4 Mailbox confidence

Inputs:

- syntax and domain normalization;
- MX/Null-MX result;
- disposable/free-mail suppression;
- known past hard bounce;
- Hunter status and score;
- Hunter public source evidence if returned;
- catch-all/blocked state;
- first-party delivery, bounce, and reply history where available.

Policy:

- valid Hunter result plus strong identity evidence can pass;
- accept-all means uncertain, not valid;
- unknown means uncertain, not invalid;
- hard invalid or suppression ends the candidate;
- first-party hard bounce creates high-weight negative evidence;
- first-party human reply creates high-weight positive evidence for that person-address pair.

### 5.5 Calibration

Do not call a result 95 percent confident until observed outcomes support that number.

For every confidence band, compare predicted confidence with observed permanent-failure rate. Recalibrate periodically using held-out recent data.

Example:

| Predicted band | Observed hard-bounce ceiling |
|---|---:|
| 95–100 | Under 2 percent |
| 90–94 | Under 4 percent |
| 80–89 | Not sendable at launch; eligible only for second-verifier arbitration (section 5.8) |
| Below 80 | Not sendable |

If observed outcomes degrade, raise send thresholds automatically and investigate the source/pattern provider.

### 5.6 Statistical rules for confidence claims

- Compare a band's ceiling with the Wilson 95 percent upper bound on its observed hard-failure rate, not with failures divided by sends. With zero failures in n sends the upper bound is about 3 divided by n (the rule of three). Showing a ceiling under 2 percent therefore needs at least 150 failure-free sends, and under 1 percent needs at least 300. With 3 failures in 300 sends the upper bound is about 2.9 percent.
- Label windows are configuration: bounces are usually final within about 72 hours, replies within about 14 days. Do not train on outcomes still inside the window.

### 5.7 Selection bias and how to learn safely

The system never sends below 90, so it cannot observe failure rates below 90. The ceilings stated for lower bands are policy, not measured claims. Learn about them without sending below the line:

1. run the verifier benchmark rig (controlled mailboxes across providers; architecture section 8.5);
2. compare verifiers against each other on addresses that were never sent;
3. use a second verifier as arbitration for the 80 to 89 band;
4. lower a threshold only through a pre-registered, candidate-consented pilot with a hard stop, never on unobserved data.

### 5.8 Verifier arbitration

Verification sits behind a provider interface. For an address in the 80 to 89 band, query one second independent verifier. Treat the address as eligible only if both return valid and identity evidence passes. Weight each verifier by its measured accuracy on the benchmark rig for that mail-provider type, and re-measure weekly. Verifiers can drift silently, so monitor each one's result mix.

## 6. CampaignRank: which ten jobs to send today

Selecting the top ten raw job matches wastes capacity. A job may fit well but lack a safe contact or be too stale.

CampaignRank selects by expected value:

ExpectedCampaignValue = MatchProbability × ContactProbability × EmailDeliverabilityProbability × FreshnessMultiplier × CandidatePreferenceMultiplier × RecipientCapacityMultiplier.

All terms are constrained to 0–1.

Interpretation:

- MatchProbability: candidate likely wants and qualifies for job.
- ContactProbability: owner/recruiter is correctly chosen.
- EmailDeliverabilityProbability: address is safe to reach.
- FreshnessMultiplier: job is still timely.
- CandidatePreferenceMultiplier: user preference for role/company/location.
- RecipientCapacityMultiplier: reduces to zero when recipient fatigue guard blocks outreach.

Only the top ten positive expected-value campaigns become daily drafts, within the cascade of architecture section 6.4 (research is paid for only where a free contactability prior justifies it).

### 6.1 Portfolio rule

Avoid ten nearly identical roles from one company, recruiter, city, or source.

Daily job set should satisfy diversity constraints:

- maximum two campaigns to one company;
- maximum one campaign to one recipient;
- maximum three jobs in same narrow role family;
- preserve user-selected priorities;
- include at least one high-confidence opportunity over merely high semantic fit.

This produces a more useful search strategy and reduces correlated failure.

Because ten slots and a handful of constraints make this a small problem, select greedily by expected value with the constraints enforced at each step, and record which constraint excluded each rejected item.

### 6.2 Capacity allocation between candidates

When several candidates compete for the same recipient or company slot, do not allocate first-come-first-served. Run the allocation once per day in a central batch, before drafts are created:

1. compute each candidate's expected value for the contested slot;
2. give the slot to the highest value, with an anti-starvation boost for any candidate who lost a contested slot in the last few days;
3. offer losing candidates their next-best eligible job;
4. store every allocation decision with its inputs.

At small scale this is rarely binding. It becomes a marketplace fairness problem as users grow, so build the record now.

### 6.3 What the formula means and what it must not claim

- The terms are not independent. Contact and address evidence are correlated: a named poster with a published email raises both. To avoid double counting, estimate a joint ReachProbability = P(owner) × P(address belongs to owner given owner) × P(mailbox receives mail), not three unconditional factors.
- The target is a useful outcome (a human, relevant reply), not mere delivery.
- When calibrated, rank on NetValue = V × P(useful) − C − λ × Fatigue, where V is the candidate's value of a useful reply, C is the credit and provider cost, and Fatigue is the recipient-fatigue cost. Before calibration, rank on a transparent product of ranks and label the output uncalibrated. Never compare expected values across algorithm versions.

### 6.4 Exploration under hard safety limits

Reserve at most one of the ten slots for exploration among campaigns that already pass every gate but whose estimate is uncertain (Thompson sampling or an upper-confidence rule). Exploration never relaxes a gate. Log the probability with which each campaign was selected. Without logged selection probabilities, learning from sent campaigns only is biased, because the system observes outcomes only for what it chose to send, and counterfactual evaluation (inverse-propensity weighting) is impossible.

## 7. DraftGuard: message algorithm

### 7.1 Evidence compiler

Drafting begins with a structured plan, not an open prompt.

Input blocks:

- role facts;
- company/team facts;
- recipient facts;
- candidate facts;
- approved link list;
- requested call to action;
- prohibited claims;
- user style profile.

Every sentence must be one of:

- job reference;
- candidate evidence;
- genuine interest;
- low-pressure ask;
- sign-off.

Every factual sentence carries source IDs.

### 7.2 Specificity score

Score each draft:

| Dimension | Weight |
|---|---:|
| Candidate evidence relevance | 30 |
| Job specificity | 25 |
| Recipient relevance | 15 |
| Factual support | 20 |
| Tone and brevity | 10 |

Drafts must score at least 85 and pass every safety validator. A score cannot override a missing factual source.

When a dimension does not apply (for example Recipient relevance on an invited generic mailbox, where no recipient facts exist), mark it not applicable and rescale the remaining weights to 100, then apply the 85 threshold to the rescaled score. Otherwise such drafts could never exceed 85.

### 7.3 Personalization learning

Keep a user-level StyleProfile, not a global fine-tune:

- preferred length;
- direct/formal/warm tone;
- phrases user removes;
- phrases user keeps;
- preferred call to action;
- edit distance from generated draft;
- send/approve decision.

Use accepted edits to rank future variants. Do not use private inbox content as training data.

### 7.4 Validators and audit

Deterministic validators decide, in this order: required fields, length, source IDs on every factual sentence, entailment of each factual sentence by its cited facts (a rule check plus a natural-language-inference check, with the rule check able to veto), prohibited phrases, link and attachment rules, salutation rules (first name only, no inferred honorifics), and the courteous stop line. A model critic may judge style and specificity but can never override a failed validator.

Sample about 2 percent of sent drafts each week for human audit of factual support, and feed any failure into the regression set. A validator failure found after sending is an incident.

## 8. OutcomeLoop: proprietary data flywheel

The moat is the outcome graph produced from lawful, user-benefiting operation:

- job → company → team → person → address → message → outcome;
- source timestamps;
- rejected candidates;
- user approval/edits;
- bounce and reply taxonomy;
- contact capacity state;
- job freshness at send;
- campaign timing.

Outcome labels:

| Event | Meaning |
|---|---|
| Hard bounce | Strong negative address evidence |
| Soft bounce | Temporary/mail-server outcome, not identity proof |
| Human reply | Strong positive thread/contact outcome |
| Redirect to recruiter/team | Positive contact relevance; add new contact evidence |
| Request to apply | Positive relevance but no interview proof |
| Decline/no opening | Contact may be correct; job status is negative |
| Auto-acknowledgement | Stops follow-ups; not positive contact evidence |
| Out-of-office | Defers the next follow-up; no evidence either way |
| Opt-out or do not contact | Hard stop and global suppression; negative for that recipient only, not for the job |
| Wrong person | Negative OwnerGraph label for that person-job pair; store any redirect as new evidence |
| Interview or call arranged (reported or detected) | Strongest positive outcome |
| Shortlist accept or decline | Earliest and densest label for MatchRank |
| Candidate reports wrong contact | Negative OwnerGraph label |
| No reply | Weak, ambiguous signal |

### 8.1 Learning sequence

Phase one: rules with logged outcomes.

Phase two: calibrated models trained only after sufficient labelled samples.

Phase three: contextual ranking, initially as constrained exploration inside hard eligibility rules.

The system must never learn from a reply as if it proves a candidate was qualified or that an email was valid without considering the event type.

### 8.2 Data boundaries

- Cross-user learning can use de-identified aggregate signals such as company pattern reliability or recipient capacity.
- User CV content, message content, and Gmail data must not become general training data without explicit documented consent and policy support.
- Preserve raw evidence needed to explain a decision; expire unnecessary personal content by retention policy.
- Aggregate cross-user signals only above a minimum group size (for example at least 10 distinct candidates and 5 distinct recipients per company pattern), so no aggregate can single out one recipient or candidate.
- Recipient opt-outs and removal requests are honoured in every dataset, and removed recipients are excluded from training.

### 8.3 Label sources, delay, and selection bias

- **Earliest labels:** shortlist accept and decline, wrong-contact reports, and draft edits. These arrive within a day and need no email to be sent.
- **Slower labels:** bounces (days), replies (up to about two weeks), and self-reported interviews (weeks).
- **Selection bias:** outcomes exist only for what was sent. Log all considered alternatives and their selection probabilities (section 6.4) so training and evaluation can correct for it.
- **Feedback loops:** a model that learns from its own selections tends to reinforce them. Keep the exploration slot and a held-out evaluation set that the model never selects from.
- **Label meaning:** a reply is not evidence of fit or deliverability on its own. Always use the class from ReplyIQ.

## 9. Evaluation framework

### 9.1 Offline gold sets

Maintain labelled sets for:

- CV extraction;
- job requirement extraction;
- job-match pairs;
- job-to-person ownership;
- person-to-email linkage;
- email deliverability;
- draft factual support;
- scam/suspicious-job detection.

Split train/test data by time and company. Otherwise the model will memorize a company and appear better than it is.

### 9.2 Required metrics

| Engine | Primary metric | Safety metric |
|---|---|---|
| CV extraction | Fact precision/recall | Unsupported fact rate |
| Job matching | Precision at 10 | Hard-filter violation rate |
| OwnerGraph | Top-1 person precision | Wrong-team contact rate |
| AddressProof | Hard-bounce rate by confidence band | Catch-all false-positive rate |
| CampaignRank | Replies per credit | Recipient fatigue/cap violations |
| DraftGuard | Approval/edit rate | Unsupported claim rate |
| ReplyIQ | Macro F1 across classes | Follow-ups sent after a human reply; human replies misread as automated |
| FairnessGuard | Matched-pair score and draft deltas | Features outside the allow-list |

### 9.3 Release gate

A model or prompt version may move to production only if it beats the current version on its primary metric and does not worsen any safety metric. Roll out as a canary, observe live safety metrics, then increase exposure.

### 9.4 Datasets and labelling

- Label each gold set with two independent labellers and an adjudicator, and report inter-annotator agreement (target kappa of at least 0.8, or revise the guideline).
- Size each set to the precision it must show; compute the size from the confidence interval needed, not from convenience.
- Prevent leakage: split by time and company, and remove near-duplicate jobs, near-duplicate CVs, and repeated recipients across splits.
- Include hard negatives: similar-but-wrong roles, same-name collisions, consultancy postings, scam postings, out-of-office replies that quote the original message.
- Refresh quarterly, and add every incident as a permanent regression case.

### 9.5 Slices and calibration

- Report every metric by role family, seniority, company-size band, source, location tier, and CV-completeness band, and by the fairness tests in section 14.
- Measure calibration with reliability curves, expected calibration error, and Brier score, with bootstrap confidence intervals.
- Monitor drift on feature distributions, verifier result mix, and reply-class mix.

### 9.6 Release statistics

A new version ships only if the improvement on its primary metric has a 95 percent confidence interval above zero, and each safety metric is non-inferior within a pre-registered margin. Point estimates alone never release a change. Run in shadow mode first (score everything, use nothing), then canary on a small, randomly selected share of campaigns with automatic rollback triggers on bounce, wrong-contact, unsupported-claim, and opt-out rates.

### 9.7 Adversarial test suite

Maintain tests for: prompt injection in job descriptions, CVs, and web pages; look-alike and homoglyph company domains; obfuscated email addresses; hidden text and HTML tricks; fake recruiter profiles; reply messages that imitate out-of-office text; and malformed documents.

### 9.8 Reproducibility

Pin dataset hashes, seeds, model and prompt versions, and feature schemas in the registry, so any reported number can be regenerated.

## 10. Initial algorithm thresholds

These are starting policies, not permanent truths. Store them as configuration.

| Rule | Launch value |
|---|---:|
| Job trust minimum | 75 |
| Job match minimum | 78 |
| Owner score minimum | 0.80 |
| Owner margin minimum | 0.10 |
| Address identity minimum | 0.75 |
| Mailbox confidence minimum | 0.90 |
| Draft specificity minimum | 85 |
| Daily campaigns/candidate | 10 |
| Candidate-to-recipient cooldown | 21 days |
| Platform recipient cap/day | 3 initial messages |
| Platform recipient cap/30 days | 10 initial messages |
| Autopilot hard-bounce stop level | Upper 95 percent bound at 3 percent, minimum 300 sends |
| Research set per candidate per day | 15 to 20 jobs |
| Verified candidates per job | 2 maximum |
| Campaigns per company per candidate per day | 2 maximum |
| Platform company-domain cap per day | 10 initial messages |
| Follow-up schedule | Business days 2 and 5 |
| Reply label window | Bounce about 72 hours; reply about 14 days |
| Exploration share | At most 1 of 10 slots |

When measured evidence supports changing a threshold, change it through configuration, experiment record, and versioned approval. Never silently alter model behavior.

## 11. Why this can become proprietary

Code for web scraping, email verification, and LLM drafting is easy to copy. Firstround becomes difficult to copy when it has:

1. A role and skill taxonomy tuned to job seekers.
2. Job-to-owner evidence graph and historical success labels.
3. Company-specific email-pattern reliability and freshness model.
4. Candidate-specific profile evidence graph.
5. Job-specific outcome data, rather than generic sales-contact data.
6. A campaign portfolio policy that allocates limited daily sends to highest expected value.
7. A factual drafting compiler and edit-learning style profile.
8. A data-quality, calibration, and release discipline competitors cannot reproduce overnight.
9. A recruiter preference registry: consented, verified ownership and channel data that no scraper can obtain (architecture section 21.22).
10. Transparency and trust: published methodology, quality metrics, and independent audits that earn recipient and candidate confidence.
11. A fairness record: matched-pair testing and documented controls that an employer-side regulator or partner can inspect.

The proprietary asset is not a single secret formula. It is the system of evidence, labels, calibration, and feedback that improves every decision while remaining explainable.

### 11.1 Path to an industry standard

A product becomes a standard when others can rely on its definitions. Publish, over time: the evidence schema for job-contact decisions; the reply taxonomy; the quality metrics (wrong-contact, bounce, opt-out) as quarterly aggregates; and an evaluation benchmark built from consented, privacy-preserving data. Invite independent review. These make Firstround's decisions checkable by recruiters, candidates, and regulators, which is the opposite of a black box and the reason it can last.

## 12. Build order

1. Build schemas, source evidence, hard filters, and rule-based scores.
2. Launch Review mode with complete audit records, rules-based ReplyIQ, the FairnessGuard feature allow-list, and the verifier benchmark rig.
3. Collect outcome taxonomy and calibrate email/contact confidence.
4. Add Autopilot only after safety gates pass.
5. Train and canary one engine at a time: MatchRank, then OwnerGraph, then AddressProof, then CampaignRank.
6. Keep DraftGuard's validators deterministic even after other models improve. A learned component may rank only variants that already pass them.
7. Add a second verifier and arbitration before widening Autopilot.
8. Add exploration, capacity allocation, and counterfactual evaluation once selection probabilities have been logged long enough to use.

## 13. ReplyIQ: inbound message classification

**Purpose.** Decide what every inbound message in a campaign thread is, so that the campaign stops, defers, or continues correctly and the outcome label is honest.

**Inputs.** Headers (From, Auto-Submitted, Precedence, X-Autoreply, Content-Type, In-Reply-To, References), thread context, and body text. Message text is untrusted data and is never executed as instructions.

**Method.** Stage 1: deterministic rules on headers and structure (automated-message headers, delivery-status reports, known bounce senders). Stage 2: a classifier for the remaining human-written text. Stage 3: a human review queue for low-confidence cases.

**Outputs.** Class, confidence, evidence span, classifier version; for out-of-office, the parsed return date; for a redirect, the named contact. The classes and actions are defined in architecture section 21.13.

**Asymmetric errors.** Treating a human reply as an automated one is the worst error, because a follow-up then goes to someone who answered. Treating an automated message as human merely stops follow-ups early. When uncertain between human and automated, choose human and stop.

**Targets.** Set per-class targets from the gold set before launch. At minimum: no human reply in the gold set classified as out-of-office or auto-acknowledgement, and automated-class precision high enough that deferral never delays a follow-up wrongly. Report macro F1 and per-class recall with confidence intervals.

## 14. FairnessGuard

**Allow-list.** Ranking, matching, contact selection, and drafting may not use name-derived attributes, photo, age or date of birth, gender, religion, caste, marital status, disability, or inferred nationality or region. Prestige of college or employer is used only as a candidate-stated preference.

**Counterfactual tests.** Swap names (across regions, genders, and naming conventions) in otherwise identical CVs and recipient records, and confirm that scores, shortlists, contact choices, and drafts do not change beyond a pre-registered tolerance. Run on every release candidate.

**Slice reporting.** Report quality metrics by the slices in section 9.5. Where self-identified attributes are collected, collect them voluntarily, under separate consent, store them apart from operational data, and use them only for audit.

**Escalation.** A failed counterfactual test or an allow-list violation blocks release. Findings are logged in a risk register and reviewed on a fixed cadence.

## 15. Failure modes and adversarial analysis

| Failure mode | Effect | Detection | Mitigation |
|---|---|---|---|
| Two employees share a name | Message reaches the wrong person | Wrong-contact reports; collision-risk feature | Collision adjustment; direct evidence required when risk is high |
| Person left the company | Undeliverable or wrong person | Employment freshness; bounces | Job-change conflict signal; freshness requirement |
| Catch-all domain returns "valid" | False confidence | Accept-all flag; benchmark rig | Treat as uncertain; invited-channel exception only |
| Spam trap | Sender reputation damage | Complaint and blocklist signals | Send only to verified, identity-supported addresses; domain suppression |
| Look-alike company domain in scraped data | CV sent to an impostor | Domain age and similarity checks | Job trust gate; official-domain match |
| Scam posting | Candidate harm | Trust signals; reports | Quarantine below 75; never send CV |
| Prompt injection in job text | Model misbehaviour | Output validators; adversarial suite | Typed extraction; delimited untrusted text; strict schemas |
| Ghost or evergreen job | Wasted campaign | Liveness estimate | Liveness in ranking; re-check at send |
| Same job under different IDs | Double contact | Canonical-job deduplication | Canonical job key; per-recipient cooldown |
| Many candidates target one recruiter | Fatigue and complaints | Recipient and company caps | Global caps; central allocation |
| Verifier silently changes behaviour | Hidden accuracy loss | Result-mix drift; benchmark rig | Weekly rig runs; second verifier |
| Model learns from its own selections | Feedback loop | Held-out set; exploration slot | Logged propensities; exploration; held-out evaluation |
| Human reply read as automated | Follow-up after a reply | Gold set; stop-latency alert | Asymmetric rule: uncertain means stop |
| Candidate misrepresents experience | Reputational harm | Consistency checks | Claim register and attestation; verification levels |
| Provider or API change | Silent breakage | Contract tests | Weekly contract tests; feature flags; kill switches |
| Label leakage in evaluation | Inflated metrics | Split audits | Time and company splits; near-duplicate removal |

