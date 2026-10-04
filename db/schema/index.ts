// Typed Drizzle mapping. Constraints, indexes, triggers and RLS live in 0000_foundation.sql.
import { pgTable, text, uuid, jsonb, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  source_type: text('source_type').notNull(),
  connector_type: text('connector_type').notNull(),
  endpoint: text('endpoint').notNull(),
  connector_health: text('connector_health').notNull(),
  is_demo_fixture: boolean('is_demo_fixture').notNull().default(false),
  rights_note: text('rights_note'),
  field_roles_json: jsonb('field_roles_json').notNull(),
  content_level: text('content_level').notNull(),
  last_checked_at: timestamp('last_checked_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sourceChecks = pgTable('source_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  source_id: text('source_id').notNull(),
  trigger_type: text('trigger_type').notNull(),
  status: text('status').notNull(),
  error_code: text('error_code'),
  raw_sha256: text('raw_sha256'),
  source_version_id: uuid('source_version_id'),
  checked_at: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sourceVersions = pgTable('source_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  source_id: text('source_id').notNull(),
  previous_version_id: uuid('previous_version_id'),
  upstream_version_label: text('upstream_version_label').notNull(),
  revision_number: integer('revision_number').notNull(),
  upstream_published_at: timestamp('upstream_published_at', { withTimezone: true }),
  raw_sha256: text('raw_sha256').notNull(),
  canonical_sha256: text('canonical_sha256').notNull(),
  status: text('status').notNull(),
  silent_mutation: boolean('silent_mutation').notNull().default(false),
  change_class: text('change_class'),
  raw_snapshot_path: text('raw_snapshot_path').notNull(),
  canonical_snapshot_path: text('canonical_snapshot_path').notNull(),
  record_count: integer('record_count').notNull(),
  provider_checksum: text('provider_checksum'),
  signature_status: text('signature_status'),
  detected_at: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
});

export const records = pgTable('records', {
  id: uuid('id').primaryKey().defaultRandom(),
  source_version_id: uuid('source_version_id').notNull(),
  canonical_key: text('canonical_key').notNull(),
  upstream_record_id: text('upstream_record_id'),
  content_json: jsonb('content_json').notNull(),
  metadata_json: jsonb('metadata_json').notNull(),
  record_hash: text('record_hash').notNull(),
  field_hashes: jsonb('field_hashes').notNull(),
  content_level_override: text('content_level_override'),
});

export const changes = pgTable('changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  from_version_id: uuid('from_version_id'),
  to_version_id: uuid('to_version_id').notNull(),
  canonical_key: text('canonical_key').notNull(),
  old_record_id: uuid('old_record_id'),
  new_record_id: uuid('new_record_id'),
  change_type: text('change_type').notNull(),
  field_path: text('field_path'),
  field_role: text('field_role'),
  old_value: jsonb('old_value'),
  new_value: jsonb('new_value'),
  old_field_hash: text('old_field_hash'),
  new_field_hash: text('new_field_hash'),
  diff_flags: jsonb('diff_flags').notNull(),
  diff_json: jsonb('diff_json').notNull(),
});

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  source_id: text('source_id').notNull(),
  previous_version_id: uuid('previous_version_id'),
  candidate_version_id: uuid('candidate_version_id').notNull(),
  primary_change_id: uuid('primary_change_id'),
  status: text('status').notNull(),
  risk_level: text('risk_level'),
  effective_policy_action: text('effective_policy_action'),
  title: text('title').notNull(),
  summary: text('summary'),
  context_packet_json: jsonb('context_packet_json'),
  context_packet_hash: text('context_packet_hash'),
  escalated: boolean('escalated').notNull().default(false),
  opened_at: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
});

export const analyses = pgTable('analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  incident_id: uuid('incident_id').notNull(),
  change_id: uuid('change_id'),
  analysis_type: text('analysis_type').notNull(),
  risk_level: text('risk_level').notNull(),
  output_json: jsonb('output_json').notNull(),
  context_packet_hash: text('context_packet_hash').notNull(),
  provider: text('provider'),
  model: text('model'),
  prompt_version: text('prompt_version'),
  meta_json: jsonb('meta_json').notNull(),
  identity_hash: text('identity_hash'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const assets = pgTable('assets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  asset_type: text('asset_type').notNull(),
  status: text('status').notNull(),
  metadata_json: jsonb('metadata_json').notNull(),
});

export const assetSourceRecords = pgTable('asset_source_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  asset_id: text('asset_id').notNull(),
  source_id: text('source_id').notNull(),
  canonical_key: text('canonical_key').notNull(),
  derived_from_version_id: uuid('derived_from_version_id').notNull(),
  derivation_mode: text('derivation_mode').notNull(),
});

export const dependencies = pgTable('dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  from_asset_id: text('from_asset_id').notNull(),
  to_asset_id: text('to_asset_id').notNull(),
  dependency_type: text('dependency_type').notNull(),
});

export const protectedApps = pgTable('protected_apps', {
  id: text('id').primaryKey(),
  asset_id: text('asset_id').notNull(),
  name: text('name').notNull(),
  endpoint: text('endpoint'),
  description: text('description'),
});

export const gatewayBindings = pgTable('gateway_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),
  protected_app_id: text('protected_app_id').notNull(),
  source_id: text('source_id').notNull(),
  served_version_id: uuid('served_version_id').notNull(),
  latest_seen_version_id: uuid('latest_seen_version_id').notNull(),
  gateway_status: text('gateway_status').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const regressionRuns = pgTable('regression_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  incident_id: uuid('incident_id'),
  pipeline_run_id: uuid('pipeline_run_id'),
  source_id: text('source_id'),
  canonical_key: text('canonical_key'),
  identity_hash: text('identity_hash'),
  status: text('status').notNull().default('PENDING'),
  question_index: integer('question_index'),
  protected_app_id: text('protected_app_id').notNull(),
  batch_id: uuid('batch_id').notNull(),
  question: text('question').notNull(),
  question_origin: text('question_origin').notNull(),
  old_version_id: uuid('old_version_id').notNull(),
  new_version_id: uuid('new_version_id').notNull(),
  old_retrieval_json: jsonb('old_retrieval_json'),
  new_retrieval_json: jsonb('new_retrieval_json'),
  old_answer: text('old_answer'),
  new_answer: text('new_answer'),
  result: text('result'),
  material_change: boolean('material_change'),
  comparison_json: jsonb('comparison_json'),
  model_config_hash: text('model_config_hash'),
  config_json: jsonb('config_json'),
  old_output_json: jsonb('old_output_json'),
  new_output_json: jsonb('new_output_json'),
  old_meta_json: jsonb('old_meta_json'),
  new_meta_json: jsonb('new_meta_json'),
  comparison_meta_json: jsonb('comparison_meta_json'),
  failure_json: jsonb('failure_json'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});

export const incidentAssetImpacts = pgTable('incident_asset_impacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  incident_id: uuid('incident_id').notNull(),
  asset_id: text('asset_id').notNull(),
  impact: text('impact').notNull(),
  dependency_path_json: jsonb('dependency_path_json').notNull(),
  regression_run_ids: jsonb('regression_run_ids').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  priority: integer('priority').notNull(),
  trigger_json: jsonb('trigger_json').notNull(),
  action_json: jsonb('action_json').notNull(),
  enabled: boolean('enabled').notNull().default(true),
});

export const policyEvaluations = pgTable('policy_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  source_version_id: uuid('source_version_id').notNull(),
  incident_id: uuid('incident_id'),
  policy_code: text('policy_code'),
  deterministic_facts_json: jsonb('deterministic_facts_json').notNull(),
  advisory_facts_json: jsonb('advisory_facts_json').notNull(),
  matched: boolean('matched').notNull(),
  action: text('action').notNull(),
  is_effective: boolean('is_effective').notNull().default(true),
  evaluated_at: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviewDecisions = pgTable('review_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  incident_id: uuid('incident_id').notNull(),
  decision: text('decision').notNull(),
  reviewer: text('reviewer').notNull(),
  reason: text('reason'),
  previous_version_id: uuid('previous_version_id'),
  candidate_version_id: uuid('candidate_version_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  event_type: text('event_type').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  actor: text('actor').notNull(),
  metadata_json: jsonb('metadata_json').notNull(),
  idempotency_key: text('idempotency_key'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pipelineRuns = pgTable('pipeline_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source_version_id: uuid('source_version_id').notNull(),
  incident_id: uuid('incident_id'),
  status: text('status').notNull(),
  fast_path: boolean('fast_path').notNull().default(false),
  lease_until: timestamp('lease_until', { withTimezone: true }),
  lease_owner: text('lease_owner'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pipelineSteps = pgTable('pipeline_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  run_id: uuid('run_id').notNull(),
  step: text('step').notNull(),
  item_key: text('item_key').notNull(),
  status: text('status').notNull(),
  attempts: integer('attempts').notNull().default(0),
  error_code: text('error_code'),
  output_ref: text('output_ref'),
  started_at: timestamp('started_at', { withTimezone: true }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});

export const pinnedQuestions = pgTable('pinned_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  source_id: text('source_id').notNull(),
  canonical_key: text('canonical_key').notNull(),
  question: text('question').notNull(),
});

export const sandboxState = pgTable('sandbox_state', {
  source_id: text('source_id').primaryKey(),
  fixture_name: text('fixture_name').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
