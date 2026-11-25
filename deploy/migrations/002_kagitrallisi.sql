-- Preserve old revisions and keep unpublished draft edits out of the new publication.
DO $$
DECLARE
  state catalog_state%ROWTYPE;
  published jsonb;
  entry jsonb := '[{"slug":"kagitrallisi","title":"Kağıt Rallisi","description":"Hızını ayarla, virajı hesapla, bitişe ilk sen var.","visible":true}]'::jsonb;
  next_revision integer;
BEGIN
  SELECT * INTO state FROM catalog_state WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF; -- Fresh installs seed the full registry.
  SELECT items INTO STRICT published FROM catalog_revisions WHERE id=state.published_revision;
  IF state.draft @> '[{"slug":"kagitrallisi"}]' AND published @> '[{"slug":"kagitrallisi"}]' THEN RETURN; END IF;
  IF NOT state.draft @> '[{"slug":"kagitrallisi"}]' THEN state.draft := state.draft || entry; END IF;
  IF NOT published @> '[{"slug":"kagitrallisi"}]' THEN published := published || entry; END IF;
  SELECT GREATEST(state.version, COALESCE(MAX(id),0))+1 INTO next_revision FROM catalog_revisions;
  INSERT INTO catalog_revisions(id,items,actor) VALUES (next_revision,published,'migration:002_kagitrallisi');
  UPDATE catalog_state SET draft=state.draft, version=next_revision, published_revision=next_revision WHERE id=1;
  INSERT INTO admin_audit(action,actor,revision) VALUES ('register_game','migration:002_kagitrallisi',next_revision);
END $$;
