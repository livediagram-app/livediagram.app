// The document's own schema (docs/specs/015-api/api.md "Storage"), in its Durable Object's SQLite: everything the
// document holds as content, and what it knows of itself. Where the document is filed and who may reach it is
// liveworkspace's index (liveworkspace/docs/specs/004-index/one-explorer.md), which this document pushes its summary, its tabs'
// comments and actions, and who edited it to (document-outbox.ts); the images it places it tells the media service
// itself (liveworkspace/docs/specs/006-media/media.md "References").
//
// One database per document, so `document_id` names the same document on every row. It stays a column (and in
// the keys) because the content modules were written for a store holding many documents, and keeping their SQL
// keyed by document is what lets them run unchanged; it costs a few bytes a row.
//
// Made on first use, never on construction (@liveworkspace/index-app item-db.ts `ensureSchema`): a Durable Object a stray id wakes
// stores nothing. Versioned by `_document_schema`; a later change adds a step to STEPS, never edits one.

import { migrationSchema, tabSharesSchema } from '@liveworkspace/index-app';

// Elements live in one JSON row per tab (`tabs.data`), capped at MAX_TAB_BYTES (limits.ts), under the 2 MB a
// Durable Object SQLite row or string may hold. Chunking a tab's body over rows (or a row per element) is the
// follow-up for tabs over 2 MB; until then the cap refuses them.
const V1 = `
CREATE TABLE IF NOT EXISTS document (
  id                  TEXT    PRIMARY KEY,
  -- The slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised JSON, or NULL for none.
  presentation        TEXT    NULL,
  saved_at            INTEGER NOT NULL,
  -- 0 until the document is started: made by a create, or on its first open with a grant (document-content.ts
  -- initDocument).
  created_at          INTEGER NOT NULL,
  -- What the document knows of itself for its own reads (a document read, emails, an agent's listing). The index
  -- holds the truth for the title, owner and team (liveworkspace/docs/specs/004-index/one-explorer.md); these are kept from the
  -- grants and renames that reach the document, and the editor puts a stale name right.
  name                TEXT    NOT NULL DEFAULT '',
  owner_id            TEXT    NOT NULL DEFAULT '',
  team_id             TEXT    NULL,
  -- What made it ('mcp', 'cli', ...).
  source              TEXT    NULL,
  -- The comment email's throttle (email/notifications.ts).
  comment_notified_at INTEGER NULL
);

-- The document's Community post (docs/specs/025-community/community.md), at most one: its link's share code (an
-- index share link; a grant through it is a content-only pass, routes/context.ts), its post at the liveworkspace
-- Community service, what the link's doors show of it, and the listing state last sent (community-post.ts).
CREATE TABLE IF NOT EXISTS community_post (
  share_code TEXT    PRIMARY KEY,
  author_id  TEXT    NOT NULL,
  post_id    TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  anonymous  INTEGER NOT NULL DEFAULT 1,
  hidden_at  INTEGER NULL,
  sent_state TEXT    NULL,
  checked_at INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

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
-- the same transaction as each write, so the share check and the push to the media service never read a body.
CREATE TABLE IF NOT EXISTS image_refs (
  tab_id   TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS image_refs_image_idx ON image_refs (image_id);

-- Who owns each image the document places, as the media service answered (docs/specs/009-elements/images.md
-- "Placement grants"): the share check reads it instead of asking the service on every image request. An owner of
-- '' is an id the service doesn't know, so a document placing it doesn't ask again on every read.
CREATE TABLE IF NOT EXISTS image_owners (
  image_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL
) WITHOUT ROWID;

-- The images this document may serve beyond its owner's own ("Placement grants"): one the owner's collaborator
-- placed, or one a copy brought from its source.
CREATE TABLE IF NOT EXISTS image_grants (
  image_id   TEXT    PRIMARY KEY,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

-- The once-only state of the document's notification emails (notify-claims.ts): one row per email claimed, keyed by
-- what makes two the same (a hash, never text or an address), with its sender for the hourly cap. Rows past the
-- longest window are dropped as new ones are claimed.
CREATE TABLE IF NOT EXISTS notify_claims (
  key    TEXT    PRIMARY KEY,
  sender TEXT    NOT NULL,
  at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notify_claims_sender ON notify_claims (sender, at);
CREATE INDEX IF NOT EXISTS notify_claims_at ON notify_claims (at);

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

-- Who has voted as a guest (docs/specs/012-collaboration/vote-integrity.md): a guest id costs nothing to make, so a
-- guest's Q&A upvote is admitted against a cap of guest voters per network (vote-integrity.ts).
CREATE TABLE IF NOT EXISTS guest_voters (
  document_id TEXT    NOT NULL,
  network_tag TEXT    NOT NULL,
  person_tag  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (document_id, network_tag, person_tag)
) WITHOUT ROWID;

-- What the document owes the index and the media service (document-outbox.ts): a key per thing whose derived rows
-- changed, filled by the triggers below so no write path can forget it, drained by the room's alarm.
--   tab:     a tab's comment threads and actions (the Inbox)
--   summary: the document's listing summary and its last change, for the Explorer
--   edit:    who edited it and when (<person>@<time>, one per person), for the Timeline and Most Used
--   images:  the images the document places (the media service's references, the placement grants)
-- A key written again while a flush is in flight is deleted and inserted again under a new id, so the flush's
-- delete (by the ids it read) keeps it for the next one. Not INSERT OR REPLACE: inside a trigger, the conflict
-- policy of the statement that fired it wins, and an upsert's is ABORT. A Durable Object holds one document, so
-- document_id is always the same there; it keeps the keys apart where one SQLite holds several documents (the
-- tests).
--
-- A tab's own triggers find its document through its link and write nothing for a tab no document links: the
-- link's triggers (a create links after the insert, a delete unlinks before the delete) cover those moments.
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
-- A Community post listed, hidden, moved or taken down changes whether the canvas is public, which its summary says.
CREATE TRIGGER IF NOT EXISTS outbox_community_insert AFTER INSERT ON community_post
BEGIN
  INSERT OR IGNORE INTO outbox (document_id, kind, key) SELECT id, 'summary', '' FROM document;
END;
CREATE TRIGGER IF NOT EXISTS outbox_community_update AFTER UPDATE OF hidden_at, sent_state ON community_post
  WHEN NEW.hidden_at IS NOT OLD.hidden_at OR NEW.sent_state IS NOT OLD.sent_state
BEGIN
  INSERT OR IGNORE INTO outbox (document_id, kind, key) SELECT id, 'summary', '' FROM document;
END;
CREATE TRIGGER IF NOT EXISTS outbox_community_delete AFTER DELETE ON community_post
BEGIN
  INSERT OR IGNORE INTO outbox (document_id, kind, key) SELECT id, 'summary', '' FROM document;
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

// A tab shared with other items (@liveworkspace/index-app tab-shares.ts): tab_shares lists the others holding
// each, share_outbox what this one owes them. Its own step: it was first written into V1, which rooms made before
// then had already run, so they had neither table and their writes failed ("no such table: share_outbox"). Every
// statement is IF NOT EXISTS, so a room made in between, which has them, runs it harmlessly.
const V2 = tabSharesSchema();

// What the migration door wrote (@liveworkspace/index-app migration-room.ts; docs/migration.md "The apps' migration
// door"): the revision it last wrote each tab and row at, so a re-run replaces only what nobody has saved since. Its
// own step, appended: every statement is IF NOT EXISTS.
const V3 = migrationSchema();

const STEPS: readonly string[] = [V1, V2, V3];

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
