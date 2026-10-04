CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TABLE sources (id text PRIMARY KEY, name text NOT NULL, provider text NOT NULL, source_type text NOT NULL, connector_type text NOT NULL, endpoint text NOT NULL, connector_health text NOT NULL DEFAULT 'HEALTHY', is_demo_fixture boolean NOT NULL DEFAULT false, rights_note text, field_roles_json jsonb NOT NULL DEFAULT '{}'::jsonb, content_level text NOT NULL CHECK (content_level IN ('A','B','C')), last_checked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE source_checks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id text NOT NULL REFERENCES sources(id), trigger_type text NOT NULL, status text NOT NULL, error_code text, raw_sha256 text, source_version_id uuid, checked_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE source_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id text NOT NULL REFERENCES sources(id), upstream_version_label text NOT NULL, revision_number integer NOT NULL CHECK (revision_number > 0), upstream_published_at timestamptz, raw_sha256 text NOT NULL CHECK (length(raw_sha256)=64), canonical_sha256 text NOT NULL CHECK (length(canonical_sha256)=64), status text NOT NULL CHECK (status IN ('PENDING','ANALYZING','QUARANTINED','TRUSTED','REJECTED','SUPERSEDED')), silent_mutation boolean NOT NULL DEFAULT false, raw_snapshot_path text NOT NULL, canonical_snapshot_path text NOT NULL, record_count integer NOT NULL CHECK (record_count >= 0), provider_checksum text, signature_status text, detected_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,upstream_version_label,revision_number));
--> statement-breakpoint
ALTER TABLE source_checks ADD CONSTRAINT source_checks_version_fk FOREIGN KEY (source_version_id) REFERENCES source_versions(id);
--> statement-breakpoint
CREATE FUNCTION reject_source_version_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (NEW.source_id,NEW.upstream_version_label,NEW.revision_number,NEW.raw_sha256,NEW.canonical_sha256,NEW.raw_snapshot_path,NEW.canonical_snapshot_path,NEW.record_count) IS DISTINCT FROM (OLD.source_id,OLD.upstream_version_label,OLD.revision_number,OLD.raw_sha256,OLD.canonical_sha256,OLD.raw_snapshot_path,OLD.canonical_snapshot_path,OLD.record_count) THEN RAISE EXCEPTION 'source version snapshot fields are immutable'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER source_version_snapshot_immutable BEFORE UPDATE ON source_versions FOR EACH ROW EXECUTE FUNCTION reject_source_version_snapshot_mutation();
--> statement-breakpoint
CREATE UNIQUE INDEX one_trusted_version_per_source ON source_versions(source_id) WHERE status='TRUSTED';
--> statement-breakpoint
CREATE INDEX source_versions_recent_idx ON source_versions(source_id,detected_at DESC);
--> statement-breakpoint
CREATE TABLE records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_version_id uuid NOT NULL REFERENCES source_versions(id), canonical_key text NOT NULL, upstream_record_id text, content_json jsonb NOT NULL, metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb, record_hash text NOT NULL CHECK (length(record_hash)=64), field_hashes jsonb NOT NULL DEFAULT '{}'::jsonb, content_level_override text CHECK (content_level_override IN ('A','B','C')), UNIQUE(source_version_id,canonical_key));
--> statement-breakpoint
CREATE INDEX records_lookup_idx ON records(source_version_id,canonical_key);
--> statement-breakpoint
CREATE TABLE changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), from_version_id uuid REFERENCES source_versions(id), to_version_id uuid NOT NULL REFERENCES source_versions(id), canonical_key text NOT NULL, old_record_id uuid REFERENCES records(id), new_record_id uuid REFERENCES records(id), change_type text NOT NULL, field_path text, field_role text CHECK (field_role IN ('AUTHORITATIVE_TEXT','SCHOLAR_JUDGMENT','PROVENANCE','TRANSLATION','COMMENTARY','OPERATIONAL_METADATA','UNCLASSIFIED')), old_value jsonb, new_value jsonb, old_field_hash text, new_field_hash text, diff_flags jsonb NOT NULL DEFAULT '[]'::jsonb, diff_json jsonb NOT NULL DEFAULT '{}'::jsonb);
--> statement-breakpoint
CREATE TABLE incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id text NOT NULL REFERENCES sources(id), previous_version_id uuid REFERENCES source_versions(id), candidate_version_id uuid NOT NULL REFERENCES source_versions(id), primary_change_id uuid REFERENCES changes(id), status text NOT NULL CHECK (status IN ('ANALYZING','NEEDS_REVIEW','QUARANTINED','RESOLVED')), risk_level text CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')), effective_policy_action text CHECK (effective_policy_action IN ('ALLOW','REVIEW','QUARANTINE','ESCALATE')), title text NOT NULL, summary text, escalated boolean NOT NULL DEFAULT false, opened_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz);
--> statement-breakpoint
CREATE INDEX incidents_queue_idx ON incidents(status,risk_level,opened_at);
--> statement-breakpoint
CREATE TABLE analyses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES incidents(id), change_id uuid REFERENCES changes(id), analysis_type text NOT NULL, risk_level text NOT NULL, output_json jsonb NOT NULL, context_packet_hash text NOT NULL, provider text, model text, prompt_version text, meta_json jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE assets (id text PRIMARY KEY, name text NOT NULL, asset_type text NOT NULL, status text NOT NULL DEFAULT 'ACTIVE', metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb);
--> statement-breakpoint
CREATE TABLE asset_source_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id text NOT NULL REFERENCES assets(id), source_id text NOT NULL REFERENCES sources(id), canonical_key text NOT NULL, derived_from_version_id uuid NOT NULL REFERENCES source_versions(id), derivation_mode text NOT NULL DEFAULT 'GATEWAY_RESOLVED' CHECK (derivation_mode IN ('GATEWAY_RESOLVED','MATERIALIZED')), UNIQUE(asset_id,source_id,canonical_key));
--> statement-breakpoint
CREATE INDEX asset_source_lookup_idx ON asset_source_records(source_id,canonical_key);
--> statement-breakpoint
CREATE TABLE dependencies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), from_asset_id text NOT NULL REFERENCES assets(id), to_asset_id text NOT NULL REFERENCES assets(id), dependency_type text NOT NULL DEFAULT 'DATA_FLOW', UNIQUE(from_asset_id,to_asset_id));
--> statement-breakpoint
CREATE INDEX dependency_from_idx ON dependencies(from_asset_id);
--> statement-breakpoint
CREATE INDEX dependency_to_idx ON dependencies(to_asset_id);
--> statement-breakpoint
CREATE TABLE protected_apps (id text PRIMARY KEY, asset_id text NOT NULL UNIQUE REFERENCES assets(id), name text NOT NULL, endpoint text, description text);
--> statement-breakpoint
CREATE TABLE gateway_bindings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), protected_app_id text NOT NULL REFERENCES protected_apps(id), source_id text NOT NULL REFERENCES sources(id), served_version_id uuid NOT NULL REFERENCES source_versions(id), latest_seen_version_id uuid NOT NULL REFERENCES source_versions(id), gateway_status text NOT NULL DEFAULT 'SERVING_TRUSTED', updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(protected_app_id,source_id));
--> statement-breakpoint
CREATE TABLE regression_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid REFERENCES incidents(id), protected_app_id text NOT NULL REFERENCES protected_apps(id), batch_id uuid NOT NULL, question text NOT NULL, question_origin text NOT NULL CHECK (question_origin IN ('pinned','generated')), old_version_id uuid NOT NULL REFERENCES source_versions(id), new_version_id uuid NOT NULL REFERENCES source_versions(id), old_retrieval_json jsonb, new_retrieval_json jsonb, old_answer text, new_answer text, result text CHECK (result IN ('NO_CHANGE','NON_MATERIAL_CHANGE','MATERIAL_CHANGE','INCONCLUSIVE','FAILED')), material_change boolean, comparison_json jsonb, model_config_hash text, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE incident_asset_impacts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES incidents(id), asset_id text NOT NULL REFERENCES assets(id), impact text NOT NULL CHECK (impact IN ('HEALTHY','EXPOSED','STALE','IMPACTED')), dependency_path_json jsonb NOT NULL DEFAULT '[]'::jsonb, regression_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(incident_id,asset_id));
--> statement-breakpoint
CREATE TABLE policies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, priority integer NOT NULL, trigger_json jsonb NOT NULL, action_json jsonb NOT NULL, enabled boolean NOT NULL DEFAULT true);
--> statement-breakpoint
CREATE TABLE policy_evaluations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_version_id uuid NOT NULL REFERENCES source_versions(id), incident_id uuid REFERENCES incidents(id), policy_code text REFERENCES policies(code), deterministic_facts_json jsonb NOT NULL DEFAULT '{}'::jsonb, advisory_facts_json jsonb NOT NULL DEFAULT '{}'::jsonb, matched boolean NOT NULL, action text NOT NULL CHECK (action IN ('ALLOW','REVIEW','QUARANTINE','ESCALATE')), is_effective boolean NOT NULL DEFAULT true, evaluated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE UNIQUE INDEX one_effective_evaluation_per_version ON policy_evaluations(source_version_id) WHERE is_effective;
--> statement-breakpoint
CREATE TABLE review_decisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES incidents(id), decision text NOT NULL CHECK (decision IN ('APPROVE','REJECT','KEEP_QUARANTINED','ESCALATE')), reviewer text NOT NULL, reason text, previous_version_id uuid REFERENCES source_versions(id), candidate_version_id uuid NOT NULL REFERENCES source_versions(id), created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, actor text NOT NULL, metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE INDEX audit_entity_idx ON audit_events(entity_type,entity_id,created_at);
--> statement-breakpoint
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_events is append-only'; END $$;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
--> statement-breakpoint
CREATE TABLE pipeline_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_version_id uuid NOT NULL REFERENCES source_versions(id), incident_id uuid REFERENCES incidents(id), status text NOT NULL CHECK (status IN ('RUNNING','COMPLETE','FAILED_CLOSED')), lease_until timestamptz, lease_owner text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE pipeline_steps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES pipeline_runs(id), step text NOT NULL CHECK (step IN ('INCIDENT','ANALYSIS','REGRESSION_QUESTIONS','REGRESSION_PAIR','BLAST_RADIUS','POLICY')), item_key text NOT NULL DEFAULT '', status text NOT NULL CHECK (status IN ('PENDING','RUNNING','DONE','FAILED')), attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), error_code text, output_ref text, UNIQUE(run_id,step,item_key));
--> statement-breakpoint
CREATE TABLE pinned_questions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id text NOT NULL REFERENCES sources(id), canonical_key text NOT NULL, question text NOT NULL, UNIQUE(source_id,canonical_key,question));
--> statement-breakpoint
CREATE TABLE sandbox_state (source_id text PRIMARY KEY REFERENCES sources(id), fixture_name text NOT NULL CHECK (fixture_name IN ('had-4821.v13.json','had-4821.v14.json','had-4821.v14-r2.json')), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['sources','source_checks','source_versions','records','changes','incidents','analyses','assets','asset_source_records','dependencies','protected_apps','gateway_bindings','regression_runs','incident_asset_impacts','policies','policy_evaluations','review_decisions','audit_events','pipeline_runs','pipeline_steps','pinned_questions','sandbox_state'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
--> statement-breakpoint
ALTER TABLE drizzle.__drizzle_migrations ENABLE ROW LEVEL SECURITY;
