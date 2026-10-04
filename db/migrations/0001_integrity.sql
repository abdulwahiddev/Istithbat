ALTER TABLE source_versions ADD COLUMN previous_version_id uuid REFERENCES source_versions(id);
--> statement-breakpoint
ALTER TABLE source_versions ADD COLUMN change_class text CHECK (change_class IS NULL OR change_class = 'SERIALIZATION_ONLY');
--> statement-breakpoint
CREATE INDEX source_versions_previous_idx ON source_versions(previous_version_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_source_version_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (NEW.source_id, NEW.previous_version_id, NEW.upstream_version_label, NEW.revision_number, NEW.upstream_published_at,
      NEW.raw_sha256, NEW.canonical_sha256, NEW.silent_mutation, NEW.change_class, NEW.raw_snapshot_path,
      NEW.canonical_snapshot_path, NEW.record_count, NEW.provider_checksum, NEW.signature_status, NEW.detected_at)
     IS DISTINCT FROM
     (OLD.source_id, OLD.previous_version_id, OLD.upstream_version_label, OLD.revision_number, OLD.upstream_published_at,
      OLD.raw_sha256, OLD.canonical_sha256, OLD.silent_mutation, OLD.change_class, OLD.raw_snapshot_path,
      OLD.canonical_snapshot_path, OLD.record_count, OLD.provider_checksum, OLD.signature_status, OLD.detected_at) THEN
    RAISE EXCEPTION 'source version snapshot fields are immutable';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION reject_integrity_evidence_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'integrity evidence is immutable';
END $$;
--> statement-breakpoint
CREATE TRIGGER records_immutable BEFORE UPDATE ON records FOR EACH ROW EXECUTE FUNCTION reject_integrity_evidence_update();
--> statement-breakpoint
CREATE TRIGGER changes_immutable BEFORE UPDATE ON changes FOR EACH ROW EXECUTE FUNCTION reject_integrity_evidence_update();
--> statement-breakpoint
ALTER FUNCTION reject_audit_mutation() SET search_path = public, pg_temp;
