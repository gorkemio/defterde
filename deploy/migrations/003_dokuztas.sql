-- Preserve old revisions and keep unpublished draft edits out of the new publication.
DO $$
DECLARE
  state catalog_state%ROWTYPE;
  published jsonb;
  entry jsonb := '[{"slug":"dokuztas","title":"Dokuz Taş","description":"Üç taşını hizala, değirmeni kur, rakibinin taşını al.","visible":true}]'::jsonb;
  next_revision integer;
BEGIN
  SELECT * INTO state FROM catalog_state WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF; -- Fresh installs seed the full registry.
  SELECT items INTO STRICT published FROM catalog_revisions WHERE id=state.published_revision;
  IF state.draft @> '[{"slug":"dokuztas"}]' AND published @> '[{"slug":"dokuztas"}]' THEN RETURN; END IF;
  IF NOT state.draft @> '[{"slug":"dokuztas"}]' THEN state.draft := state.draft || entry; END IF;
  IF NOT published @> '[{"slug":"dokuztas"}]' THEN published := published || entry; END IF;
  SELECT GREATEST(state.version, COALESCE(MAX(id),0))+1 INTO next_revision FROM catalog_revisions;
  INSERT INTO catalog_revisions(id,items,actor) VALUES (next_revision,published,'migration:003_dokuztas');
  UPDATE catalog_state SET draft=state.draft, version=next_revision, published_revision=next_revision WHERE id=1;
  INSERT INTO admin_audit(action,actor,revision) VALUES ('register_game','migration:003_dokuztas',next_revision);
END $$;
