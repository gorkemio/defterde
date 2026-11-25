-- Execute only during an explicit rollback to the thirteen-game application, with web stopped.
-- Keep history and all thirteen other games' current edits. Reapplying 007 is supported.
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
  SELECT jsonb_agg(item ORDER BY ord) INTO published FROM jsonb_array_elements(published) WITH ORDINALITY AS e(item,ord) WHERE item->>'slug' <> 'labirent';
  SELECT jsonb_agg(item ORDER BY ord) INTO state.draft FROM jsonb_array_elements(state.draft) WITH ORDINALITY AS e(item,ord) WHERE item->>'slug' <> 'labirent';
  SELECT GREATEST(state.version,COALESCE(MAX(id),0))+1 INTO next_revision FROM catalog_revisions;
  INSERT INTO catalog_revisions(id,items,actor) VALUES (next_revision,published,'rollback:labirent');
  UPDATE catalog_state SET draft=state.draft, version=next_revision, published_revision=next_revision WHERE id=1;
  INSERT INTO admin_audit(action,actor,revision) VALUES ('rollback_game','rollback:labirent',next_revision);
END $$;
DELETE FROM schema_migrations WHERE name='007_labirent.sql';
COMMIT;
