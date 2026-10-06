-- Permit the two explicitly controlled 10618 fixtures without activating either.
-- Existing sandbox state, snapshots, trust, serving pointers and audit remain unchanged.
ALTER TABLE sandbox_state DROP CONSTRAINT sandbox_state_fixture_name_check;
--> statement-breakpoint
ALTER TABLE sandbox_state ADD CONSTRAINT sandbox_state_fixture_name_check
  CHECK (fixture_name IN ('had-4821.v13.json','had-4821.v14.json','had-4821.v14-r2.json',
    'hadeethenc-10618.v13.json','hadeethenc-10618.v14.json'));
