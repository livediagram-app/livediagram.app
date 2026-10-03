-- The recorded creation intent, per docs/specs/013-workspace/default-folders.md "Recorded intent".
--
-- Written by the insert that creates a document and never rewritten: `opens_in` is the editor mode
-- its first tab opens in, `tab_kind` that tab's kind at creation (the general `diagram` tab, or a
-- specific kind such as `event-storming`), `template_family` the family of the template it was made
-- from (`retrospective`, `kanban`) when it has one. All nullable with no default and no backfill: a
-- NULL `opens_in` is unknown (a row from before intents were recorded, or a create that carried
-- none), never Diagram, and the other two are then unknown too. `tab_kind` is a column of its own
-- because nothing else records the first tab's kind at creation: tabs are reordered, removed and
-- shared after it. They feed the Explorer's Opens in and Board chips.

ALTER TABLE documents ADD COLUMN opens_in TEXT;
ALTER TABLE documents ADD COLUMN tab_kind TEXT;
ALTER TABLE documents ADD COLUMN template_family TEXT;
