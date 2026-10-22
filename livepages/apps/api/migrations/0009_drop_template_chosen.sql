-- Drop `templateChosen` from every stored tab's JSON blob.
--
-- The field was added when the per-tab template picker first
-- landed: it told the editor "the user has dismissed the picker
-- for this tab, don't re-show it". It belongs in UI state, not in
-- persistent diagram state — clearing all elements on a tab still
-- shouldn't re-show the picker WITHIN a session, but a refresh
-- showing the picker again on an empty tab is the right behaviour.
--
-- Client writes already strip the field; this catches every row
-- written before that change.

UPDATE tabs
   SET data = json_remove(data, '$.templateChosen'),
       updated_at = strftime('%s', 'now') * 1000
 WHERE json_extract(data, '$.templateChosen') IS NOT NULL;
