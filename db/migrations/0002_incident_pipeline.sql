ALTER TABLE incidents ADD COLUMN context_packet_json jsonb;
--> statement-breakpoint
ALTER TABLE incidents ADD COLUMN context_packet_hash text CHECK (context_packet_hash IS NULL OR length(context_packet_hash)=64);
--> statement-breakpoint
CREATE UNIQUE INDEX incidents_candidate_version_unique ON incidents(candidate_version_id);
--> statement-breakpoint
ALTER TABLE analyses ADD COLUMN identity_hash text CHECK (identity_hash IS NULL OR length(identity_hash)=64);
--> statement-breakpoint
CREATE UNIQUE INDEX analyses_identity_unique ON analyses(identity_hash) WHERE identity_hash IS NOT NULL;
--> statement-breakpoint
ALTER TABLE pipeline_runs ADD COLUMN fast_path boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE UNIQUE INDEX pipeline_runs_version_unique ON pipeline_runs(source_version_id);
--> statement-breakpoint
ALTER TABLE pipeline_steps ADD COLUMN started_at timestamptz;
--> statement-breakpoint
ALTER TABLE pipeline_steps ADD COLUMN completed_at timestamptz;
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN idempotency_key text;
--> statement-breakpoint
CREATE UNIQUE INDEX audit_idempotency_unique ON audit_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION reject_incident_context_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.context_packet_hash IS NOT NULL AND
     (NEW.context_packet_hash, NEW.context_packet_json) IS DISTINCT FROM
     (OLD.context_packet_hash, OLD.context_packet_json) THEN
    RAISE EXCEPTION 'incident context is immutable';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER incident_context_immutable BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION reject_incident_context_mutation();
--> statement-breakpoint
CREATE TRIGGER analyses_immutable BEFORE UPDATE ON analyses FOR EACH ROW EXECUTE FUNCTION reject_integrity_evidence_update();
