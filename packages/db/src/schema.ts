import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const campaignStateEnum = pgEnum('campaign_state', [
  'drafted',
  'pending_approval',
  'approved',
  'queued',
  'sending',
  'uncertain_send',
  'sent',
  'awaiting_followup_1',
  'followup_1_sent',
  'awaiting_followup_2',
  'followup_2_sent',
  'closed_no_reply',
  'replied',
  'opted_out',
  'bounced',
  'cancelled_by_user',
  'cancelled_by_policy',
  'expired',
  'paused',
]);

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    firebaseUid: text('firebase_uid').notNull(),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_firebase_uid_uidx').on(table.firebaseUid)],
);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  reason: text('reason'),
  policyVersion: text('policy_version'),
  modelVersion: text('model_version'),
  promptVersion: text('prompt_version'),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const encryptedTokens = pgTable(
  'encrypted_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 64 }).notNull(),
    purpose: varchar('purpose', { length: 64 }).notNull(),
    ciphertext: text('ciphertext').notNull(),
    nonce: text('nonce').notNull(),
    keyVersion: integer('key_version').notNull(),
    scopes: text('scopes').array().notNull().default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('encrypted_tokens_user_provider_purpose_uidx').on(
      table.userId,
      table.provider,
      table.purpose,
    ),
  ],
);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  state: campaignStateEnum('state').notNull().default('drafted'),
  jobCanonicalId: text('job_canonical_id'),
  recipientEmail: text('recipient_email'),
  draftHash: text('draft_hash'),
  gmailThreadId: text('gmail_thread_id'),
  gmailMessageId: text('gmail_message_id'),
  initialSendConfirmed: boolean('initial_send_confirmed').notNull().default(false),
  creditDebited: boolean('credit_debited').notNull().default(false),
  policyVersions: jsonb('policy_versions').$type<Record<string, string>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaignTransitions = pgTable('campaign_transitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  fromState: campaignStateEnum('from_state').notNull(),
  toState: campaignStateEnum('to_state').notNull(),
  actor: text('actor').notNull(),
  reason: text('reason').notNull(),
  policyVersion: text('policy_version'),
  modelVersion: text('model_version'),
  promptVersion: text('prompt_version'),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const creditLedger = pgTable('credit_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const configRegistry = pgTable(
  'config_registry',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    owner: text('owner').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('config_registry_key_version_uidx').on(table.key, table.version)],
);

export const sourceRegister = pgTable(
  'source_register',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceKey: text('source_key').notNull(),
    displayName: text('display_name').notNull(),
    jurisdiction: text('jurisdiction').notNull().default('IN'),
    legalStatus: text('legal_status').notNull().default('pending_counsel'),
    /** When true, source is emergency-stopped and cannot ingest. */
    killSwitch: boolean('kill_switch').notNull().default(false),
    /** When false, source stays registered but will not start new runs. */
    enabled: boolean('enabled').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('source_register_source_key_uidx').on(table.sourceKey)],
);

export const jobSourceRunStatusEnum = pgEnum('job_source_run_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

export const jobPosterTypeEnum = pgEnum('job_poster_type', [
  'direct',
  'consultancy',
  'confidential',
  'aggregator',
  'unknown',
]);

export const jobSourceRuns = pgTable('job_source_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceKey: text('source_key').notNull(),
  status: jobSourceRunStatusEnum('status').notNull().default('queued'),
  actorId: text('actor_id'),
  actorRunId: text('actor_run_id'),
  datasetId: text('dataset_id'),
  input: jsonb('input').$type<Record<string, unknown>>().default({}).notNull(),
  error: text('error'),
  jobsFetched: integer('jobs_fetched').notNull().default(0),
  jobsUpserted: integer('jobs_upserted').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rawJobs = pgTable(
  'raw_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceKey: text('source_key').notNull(),
    sourceRunId: uuid('source_run_id')
      .notNull()
      .references(() => jobSourceRuns.id, { onDelete: 'cascade' }),
    providerJobId: text('provider_job_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    sourceUrl: text('source_url'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
    parserVersion: text('parser_version').notNull().default('1'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('raw_jobs_source_provider_uidx').on(table.sourceKey, table.providerJobId),
  ],
);

export const canonicalJobs = pgTable(
  'canonical_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fingerprint: text('fingerprint').notNull(),
    title: text('title').notNull(),
    normalizedTitle: text('normalized_title'),
    companyName: text('company_name').notNull(),
    companyDomain: text('company_domain'),
    location: text('location'),
    workMode: text('work_mode'),
    employmentType: text('employment_type'),
    seniority: text('seniority'),
    descriptionText: text('description_text').notNull().default(''),
    sourceUrl: text('source_url'),
    applicationUrl: text('application_url'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    posterType: jobPosterTypeEnum('poster_type').notNull().default('unknown'),
    trustScore: integer('trust_score').notNull().default(0),
    trustBreakdown: jsonb('trust_breakdown').$type<Record<string, number>>().default({}).notNull(),
    quarantined: boolean('quarantined').notNull().default(true),
    stale: boolean('stale').notNull().default(false),
    invitedEmail: text('invited_email'),
    invitedEmailSpan: text('invited_email_span'),
    skills: text('skills').array().notNull().default([]),
    meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
    algorithmVersion: text('algorithm_version').notNull().default('job-trust-1'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('canonical_jobs_fingerprint_uidx').on(table.fingerprint)],
);

export const jobSourceLinks = pgTable(
  'job_source_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    canonicalJobId: uuid('canonical_job_id')
      .notNull()
      .references(() => canonicalJobs.id, { onDelete: 'cascade' }),
    rawJobId: uuid('raw_job_id')
      .notNull()
      .references(() => rawJobs.id, { onDelete: 'cascade' }),
    sourceKey: text('source_key').notNull(),
    sourceUrl: text('source_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('job_source_links_raw_uidx').on(table.rawJobId)],
);

export const gateDecisions = pgTable('gate_decisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  canonicalJobId: uuid('canonical_job_id')
    .notNull()
    .references(() => canonicalJobs.id, { onDelete: 'cascade' }),
  overallPass: boolean('overall_pass').notNull(),
  decisions: jsonb('decisions').$type<Record<string, unknown>[]>().default([]).notNull(),
  skipReason: text('skip_reason'),
  algorithmVersion: text('algorithm_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaignDrafts = pgTable('campaign_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull().default(''),
  draftHash: text('draft_hash'),
  specificity: integer('specificity').notNull().default(0),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().default({}).notNull(),
  status: text('status').notNull().default('pending_approval'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const onboardingStepEnum = pgEnum('onboarding_step', [
  'account',
  'cv',
  'readiness',
  'preferences',
  'gmail',
  'done',
]);

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  onboardingStep: onboardingStepEnum('onboarding_step').notNull().default('account'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cvDocuments = pgTable('cv_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  fileKey: text('file_key').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256'),
  originalFilename: text('original_filename'),
  status: text('status').notNull().default('uploaded'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cvExtractions = pgTable('cv_extractions', {
  id: uuid('id').defaultRandom().primaryKey(),
  cvDocumentId: uuid('cv_document_id')
    .notNull()
    .references(() => cvDocuments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  schemaVersion: text('schema_version').notNull(),
  modelVersion: text('model_version').notNull(),
  promptVersion: text('prompt_version').notNull(),
  facts: jsonb('facts').$type<Record<string, unknown>>().default({}).notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cvReadinessScores = pgTable('cv_readiness_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  cvDocumentId: uuid('cv_document_id')
    .notNull()
    .references(() => cvDocuments.id, { onDelete: 'cascade' }),
  extractionId: uuid('extraction_id')
    .notNull()
    .references(() => cvExtractions.id, { onDelete: 'cascade' }),
  total: integer('total').notNull(),
  dimensions: jsonb('dimensions').$type<Record<string, number>>().default({}).notNull(),
  gaps: jsonb('gaps').$type<string[]>().default([]).notNull(),
  sendability: jsonb('sendability').$type<Record<string, unknown>>().default({}).notNull(),
  algorithmVersion: text('algorithm_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const preferences = pgTable('preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  jobFamilies: text('job_families').array().notNull().default([]),
  locations: text('locations').array().notNull().default([]),
  targetLevel: text('target_level'),
  links: jsonb('links').$type<Record<string, string>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
