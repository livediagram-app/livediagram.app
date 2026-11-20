// Version history's table and triggers (docs/specs/006-document/version-history.md; blueprint "Data and persistence",
// VH1 to VH3), schema step 8 of the document's SQLite (document-schema.ts). Every statement is IF NOT EXISTS, so a
// room that already ran it runs it harmlessly.
//
// The idle trigger is the one place a version is kept on the save path: a BEFORE UPDATE on the tab's body whose WHEN
// compares two integers, so an autosave every 600 ms pays a comparison, and the copy itself is SQLite copying the
// stored row, never parsed. A statement the revision trigger aborts takes the copy with it. No UNIQUE index guards
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
