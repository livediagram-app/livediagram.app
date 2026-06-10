-- Team shared diagrams (spec/35): both folders and diagrams gain a
-- nullable team scope. NULL = personal (every pre-existing row);
-- non-null = part of that team's shared library, authorised by
-- joined membership (spec/32) rather than ownership. A team diagram
-- with folder_id NULL sits in the team's synthetic Unsorted, exactly
-- mirroring the personal tree's NULL-folder semantics (spec/15).

ALTER TABLE folders ADD COLUMN team_id TEXT NULL;
CREATE INDEX folders_team_idx ON folders(team_id);

ALTER TABLE diagrams ADD COLUMN team_id TEXT NULL;
CREATE INDEX diagrams_team_idx ON diagrams(team_id);
