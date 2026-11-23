// What a tab's automatic versions are held to, as a row the prune reads (docs/specs/006-document/version-history.md
// "With Pro on"; blueprint VH25), schema step 24 of the document's SQLite (document-schema.ts). The prune is a
// trigger, so it cannot ask what tier the document's owner is on: the room writes the tier's numbers here when it
// learns them (version-retention.ts), and the trigger and the daily upkeep read them. The row starts at the bounds
// every document had before Pro, so a room that runs this step prunes exactly as it did.

import {
  VERSION_AUTO_MAX,
  VERSION_AUTO_MAX_AGE_MS,
  VERSION_AUTO_MAX_BYTES,
} from '@livedocuments/api-schema';

/** One row's worth: how old an automatic version may be (null is no age limit), how many a tab keeps, and their bytes. */
export type VersionRetention = { maxAgeMs: number | null; maxCount: number; maxBytes: number };

/** The bounds before Pro, and with Pro off. */
export const VERSION_RETENTION_LEGACY: VersionRetention = {
  maxAgeMs: VERSION_AUTO_MAX_AGE_MS,
  maxCount: VERSION_AUTO_MAX,
  maxBytes: VERSION_AUTO_MAX_BYTES,
};

const ROW = '(SELECT {column} FROM version_retention WHERE id = 1)';
const row = (column: string) => ROW.replace('{column}', column);

export const VERSION_RETENTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS version_retention (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  max_age_ms INTEGER NULL,
  max_count  INTEGER NOT NULL,
  max_bytes  INTEGER NOT NULL
);
INSERT OR IGNORE INTO version_retention (id, max_age_ms, max_count, max_bytes)
  VALUES (1, ${VERSION_AUTO_MAX_AGE_MS}, ${VERSION_AUTO_MAX}, ${VERSION_AUTO_MAX_BYTES});

DROP TRIGGER IF EXISTS tab_versions_prune;
CREATE TRIGGER tab_versions_prune AFTER INSERT ON tab_versions
BEGIN
  DELETE FROM tab_versions
   WHERE tab_id = NEW.tab_id AND name IS NULL AND id IS NOT NEW.id
     AND ((${row('max_age_ms')} IS NOT NULL AND created_at < NEW.created_at - ${row('max_age_ms')})
          OR id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, rowid DESC) AS place
                                      FROM tab_versions WHERE tab_id = NEW.tab_id AND name IS NULL)
                     WHERE place > ${row('max_count')})
          OR id IN (SELECT id FROM (SELECT id, SUM(bytes) OVER (ORDER BY created_at DESC, rowid DESC) AS running
                                      FROM tab_versions WHERE tab_id = NEW.tab_id AND name IS NULL)
                     WHERE running > ${row('max_bytes')}));
END;
`;
