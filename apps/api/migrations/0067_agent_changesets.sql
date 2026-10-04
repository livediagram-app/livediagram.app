-- Agent changesets (docs/specs/024-agents/agent-changesets.md; blueprint
-- docs/specs/024-agents/blueprints/agent-changesets.md "Data and persistence").
--
-- 1. Every tab carries a revision that every write of it advances. 0 for every
--    tab that existed before revisions (CS2).
-- 2. The trigger is the compare-and-swap: a statement that changes a tab's data
--    without advancing its revision by exactly one aborts, and with it the whole
--    batch, so a changeset record never lands without its tab write (CS3).
-- 3. One row per changeset, its large bodies beside it, one row per part (CS43).
-- 4. A ticket carries the person tag of the account that minted it, so the room
--    can tell an agent's owner's own sessions from everyone else's
--    (docs/specs/024-agents/agent-presence.md, CS39). Tickets live 60 seconds; no
--    backfill.

ALTER TABLE tabs ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER tabs_rev_advances BEFORE UPDATE OF data ON tabs
  WHEN NEW.rev IS NOT OLD.rev + 1
  BEGIN SELECT RAISE(ABORT, 'tab_rev_stale'); END;

CREATE TABLE agent_changesets (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  rev INTEGER NOT NULL,
  base_rev INTEGER,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_color TEXT NOT NULL,
  token_id TEXT,
  summary TEXT,
  fingerprints TEXT NOT NULL,
  added INTEGER NOT NULL,
  changed INTEGER NOT NULL,
  removed INTEGER NOT NULL,
  created_tab INTEGER NOT NULL DEFAULT 0,
  revert_of TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX agent_changesets_tab_rev ON agent_changesets(tab_id, rev);
CREATE INDEX agent_changesets_document_created ON agent_changesets(document_id, created_at);
CREATE INDEX agent_changesets_created ON agent_changesets(created_at);

CREATE TABLE agent_changeset_parts (
  changeset_id TEXT NOT NULL REFERENCES agent_changesets(id) ON DELETE CASCADE,
  part TEXT NOT NULL CHECK (part IN ('ops', 'inverse', 'results')),
  data TEXT NOT NULL,
  PRIMARY KEY (changeset_id, part)
);

ALTER TABLE ws_tickets ADD COLUMN person_tag TEXT;
