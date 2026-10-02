-- The recorded creation intent, per docs/specs/013-workspace/default-folders.md "Recorded intent".
--
-- Written by the insert that creates a document and never rewritten: `opens_in` is the editor mode
-- its first tab opens in, `board_type` its board type when it is a board. Both nullable with no
-- default and no backfill: a NULL `opens_in` is unknown (a row from before intents were recorded,
-- or a create that carried none), never Diagram. They feed the Explorer's Opens in and Board chips.

ALTER TABLE documents ADD COLUMN opens_in TEXT;
ALTER TABLE documents ADD COLUMN board_type TEXT;
