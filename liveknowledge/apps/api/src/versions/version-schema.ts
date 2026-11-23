// Version history's table and triggers (docs/specs/006-document/version-history.md; blueprint "Data and persistence",
// VH1 to VH3), schema step 8 of the document's SQLite (document-schema.ts). Every statement is IF NOT EXISTS, so a
// room that already ran it runs it harmlessly.
//
// Two triggers keep versions on the save path: the idle one, a BEFORE UPDATE on the tab's body whose WHEN compares two
// integers first, and the save one (step 34, VERSION_SAVE_STEP), an AFTER UPDATE whose WHEN stops a draft's autosave at
// a byte scan. The copies are SQLite copying the stored row, never parsed in JavaScript. A statement the revision trigger aborts takes the copy with it. No UNIQUE index guards
// "one per revision": inside a trigger the conflict policy of the statement that fired it wins (an upsert's is ABORT),
// so a duplicate would abort the person's save. Every insert asks NOT EXISTS instead.

import {
  VERSION_AUTO_MAX,
  VERSION_AUTO_MAX_AGE_MS,
  VERSION_AUTO_MAX_BYTES,
  VERSION_IDLE_MS,
} from '@liveknowledge/api-schema';

// A version id: `v_` and 16 lower-case hex characters, minted the same way in SQL and in the api (versionId).
export const SQL_VERSION_ID = "'v_' || lower(hex(randomblob(8)))";

// Schema step 8 as it was written: a migration is history, so the step after it (VERSION_SAVE_STEP) changes it.
export const VERSION_SCHEMA = `
CREATE TABLE IF NOT EXISTS tab_versions (
  id            TEXT    PRIMARY KEY,
  tab_id        TEXT    NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  rev           INTEGER NOT NULL,
  kind          TEXT    NOT NULL CHECK (kind IN ('idle', 'agent', 'restore', 'manual')),
  name          TEXT    NULL,
  author_id     TEXT    NULL,
  author_name   TEXT    NULL,
  author_color  TEXT    NULL,
  tab_name      TEXT    NOT NULL,
  data          TEXT    NOT NULL,
  bytes         INTEGER NOT NULL,
  element_count INTEGER NOT NULL,
  saved_at      INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tab_versions_by_tab ON tab_versions (tab_id, saved_at);
CREATE INDEX IF NOT EXISTS tab_versions_by_rev ON tab_versions (tab_id, rev);

CREATE TRIGGER IF NOT EXISTS tab_versions_idle BEFORE UPDATE OF data ON tabs
  WHEN NEW.data IS NOT OLD.data AND OLD.updated_at <= NEW.updated_at - ${VERSION_IDLE_MS}
BEGIN
  INSERT INTO tab_versions (id, tab_id, rev, kind, tab_name, data, bytes, element_count, saved_at, created_at)
    SELECT ${SQL_VERSION_ID}, OLD.id, OLD.rev, 'idle', OLD.name, OLD.data, length(CAST(OLD.data AS BLOB)),
           OLD.element_count, OLD.updated_at, NEW.updated_at
     WHERE NOT EXISTS (SELECT 1 FROM tab_versions WHERE tab_id = OLD.id AND rev = OLD.rev);
END;

CREATE TRIGGER IF NOT EXISTS tab_versions_prune AFTER INSERT ON tab_versions
BEGIN
  DELETE FROM tab_versions
   WHERE tab_id = NEW.tab_id AND name IS NULL AND id IS NOT NEW.id
     AND (created_at < NEW.created_at - ${VERSION_AUTO_MAX_AGE_MS}
          OR id IN (SELECT id FROM tab_versions WHERE tab_id = NEW.tab_id AND name IS NULL
                     ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ${VERSION_AUTO_MAX})
          OR id IN (SELECT id FROM (SELECT id, SUM(bytes) OVER (ORDER BY created_at DESC, rowid DESC) AS running
                                      FROM tab_versions WHERE tab_id = NEW.tab_id AND name IS NULL)
                     WHERE running > ${VERSION_AUTO_MAX_BYTES}));
END;
`;

// The draft's key as JSON.stringify writes it (packages/document page-draft.ts: `articles.draft` and `Tab.draft`). A
// string value can never hold it unescaped, so a body without it holds no draft, and finding it costs a byte scan,
// never a parse: the hot path of a draft's autosave (spec "The save check is cheap on a draft's autosave").
const NO_DRAFT_IN = (row: 'OLD' | 'NEW') => `instr(${row}.data, '"draft":') = 0`;

// Whether a write changed the page's saved writing: every article flow but the draft's. Only asked of bodies that
// parse, so a body that is not JSON never aborts the write (it keeps nothing).
const SAVED_WRITING_CHANGED = `json_valid(OLD.data) AND json_valid(NEW.data)
    AND json_remove(json_extract(OLD.data, '$.articles'), '$.draft') IS NOT json_extract(NEW.data, '$.articles')`;

const SAVE_TABLE = (name: string) => `CREATE TABLE ${name} (
  id            TEXT    PRIMARY KEY,
  tab_id        TEXT    NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  rev           INTEGER NOT NULL,
  kind          TEXT    NOT NULL CHECK (kind IN ('idle', 'agent', 'restore', 'manual', 'save')),
  name          TEXT    NULL,
  author_id     TEXT    NULL,
  author_name   TEXT    NULL,
  author_color  TEXT    NULL,
  tab_name      TEXT    NOT NULL,
  data          TEXT    NOT NULL,
  bytes         INTEGER NOT NULL,
  element_count INTEGER NOT NULL,
  saved_at      INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
)`;

const VERSION_COLUMNS =
  'id, tab_id, rev, kind, name, author_id, author_name, author_color, tab_name, data, bytes, element_count, saved_at, created_at';

// Schema step 34 (docs/specs/006-document/version-history.md "When a version is kept"; blueprint VH1a, VH1b): each
// Save keeps a version, and no version keeps a draft. `tab_versions` is rebuilt once so its CHECK takes `save` (SQLite
// cannot alter a CHECK): the triggers that name it go first, the rows are copied as they are, and the indexes and
// triggers are made again, the idle one now passing over a body that holds a draft. A room makes the table empty at
// step 8, so the copy is nothing there; a room with versions copies at most the bounds' rows per tab, once.
//
// The save trigger runs AFTER the write, so the version is the page as saved (NEW), at the revision the write made;
// one per revision as every insert is. It names whoever last wrote the draft, which the tab PUT replaces with the
// person who pressed Save (db/versions.ts saveVersionStampStatement).
export const VERSION_SAVE_STEP = `
DROP TRIGGER IF EXISTS tab_versions_idle;
DROP TRIGGER IF EXISTS tab_versions_prune;
DROP TRIGGER IF EXISTS tab_versions_saved;
DROP TABLE IF EXISTS tab_versions_next;
${SAVE_TABLE('tab_versions_next')};
INSERT INTO tab_versions_next (${VERSION_COLUMNS}) SELECT ${VERSION_COLUMNS} FROM tab_versions;
DROP TABLE tab_versions;
ALTER TABLE tab_versions_next RENAME TO tab_versions;
CREATE INDEX IF NOT EXISTS tab_versions_by_tab ON tab_versions (tab_id, saved_at);
CREATE INDEX IF NOT EXISTS tab_versions_by_rev ON tab_versions (tab_id, rev);

CREATE TRIGGER tab_versions_idle BEFORE UPDATE OF data ON tabs
  WHEN NEW.data IS NOT OLD.data AND OLD.updated_at <= NEW.updated_at - ${VERSION_IDLE_MS} AND ${NO_DRAFT_IN('OLD')}
BEGIN
  INSERT INTO tab_versions (id, tab_id, rev, kind, tab_name, data, bytes, element_count, saved_at, created_at)
    SELECT ${SQL_VERSION_ID}, OLD.id, OLD.rev, 'idle', OLD.name, OLD.data, length(CAST(OLD.data AS BLOB)),
           OLD.element_count, OLD.updated_at, NEW.updated_at
     WHERE NOT EXISTS (SELECT 1 FROM tab_versions WHERE tab_id = OLD.id AND rev = OLD.rev);
END;

CREATE TRIGGER tab_versions_saved AFTER UPDATE OF data ON tabs
  WHEN NEW.data IS NOT OLD.data AND ${NO_DRAFT_IN('NEW')} AND ${SAVED_WRITING_CHANGED}
BEGIN
  INSERT INTO tab_versions (id, tab_id, rev, kind, author_name, tab_name, data, bytes, element_count, saved_at,
                            created_at)
    SELECT ${SQL_VERSION_ID}, NEW.id, NEW.rev, 'save',
           CASE WHEN json_type(OLD.data, '$.draft.by') = 'text' THEN json_extract(OLD.data, '$.draft.by') END,
           NEW.name, NEW.data, length(CAST(NEW.data AS BLOB)), NEW.element_count, NEW.updated_at, NEW.updated_at
     WHERE NOT EXISTS (SELECT 1 FROM tab_versions WHERE tab_id = NEW.id AND rev = NEW.rev);
END;

CREATE TRIGGER tab_versions_prune AFTER INSERT ON tab_versions
BEGIN
  DELETE FROM tab_versions
   WHERE tab_id = NEW.tab_id AND name IS NULL AND id IS NOT NEW.id
     AND (created_at < NEW.created_at - ${VERSION_AUTO_MAX_AGE_MS}
          OR id IN (SELECT id FROM tab_versions WHERE tab_id = NEW.tab_id AND name IS NULL
                     ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ${VERSION_AUTO_MAX})
          OR id IN (SELECT id FROM (SELECT id, SUM(bytes) OVER (ORDER BY created_at DESC, rowid DESC) AS running
                                      FROM tab_versions WHERE tab_id = NEW.tab_id AND name IS NULL)
                     WHERE running > ${VERSION_AUTO_MAX_BYTES}));
END;
`;

type Exec = (query: string) => unknown;

/** Schema step 43 (docs/specs/006-document/version-history.md "An agent's mark"; blueprint VH25): the agent an agent's
 *  version was kept for, beside its person. Added only when the table lacks it (as V18 asks before its ALTER), so it is
 *  safe however far a room got and runs again harmlessly. Older rows read NULL: a person's. */
export function versionAgentSchemaStep(exec: Exec): void {
  const columns = (exec('PRAGMA table_info(tab_versions)') as { toArray(): { name: unknown }[] })
    .toArray()
    .map((c) => String(c.name));
  if (!columns.includes('author_agent'))
    exec('ALTER TABLE tab_versions ADD COLUMN author_agent TEXT NULL');
}
