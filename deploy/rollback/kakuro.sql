-- Execute only during an explicit rollback to the fourteen-game application, with web stopped.
-- Keep history and all fourteen other games' current edits. Reapplying 008 is supported.
BEGIN;
SELECT pg_advisory_xact_lock(7524041);
DO $$
DECLARE
  state catalog_state%ROWTYPE;
  published jsonb;
  next_revision integer;
BEGIN
  SELECT * INTO state FROM catalog_state WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT items INTO STRICT published FROM catalog_revisions WHERE id=state.published_revision;
  SELECT jsonb_agg(item ORDER BY ord) INTO published FROM jsonb_array_elements(published) WITH ORDINALITY AS e(item,ord) WHERE item->>'slug' <> 'kakuro';
  SELECT jsonb_agg(item ORDER BY ord) INTO state.draft FROM jsonb_array_elements(state.draft) WITH ORDINALITY AS e(item,ord) WHERE item->>'slug' <> 'kakuro';
  SELECT GREATEST(state.version,COALESCE(MAX(id),0))+1 INTO next_revision FROM catalog_revisions;
  INSERT INTO catalog_revisions(id,items,actor) VALUES (next_revision,published,'rollback:kakuro');
  UPDATE catalog_state SET draft=state.draft, version=next_revision, published_revision=next_revision WHERE id=1;
  INSERT INTO admin_audit(action,actor,revision) VALUES ('rollback_game','rollback:kakuro',next_revision);
END $$;
DELETE FROM schema_migrations WHERE name='008_kakuro.sql';
COMMIT;
