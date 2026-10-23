// The document's own schema (docs/specs/015-api/api.md "Storage"), in its Durable Object's SQLite: everything the
// document holds as content. D1 keeps only what is not content (the documents row, folders, sharing, people, the
// timeline, the image registry and grants) and the index tables this document pushes to it (document-outbox.ts).
//
// One database per document, so `document_id` names the same document on every row. It stays a column (and in
// the keys) because the content modules were written for a store holding many documents, and keeping their SQL
// keyed by document is what lets them run unchanged; it costs a few bytes a row.
//
// Made on first use, never on construction (document-db.ts `ensureSchema`): a Durable Object a stray id wakes
// stores nothing. Versioned by `_document_schema`; a later change adds a step to STEPS, never edits one.

// Elements live in one JSON row per tab (`tabs.data`), capped at MAX_TAB_BYTES (limits.ts), under the 2 MB a
// Durable Object SQLite row or string may hold. Chunking a tab's body over rows (or a row per element) is the
// follow-up for tabs over 2 MB; until then the cap refuses them, as it did on D1.
const V1 = `
CREATE TABLE IF NOT EXISTS document (
  id           TEXT    PRIMARY KEY,
  -- The slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised JSON, or NULL for none.
  presentation TEXT    NULL,
  saved_at     INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tabs (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  data          TEXT    NOT NULL,
  updated_at    INTEGER NOT NULL,
  -- NULL until counted (db/tabs.ts stampTabElementCount).
  element_count INTEGER NULL,
  rev           INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS tabs_rev_advances BEFORE UPDATE OF data ON tabs
  WHEN NEW.rev IS NOT OLD.rev + 1
  BEGIN SELECT RAISE(ABORT, 'tab_rev_stale'); END;

CREATE TABLE IF NOT EXISTS document_tabs (
  document_id TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  folder      TEXT,
  PRIMARY KEY (document_id, tab_id),
  FOREIGN KEY (document_id) REFERENCES document (id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS document_tabs_by_document ON document_tabs (document_id, order_index);
CREATE INDEX IF NOT EXISTS document_tabs_by_tab ON document_tabs (tab_id);

CREATE TABLE IF NOT EXISTS tab_stats (
  tab_id        TEXT    PRIMARY KEY REFERENCES tabs (id) ON DELETE CASCADE,
  -- The tab's editor mode (Diagram, Draw, Workshop), for the Explorer's details.
  mode          TEXT    NOT NULL,
  element_count INTEGER NOT NULL,
  comment_count INTEGER NOT NULL,
  data_bytes    INTEGER NOT NULL,
  written_at    INTEGER NOT NULL
);

-- Which images each tab places (docs/specs/009-elements/images.md "Reference index"), kept from the tab bodies in
-- the same transaction as each write, so the share check and the push to D1's document_images never read a body.
CREATE TABLE IF NOT EXISTS image_refs (
  tab_id   TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS image_refs_image_idx ON image_refs (image_id);

CREATE TABLE IF NOT EXISTS agent_changesets (
  id           TEXT    PRIMARY KEY,
  document_id  TEXT    NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  tab_id       TEXT    NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  rev          INTEGER NOT NULL,
  base_rev     INTEGER,
  author_id    TEXT    NOT NULL,
  author_name  TEXT    NOT NULL,
  author_color TEXT    NOT NULL,
  token_id     TEXT,
  summary      TEXT,
  fingerprints TEXT    NOT NULL,
  added        INTEGER NOT NULL,
  changed      INTEGER NOT NULL,
  removed      INTEGER NOT NULL,
  created_tab  INTEGER NOT NULL DEFAULT 0,
  revert_of    TEXT,
  created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_changesets_tab_rev ON agent_changesets (tab_id, rev);
CREATE INDEX IF NOT EXISTS agent_changesets_document_created ON agent_changesets (document_id, created_at);
CREATE INDEX IF NOT EXISTS agent_changesets_created ON agent_changesets (created_at);
CREATE INDEX IF NOT EXISTS agent_changesets_author_idx ON agent_changesets (author_id);

CREATE TABLE IF NOT EXISTS agent_changeset_parts (
  changeset_id TEXT NOT NULL REFERENCES agent_changesets (id) ON DELETE CASCADE,
  part         TEXT NOT NULL CHECK (part IN ('ops', 'inverse', 'results')),
  data         TEXT NOT NULL,
  PRIMARY KEY (changeset_id, part)
);

-- A tab shared with other documents (docs/specs/006-document/tab-document-many-to-many.md): every document that
-- holds it keeps its own copy under the same tab id, and this lists the OTHER documents holding it. A write here is
-- pushed to each of them (tab-shares.ts), and theirs to this one, the latest write winning.
CREATE TABLE IF NOT EXISTS tab_shares (
  tab_id      TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, document_id)
) WITHOUT ROWID;

-- What this document owes the other holders of its shared tabs, drained by the room's alarm (tab-shares.ts):
--   body:  the tab's current name and body, read when sent
--   join:  member now holds the tab too
--   leave: this document no longer holds the tab
-- A key written again is deleted and inserted under a new id, as in outbox below, so a drain in flight keeps it.
CREATE TABLE IF NOT EXISTS share_outbox (
  id          INTEGER PRIMARY KEY,
  kind        TEXT    NOT NULL CHECK (kind IN ('body', 'join', 'leave')),
  tab_id      TEXT    NOT NULL,
  to_document TEXT    NOT NULL,
  member      TEXT    NOT NULL DEFAULT '',
  UNIQUE (kind, tab_id, to_document, member)
);
CREATE TRIGGER IF NOT EXISTS share_outbox_tab_update AFTER UPDATE OF data, name ON tabs
  WHEN EXISTS (SELECT 1 FROM tab_shares WHERE tab_id = NEW.id)
BEGIN
  DELETE FROM share_outbox WHERE kind = 'body' AND tab_id = NEW.id;
  INSERT INTO share_outbox (kind, tab_id, to_document) SELECT 'body', NEW.id, document_id FROM tab_shares WHERE tab_id = NEW.id;
END;

-- What the document owes D1 (document-outbox.ts): a key per thing whose derived rows changed, filled by the
-- triggers below so no write path can forget it, drained by the room's alarm.
--   tab:     a tab's comment threads and actions (the Inbox's index)
--   images:  the images the document places (D1's document_images, the media service's references, the
--            placement grants)
--   summary: the document's listing summary and saved_at, for the Explorer
-- A key written again while a flush is in flight is deleted and inserted again under a new id, so the flush's
-- delete (by the ids it read) keeps it for the next one. Not INSERT OR REPLACE: inside a trigger, the conflict
-- policy of the statement that fired it wins, and an upsert's is ABORT. A Durable Object holds one document, so
-- document_id is always the same there; it keeps the keys apart where one SQLite holds several documents (the
-- tests).
--
-- A tab's own triggers find its document through its link and write nothing for a tab no document links: the
-- link's triggers (a create links after the insert, a delete unlinks before the delete) cover those moments.
-- Who has voted as a guest (docs/specs/012-collaboration/vote-integrity.md): a guest id costs nothing to make, so a
-- guest's Q&A upvote is admitted against a cap of guest voters per network (vote-integrity.ts).
CREATE TABLE IF NOT EXISTS guest_voters (
  document_id TEXT    NOT NULL,
  network_tag TEXT    NOT NULL,
  person_tag  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (document_id, network_tag, person_tag)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS outbox (
  id          INTEGER PRIMARY KEY,
  document_id TEXT    NOT NULL,
  kind        TEXT    NOT NULL,
  key         TEXT    NOT NULL,
  UNIQUE (document_id, kind, key)
);

CREATE TRIGGER IF NOT EXISTS outbox_tab_update AFTER UPDATE OF data, name, element_count ON tabs
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT document_id, 'tab', NEW.id FROM document_tabs WHERE tab_id = NEW.id UNION ALL SELECT document_id, 'summary', '' FROM document_tabs WHERE tab_id = NEW.id);
  INSERT INTO outbox (document_id, kind, key) SELECT document_id, 'tab', NEW.id FROM document_tabs WHERE tab_id = NEW.id UNION ALL SELECT document_id, 'summary', '' FROM document_tabs WHERE tab_id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_link_insert AFTER INSERT ON document_tabs
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT NEW.document_id, 'tab', NEW.tab_id UNION ALL SELECT NEW.document_id, 'summary', '' UNION ALL SELECT NEW.document_id, 'images', '');
  INSERT INTO outbox (document_id, kind, key) SELECT NEW.document_id, 'tab', NEW.tab_id UNION ALL SELECT NEW.document_id, 'summary', '' UNION ALL SELECT NEW.document_id, 'images', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_link_delete AFTER DELETE ON document_tabs
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT OLD.document_id, 'tab', OLD.tab_id UNION ALL SELECT OLD.document_id, 'summary', '' UNION ALL SELECT OLD.document_id, 'images', '');
  INSERT INTO outbox (document_id, kind, key) SELECT OLD.document_id, 'tab', OLD.tab_id UNION ALL SELECT OLD.document_id, 'summary', '' UNION ALL SELECT OLD.document_id, 'images', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_link_order AFTER UPDATE OF order_index ON document_tabs
  WHEN NEW.order_index IS NOT OLD.order_index
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT NEW.document_id, 'summary', '');
  INSERT INTO outbox (document_id, kind, key) SELECT NEW.document_id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_stats AFTER INSERT ON tab_stats
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT document_id, 'summary', '' FROM document_tabs WHERE tab_id = NEW.tab_id);
  INSERT INTO outbox (document_id, kind, key) SELECT document_id, 'summary', '' FROM document_tabs WHERE tab_id = NEW.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_stats_update AFTER UPDATE ON tab_stats
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT document_id, 'summary', '' FROM document_tabs WHERE tab_id = NEW.tab_id);
  INSERT INTO outbox (document_id, kind, key) SELECT document_id, 'summary', '' FROM document_tabs WHERE tab_id = NEW.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_image_insert AFTER INSERT ON image_refs
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT document_id, 'images', '' FROM document_tabs WHERE tab_id = NEW.tab_id);
  INSERT INTO outbox (document_id, kind, key) SELECT document_id, 'images', '' FROM document_tabs WHERE tab_id = NEW.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_image_delete AFTER DELETE ON image_refs
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT document_id, 'images', '' FROM document_tabs WHERE tab_id = OLD.tab_id);
  INSERT INTO outbox (document_id, kind, key) SELECT document_id, 'images', '' FROM document_tabs WHERE tab_id = OLD.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_document_insert AFTER INSERT ON document
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT NEW.id, 'summary', '');
  INSERT INTO outbox (document_id, kind, key) SELECT NEW.id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_document_saved AFTER UPDATE OF saved_at ON document
BEGIN
  DELETE FROM outbox WHERE (document_id, kind, key) IN (SELECT NEW.id, 'summary', '');
  INSERT INTO outbox (document_id, kind, key) SELECT NEW.id, 'summary', '';
END;
`;

const STEPS: readonly string[] = [V1];

export const DOCUMENT_SCHEMA_VERSION = STEPS.length;

type Exec = (query: string) => { toArray(): Record<string, unknown>[] };

// Bring the document's SQLite up to DOCUMENT_SCHEMA_VERSION. Idempotent: every statement is IF NOT EXISTS, and the
// version row skips what already ran. Runs inside the caller's transaction when it has one.
export function migrateDocumentSchema(exec: Exec): void {
  exec('CREATE TABLE IF NOT EXISTS _document_schema (version INTEGER NOT NULL)');
  const row = exec('SELECT version FROM _document_schema LIMIT 1').toArray()[0];
  const at = typeof row?.version === 'number' ? row.version : 0;
  if (at >= STEPS.length) return;
  for (let step = at; step < STEPS.length; step++) exec(STEPS[step]!);
  exec('DELETE FROM _document_schema');
  exec(`INSERT INTO _document_schema (version) VALUES (${STEPS.length})`);
}

// Whether the document's SQLite holds a schema at all: a read that writes nothing, for a Durable Object woken
// by an id with no document behind it.
export function hasDocumentSchema(exec: Exec): boolean {
  return (
    exec("SELECT 1 AS present FROM sqlite_master WHERE name = '_document_schema'").toArray()
      .length > 0
  );
}
