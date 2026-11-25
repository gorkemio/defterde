-- Append Tangram without publishing draft edits or changing past revisions.
DO $$
DECLARE
  state catalog_state%ROWTYPE;
  published jsonb;
  entry jsonb;
  additions jsonb := '[{"slug":"tangram","title":"Tangram","description":"Yedi parçayla 120 şekli tamamla veya kendi şeklini tasarla.","visible":true}]'::jsonb;
  changed boolean := false;
  next_revision integer;
BEGIN
  SELECT * INTO state FROM catalog_state WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT items INTO STRICT published FROM catalog_revisions WHERE id=state.published_revision;
  FOR entry IN SELECT value FROM jsonb_array_elements(additions) LOOP
    IF NOT state.draft @> jsonb_build_array(jsonb_build_object('slug',entry->>'slug')) THEN
      state.draft := state.draft || jsonb_build_array(entry); changed := true;
    END IF;
    IF NOT published @> jsonb_build_array(jsonb_build_object('slug',entry->>'slug')) THEN
      published := published || jsonb_build_array(entry); changed := true;
    END IF;
  END LOOP;
  IF NOT changed THEN RETURN; END IF;
  SELECT GREATEST(state.version,COALESCE(MAX(id),0))+1 INTO next_revision FROM catalog_revisions;
  INSERT INTO catalog_revisions(id,items,actor) VALUES (next_revision,published,'migration:009_tangram');
  UPDATE catalog_state SET draft=state.draft, version=next_revision, published_revision=next_revision WHERE id=1;
  INSERT INTO admin_audit(action,actor,revision) VALUES ('register_games','migration:009_tangram',next_revision);
END $$;
