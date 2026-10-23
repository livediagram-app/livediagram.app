-- A deleted form link is kept, marked, rather than removed (Plan, now in liveplanner "Publishing and the form
-- link"): its response number carries on to the tab's next link, so numbers never repeat on one form, and its code
-- never answers again. Only a live link (not suspended, not deleted) is unique per Form tab.
ALTER TABLE form_links ADD COLUMN deleted_at INTEGER;
DROP INDEX form_links_live_tab;
CREATE UNIQUE INDEX form_links_live_tab ON form_links (document_id, tab_id)
  WHERE suspended_at IS NULL AND deleted_at IS NULL;
