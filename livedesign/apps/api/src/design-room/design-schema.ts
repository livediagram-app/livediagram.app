// The design's own schema (docs/specs/015-api/api.md "Storage"), in its Durable Object's SQLite: everything the
// design holds as content, and what it knows of itself. Where the design is and who may reach it is liveworkspace's
// index (liveworkspace/docs/one-explorer.md), which this design pushes its summary and its tabs' comments and
// actions to (design-outbox.ts).
//
// One database per design, so `design_id` names the same design on every row. It stays a column (and in the keys)
// because the content modules were written for a store holding many designs, and keeping their SQL keyed by design
// is what lets them run unchanged; it costs a few bytes a row.
//
// Made on first use, never on construction (design-db.ts `ensureSchema`): a Durable Object a stray id wakes
// stores nothing. Versioned by `_design_schema`; a later change adds a step to STEPS, never edits one.

import { tabSharesSchema } from '@liveworkspace/index-app';

// Elements live in one JSON row per tab (`tabs.data`), capped at MAX_TAB_BYTES (limits.ts), under the 2 MB a
// Durable Object SQLite row or string may hold. Chunking a tab's body over rows (or a row per element) is the
// follow-up for tabs over 2 MB; until then the cap refuses them, as it did on D1.
const V1 = `
CREATE TABLE IF NOT EXISTS design (
  id                  TEXT    PRIMARY KEY,
  saved_at            INTEGER NOT NULL,
  -- 0 until the design is started: made by a create, or on its first open with a grant (design-content.ts initDesign).
  created_at          INTEGER NOT NULL,
  -- What the design knows of itself for its own reads (a design read, emails, an agent's listing). The index
  -- holds the truth for the title, owner and team (liveworkspace/docs/one-explorer.md); these are kept from the
  -- grants and renames that reach the design, and the editor puts a stale name right.
  name                TEXT    NOT NULL DEFAULT '',
  owner_id            TEXT    NOT NULL DEFAULT '',
  team_id             TEXT    NULL,
  -- What made it ('mcp', 'cli', ...), and the creation intent (docs/specs/013-workspace/default-folders.md).
  source              TEXT    NULL,
  opens_in            TEXT    NULL,
  tab_kind            TEXT    NULL,
  -- The comment email's throttle (email/notifications.ts).
  comment_notified_at INTEGER NULL,
  -- When the cached first-tab snapshot in R2 was drawn (thumbnail.ts): fresh while at or after saved_at.
  thumb_rendered_at   INTEGER NULL,
  -- The slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised JSON, or NULL for none.
  presentation        TEXT    NULL
);

CREATE TABLE IF NOT EXISTS tabs (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  data          TEXT    NOT NULL,
  updated_at    INTEGER NOT NULL,
  element_count INTEGER NULL,
  rev           INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS tabs_rev_advances BEFORE UPDATE OF data ON tabs
  WHEN NEW.rev IS NOT OLD.rev + 1
  BEGIN SELECT RAISE(ABORT, 'tab_rev_stale'); END;

CREATE TABLE IF NOT EXISTS design_tabs (
  design_id     TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  folder      TEXT,
  PRIMARY KEY (design_id, tab_id),
  FOREIGN KEY (design_id) REFERENCES design (id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS design_tabs_by_design ON design_tabs (design_id, order_index);
CREATE INDEX IF NOT EXISTS design_tabs_by_tab ON design_tabs (tab_id);

CREATE TABLE IF NOT EXISTS tab_stats (
  tab_id        TEXT    PRIMARY KEY REFERENCES tabs (id) ON DELETE CASCADE,
  mode          TEXT    NOT NULL,
  element_count INTEGER NOT NULL,
  comment_count INTEGER NOT NULL,
  data_bytes    INTEGER NOT NULL,
  written_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_changesets (
  id           TEXT    PRIMARY KEY,
  design_id      TEXT    NOT NULL REFERENCES design (id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS agent_changesets_design_created ON agent_changesets (design_id, created_at);
CREATE INDEX IF NOT EXISTS agent_changesets_created ON agent_changesets (created_at);
CREATE INDEX IF NOT EXISTS agent_changesets_author_idx ON agent_changesets (author_id);

CREATE TABLE IF NOT EXISTS agent_changeset_parts (
  changeset_id TEXT NOT NULL REFERENCES agent_changesets (id) ON DELETE CASCADE,
  part         TEXT NOT NULL CHECK (part IN ('ops', 'inverse', 'results')),
  data         TEXT NOT NULL,
  PRIMARY KEY (changeset_id, part)
);

-- Which images each tab places (docs/specs/009-elements/images.md "Reference index"), kept from the tab bodies in
-- the same transaction as each write, so the media service's references, the usage map and share-visitor reads
-- never read a body. No foreign keys: the delete paths prune it.
CREATE TABLE IF NOT EXISTS image_refs (
  tab_id   TEXT NOT NULL,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS image_refs_image ON image_refs (image_id);

-- Who owns each image the design places, as the media service names them (a guest's id is a one-way hash there),
-- or '' for an id it does not know (docs/specs/009-elements/images.md "Placement grants"): learned once per image,
-- so the share check never asks the service on an image request (@liveworkspace/index-app image-grants.ts).
CREATE TABLE IF NOT EXISTS image_owners (
  image_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL
) WITHOUT ROWID;

-- The images this design may serve beyond its owner's own ("Placement grants", db/image-grants.ts): one its
-- owner's collaborator placed while entitled to, or one a copy carried from a source that could serve it.
CREATE TABLE IF NOT EXISTS image_grants (
  image_id   TEXT    PRIMARY KEY,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

-- The photo blobs a tab may read (docs/specs/031-photo/photo-store.md): it uploaded the bytes, or a copy
-- carried them. The bytes are PHOTO_BLOBS' (db/photo-blobs.ts), shared between designs by content; what each
-- blob is (type, size) is kept on its refs, for the read and the tab's cap.
CREATE TABLE IF NOT EXISTS photo_blob_refs (
  tab_id       TEXT    NOT NULL,
  blob_id      TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  content_type TEXT    NOT NULL,
  byte_size    INTEGER NOT NULL,
  PRIMARY KEY (tab_id, blob_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS photo_blob_refs_blob ON photo_blob_refs (blob_id);

-- A tab shared with other designs (docs/specs/006-design/tab-design-many-to-many.md): tab_shares lists the OTHER
-- designs holding each, share_outbox what this one owes them (@liveworkspace/index-app tab-shares.ts).
${tabSharesSchema()}
-- What the design owes the index (design-outbox.ts): a key per thing whose derived rows changed, filled by the
-- triggers below so no write path can forget it, drained by the room's alarm.
--   tab:     a tab's comment threads and actions (the Inbox)
--   summary: the design's listing summary and its last change, for the Explorer
--   edit:    who wrote to it and when (<person>@<time>, one per person), for the Timeline and Most Used
--   media:   the images it places changed, for liveworkspace's media service (src/media.ts pushDesignMediaRefs)
-- A key written again while a flush is in flight is deleted and inserted again under a new id, so the flush's delete
-- (by the ids it read) keeps it for the next one. Not INSERT OR REPLACE: inside a trigger, the conflict policy of
-- the statement that fired it wins, and an upsert's is ABORT. A Durable Object holds one design, so design_id is always the same there; it keeps
-- the keys apart where one SQLite holds several designs (the tests).
--
-- A tab's own triggers find its design through its link and write nothing for a tab no design links: the link's
-- triggers (a create links after the insert, a delete unlinks before the delete) cover those moments.
CREATE TABLE IF NOT EXISTS outbox (
  id      INTEGER PRIMARY KEY,
  design_id TEXT    NOT NULL,
  kind    TEXT    NOT NULL,
  key     TEXT    NOT NULL,
  UNIQUE (design_id, kind, key)
);

CREATE TRIGGER IF NOT EXISTS outbox_tab_update AFTER UPDATE OF data, name, element_count ON tabs
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT design_id, 'tab', NEW.id FROM design_tabs WHERE tab_id = NEW.id UNION ALL SELECT design_id, 'summary', '' FROM design_tabs WHERE tab_id = NEW.id);
  INSERT INTO outbox (design_id, kind, key) SELECT design_id, 'tab', NEW.id FROM design_tabs WHERE tab_id = NEW.id UNION ALL SELECT design_id, 'summary', '' FROM design_tabs WHERE tab_id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_link_insert AFTER INSERT ON design_tabs
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT NEW.design_id, 'tab', NEW.tab_id UNION ALL SELECT NEW.design_id, 'summary', '');
  INSERT INTO outbox (design_id, kind, key) SELECT NEW.design_id, 'tab', NEW.tab_id UNION ALL SELECT NEW.design_id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_link_delete AFTER DELETE ON design_tabs
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT OLD.design_id, 'tab', OLD.tab_id UNION ALL SELECT OLD.design_id, 'summary', '');
  INSERT INTO outbox (design_id, kind, key) SELECT OLD.design_id, 'tab', OLD.tab_id UNION ALL SELECT OLD.design_id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_stats AFTER INSERT ON tab_stats
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT design_id, 'summary', '' FROM design_tabs WHERE tab_id = NEW.tab_id);
  INSERT INTO outbox (design_id, kind, key) SELECT design_id, 'summary', '' FROM design_tabs WHERE tab_id = NEW.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_stats_update AFTER UPDATE ON tab_stats
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT design_id, 'summary', '' FROM design_tabs WHERE tab_id = NEW.tab_id);
  INSERT INTO outbox (design_id, kind, key) SELECT design_id, 'summary', '' FROM design_tabs WHERE tab_id = NEW.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_design_insert AFTER INSERT ON design
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT NEW.id, 'summary', '');
  INSERT INTO outbox (design_id, kind, key) SELECT NEW.id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_design_saved AFTER UPDATE OF saved_at ON design
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT NEW.id, 'summary', '');
  INSERT INTO outbox (design_id, kind, key) SELECT NEW.id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_media_ref_insert AFTER INSERT ON image_refs
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT design_id, 'media', '' FROM design_tabs WHERE tab_id = NEW.tab_id);
  INSERT INTO outbox (design_id, kind, key) SELECT design_id, 'media', '' FROM design_tabs WHERE tab_id = NEW.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_media_ref_delete AFTER DELETE ON image_refs
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT design_id, 'media', '' FROM design_tabs WHERE tab_id = OLD.tab_id);
  INSERT INTO outbox (design_id, kind, key) SELECT design_id, 'media', '' FROM design_tabs WHERE tab_id = OLD.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_media_link_insert AFTER INSERT ON design_tabs
  WHEN EXISTS (SELECT 1 FROM image_refs WHERE tab_id = NEW.tab_id)
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT NEW.design_id, 'media', '');
  INSERT INTO outbox (design_id, kind, key) SELECT NEW.design_id, 'media', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_media_link_delete AFTER DELETE ON design_tabs
  WHEN EXISTS (SELECT 1 FROM image_refs WHERE tab_id = OLD.tab_id)
BEGIN
  DELETE FROM outbox WHERE (design_id, kind, key) IN (SELECT OLD.design_id, 'media', '');
  INSERT INTO outbox (design_id, kind, key) SELECT OLD.design_id, 'media', '';
END;

-- The once-only state of the design's notification emails (@liveworkspace/index-app notify-claims.ts): one row per
-- email claimed, keyed by what makes two the same (a hash, never text or an address), with its sender. The hourly
-- cap is the sender's own store's. Rows past the longest window are dropped as new ones are claimed.
CREATE TABLE IF NOT EXISTS notify_claims (
  key    TEXT    PRIMARY KEY,
  sender TEXT    NOT NULL,
  at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notify_claims_sender ON notify_claims (sender, at);
CREATE INDEX IF NOT EXISTS notify_claims_at ON notify_claims (at);
`;

const STEPS: readonly string[] = [V1];

export const DESIGN_SCHEMA_VERSION = STEPS.length;

type Exec = (query: string) => { toArray(): Record<string, unknown>[] };

// Bring the design's SQLite up to DESIGN_SCHEMA_VERSION. Idempotent: every statement is IF NOT EXISTS, and the
// version row skips what already ran. Runs inside the caller's transaction when it has one.
export function migrateDesignSchema(exec: Exec): void {
  exec('CREATE TABLE IF NOT EXISTS _design_schema (version INTEGER NOT NULL)');
  const row = exec('SELECT version FROM _design_schema LIMIT 1').toArray()[0];
  const at = typeof row?.version === 'number' ? row.version : 0;
  if (at >= STEPS.length) return;
  for (let step = at; step < STEPS.length; step++) exec(STEPS[step]!);
  exec('DELETE FROM _design_schema');
  exec(`INSERT INTO _design_schema (version) VALUES (${STEPS.length})`);
}

// Whether the design's SQLite holds a schema at all: a read that writes nothing, for a Durable Object woken
// by an id with no design behind it.
export function hasDesignSchema(exec: Exec): boolean {
  return (
    exec("SELECT 1 AS present FROM sqlite_master WHERE name = '_design_schema'").toArray().length >
    0
  );
}
