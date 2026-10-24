// The plan's own schema (docs/specs/015-api/api.md "Storage"), in its Durable Object's SQLite: everything the
// plan holds as content, and what it knows of itself. Where the plan is and who may reach it is liveworkspace's
// index (liveworkspace/docs/one-explorer.md), which this plan pushes its summary and its tabs' comments and
// actions to (plan-outbox.ts).
//
// One database per plan, so `plan_id` names the same plan on every row. It stays a column (and in the keys)
// because the content modules were written for a store holding many plans, and keeping their SQL keyed by plan
// is what lets them run unchanged; it costs a few bytes a row.
//
// Made on first use, never on construction (plan-db.ts `ensureSchema`): a Durable Object a stray id wakes
// stores nothing. Versioned by `_plan_schema`; a later change adds a step to STEPS, never edits one.

import { tabSharesSchema } from '@liveworkspace/index-app';

// Elements live in one JSON row per tab (`tabs.data`), capped at MAX_TAB_BYTES (limits.ts), under the 2 MB a
// Durable Object SQLite row or string may hold. Chunking a tab's body over rows (or a row per element) is the
// follow-up for tabs over 2 MB; until then the cap refuses them, as it did on D1.
const V1 = `
CREATE TABLE IF NOT EXISTS plan (
  id                  TEXT    PRIMARY KEY,
  items_rev           INTEGER NOT NULL DEFAULT 0,
  items_next_key      INTEGER NOT NULL DEFAULT 1,
  item_types          TEXT    NULL,
  item_types_rev      INTEGER NOT NULL DEFAULT 0,
  saved_at            INTEGER NOT NULL,
  -- 0 until the plan is started: made by a create, or on its first open with a grant (plan-content.ts initPlan).
  created_at          INTEGER NOT NULL,
  -- What the plan knows of itself for its own reads (a project read, emails, an agent's listing). The index
  -- holds the truth for the title, owner and team (liveworkspace/docs/one-explorer.md); these are kept from the
  -- grants and renames that reach the plan, and the editor puts a stale name right.
  name                TEXT    NOT NULL DEFAULT '',
  owner_id            TEXT    NOT NULL DEFAULT '',
  team_id             TEXT    NULL,
  -- What made it ('mcp', 'cli', ...), and the creation intent (docs/specs/013-workspace/default-folders.md).
  source              TEXT    NULL,
  opens_in            TEXT    NULL,
  tab_kind            TEXT    NULL,
  template_family     TEXT    NULL,
  -- The comment email's throttle (email/notifications.ts).
  comment_notified_at INTEGER NULL,
  -- When the cached first-tab snapshot in R2 was drawn (thumbnail.ts): fresh while at or after saved_at.
  thumb_rendered_at   INTEGER NULL
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

CREATE TABLE IF NOT EXISTS plan_tabs (
  plan_id     TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  folder      TEXT,
  PRIMARY KEY (plan_id, tab_id),
  FOREIGN KEY (plan_id) REFERENCES plan (id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS plan_tabs_by_plan ON plan_tabs (plan_id, order_index);
CREATE INDEX IF NOT EXISTS plan_tabs_by_tab ON plan_tabs (tab_id);

CREATE TABLE IF NOT EXISTS tab_stats (
  tab_id        TEXT    PRIMARY KEY REFERENCES tabs (id) ON DELETE CASCADE,
  mode          TEXT    NOT NULL,
  kind          TEXT,
  element_count INTEGER NOT NULL,
  comment_count INTEGER NOT NULL,
  data_bytes    INTEGER NOT NULL,
  written_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_changesets (
  id           TEXT    PRIMARY KEY,
  plan_id      TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS agent_changesets_plan_created ON agent_changesets (plan_id, created_at);
CREATE INDEX IF NOT EXISTS agent_changesets_created ON agent_changesets (created_at);
CREATE INDEX IF NOT EXISTS agent_changesets_author_idx ON agent_changesets (author_id);

CREATE TABLE IF NOT EXISTS agent_changeset_parts (
  changeset_id TEXT NOT NULL REFERENCES agent_changesets (id) ON DELETE CASCADE,
  part         TEXT NOT NULL CHECK (part IN ('ops', 'inverse', 'results')),
  data         TEXT NOT NULL,
  PRIMARY KEY (changeset_id, part)
);

CREATE TABLE IF NOT EXISTS items (
  plan_id    TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  id         TEXT    NOT NULL,
  type       TEXT    NOT NULL,
  item_key   INTEGER NOT NULL,
  rank       TEXT    NOT NULL,
  fields     TEXT    NOT NULL,
  rev        INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT    NOT NULL,
  updated_by TEXT    NOT NULL,
  PRIMARY KEY (plan_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS items_plan_key ON items (plan_id, item_key);

CREATE TABLE IF NOT EXISTS sheets (
  plan_id                  TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  id                       TEXT    NOT NULL,
  tab_id                   TEXT    NOT NULL,
  title                    TEXT    NOT NULL,
  layout                   TEXT    NOT NULL,
  rev                      INTEGER NOT NULL,
  cell_count               INTEGER NOT NULL DEFAULT 0,
  cell_bytes               INTEGER NOT NULL DEFAULT 0,
  unreferenced_since       INTEGER,
  write_nonce              TEXT,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL,
  updated_by               TEXT    NOT NULL,
  delete_when_unreferenced INTEGER,
  PRIMARY KEY (plan_id, id)
);
CREATE INDEX IF NOT EXISTS sheets_tab ON sheets (plan_id, tab_id);
CREATE INDEX IF NOT EXISTS sheets_unreferenced ON sheets (unreferenced_since) WHERE unreferenced_since IS NOT NULL;

CREATE TABLE IF NOT EXISTS sheet_cells (
  plan_id  TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  row_id   TEXT NOT NULL,
  col_id   TEXT NOT NULL,
  input    TEXT,
  format   TEXT,
  PRIMARY KEY (plan_id, sheet_id, row_id, col_id),
  FOREIGN KEY (plan_id, sheet_id) REFERENCES sheets (plan_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sheet_refs (
  tab_id   TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, sheet_id)
);
CREATE INDEX IF NOT EXISTS sheet_refs_sheet ON sheet_refs (sheet_id);

CREATE TRIGGER IF NOT EXISTS sheet_refs_added AFTER INSERT ON sheet_refs
BEGIN
  UPDATE sheets SET unreferenced_since = NULL
   WHERE id = NEW.sheet_id
     AND plan_id IN (SELECT plan_id FROM plan_tabs WHERE tab_id = NEW.tab_id)
     AND unreferenced_since IS NOT NULL;
END;

CREATE TRIGGER IF NOT EXISTS sheet_refs_removed AFTER DELETE ON sheet_refs
BEGIN
  DELETE FROM sheets
   WHERE id = OLD.sheet_id
     AND plan_id IN (SELECT plan_id FROM plan_tabs WHERE tab_id = OLD.tab_id)
     AND delete_when_unreferenced = 1
     AND NOT EXISTS (SELECT 1 FROM sheet_refs r JOIN plan_tabs dt ON dt.tab_id = r.tab_id
                      WHERE r.sheet_id = sheets.id AND dt.plan_id = sheets.plan_id);
  UPDATE sheets SET unreferenced_since = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
   WHERE id = OLD.sheet_id
     AND plan_id IN (SELECT plan_id FROM plan_tabs WHERE tab_id = OLD.tab_id)
     AND unreferenced_since IS NULL
     AND NOT EXISTS (SELECT 1 FROM sheet_refs r JOIN plan_tabs dt ON dt.tab_id = r.tab_id
                      WHERE r.sheet_id = sheets.id AND dt.plan_id = sheets.plan_id);
END;

-- What the plan owes the index (plan-outbox.ts): a key per thing whose derived rows changed, filled by the
-- triggers below so no write path can forget it, drained by the room's alarm.
--   tab:     a tab's comment threads and actions (the Inbox), and a Form tab's name and heading on its link
--   summary: the plan's listing summary and its last change, for the Explorer
--   edit:    who wrote to it and when (<person>@<time>, one per person), for the Timeline and Most Used
-- A key written again while a flush is in flight is deleted and inserted again under a new id, so the flush's delete
-- (by the ids it read) keeps it for the next one. Not INSERT OR REPLACE: inside a trigger, the conflict policy of
-- the statement that fired it wins, and an upsert's is ABORT. A Durable Object holds one plan, so plan_id is always the same there; it keeps
-- the keys apart where one SQLite holds several plans (the tests).
--
-- A tab's own triggers find its plan through its link and write nothing for a tab no plan links: the link's
-- triggers (a create links after the insert, a delete unlinks before the delete) cover those moments.
CREATE TABLE IF NOT EXISTS outbox (
  id      INTEGER PRIMARY KEY,
  plan_id TEXT    NOT NULL,
  kind    TEXT    NOT NULL,
  key     TEXT    NOT NULL,
  UNIQUE (plan_id, kind, key)
);

CREATE TRIGGER IF NOT EXISTS outbox_tab_update AFTER UPDATE OF data, name, element_count ON tabs
BEGIN
  DELETE FROM outbox WHERE (plan_id, kind, key) IN (SELECT plan_id, 'tab', NEW.id FROM plan_tabs WHERE tab_id = NEW.id UNION ALL SELECT plan_id, 'summary', '' FROM plan_tabs WHERE tab_id = NEW.id);
  INSERT INTO outbox (plan_id, kind, key) SELECT plan_id, 'tab', NEW.id FROM plan_tabs WHERE tab_id = NEW.id UNION ALL SELECT plan_id, 'summary', '' FROM plan_tabs WHERE tab_id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_link_insert AFTER INSERT ON plan_tabs
BEGIN
  DELETE FROM outbox WHERE (plan_id, kind, key) IN (SELECT NEW.plan_id, 'tab', NEW.tab_id UNION ALL SELECT NEW.plan_id, 'summary', '');
  INSERT INTO outbox (plan_id, kind, key) SELECT NEW.plan_id, 'tab', NEW.tab_id UNION ALL SELECT NEW.plan_id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_link_delete AFTER DELETE ON plan_tabs
BEGIN
  DELETE FROM outbox WHERE (plan_id, kind, key) IN (SELECT OLD.plan_id, 'tab', OLD.tab_id UNION ALL SELECT OLD.plan_id, 'summary', '');
  INSERT INTO outbox (plan_id, kind, key) SELECT OLD.plan_id, 'tab', OLD.tab_id UNION ALL SELECT OLD.plan_id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_stats AFTER INSERT ON tab_stats
BEGIN
  DELETE FROM outbox WHERE (plan_id, kind, key) IN (SELECT plan_id, 'summary', '' FROM plan_tabs WHERE tab_id = NEW.tab_id);
  INSERT INTO outbox (plan_id, kind, key) SELECT plan_id, 'summary', '' FROM plan_tabs WHERE tab_id = NEW.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_stats_update AFTER UPDATE ON tab_stats
BEGIN
  DELETE FROM outbox WHERE (plan_id, kind, key) IN (SELECT plan_id, 'summary', '' FROM plan_tabs WHERE tab_id = NEW.tab_id);
  INSERT INTO outbox (plan_id, kind, key) SELECT plan_id, 'summary', '' FROM plan_tabs WHERE tab_id = NEW.tab_id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_plan_insert AFTER INSERT ON plan
BEGIN
  DELETE FROM outbox WHERE (plan_id, kind, key) IN (SELECT NEW.id, 'summary', '');
  INSERT INTO outbox (plan_id, kind, key) SELECT NEW.id, 'summary', '';
END;
CREATE TRIGGER IF NOT EXISTS outbox_plan_saved AFTER UPDATE OF saved_at ON plan
BEGIN
  DELETE FROM outbox WHERE (plan_id, kind, key) IN (SELECT NEW.id, 'summary', '');
  INSERT INTO outbox (plan_id, kind, key) SELECT NEW.id, 'summary', '';
END;
`;

// The once-only state of the plan's notification emails (@liveworkspace/index-app notify-claims.ts): one row per
// email claimed, keyed by what makes two the same (a hash, never text or an address), with its sender. The hourly
// cap is the sender's own store's. Rows past the longest window are dropped as new ones are claimed.
const V2 = `
CREATE TABLE IF NOT EXISTS notify_claims (
  key    TEXT    PRIMARY KEY,
  sender TEXT    NOT NULL,
  at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notify_claims_sender ON notify_claims (sender, at);
CREATE INDEX IF NOT EXISTS notify_claims_at ON notify_claims (at);
`;

// The plan's form links and the reports against them (db/forms.ts; docs/specs/030-forms/forms.md). A link's code
// is also the index's (forms/form-inbox.ts), which is how the worker finds the plan a public form request names.
// project_id is always the plan's own id here; it keeps the queries the same where one SQLite holds several plans.
const V3 = `
CREATE TABLE IF NOT EXISTS form_links (
  code             TEXT    PRIMARY KEY,
  project_id       TEXT    NOT NULL,
  tab_id           TEXT    NOT NULL,
  open             INTEGER NOT NULL DEFAULT 1,
  created_at       INTEGER NOT NULL,
  -- The response number last given: never reused.
  responses        INTEGER NOT NULL DEFAULT 0,
  -- When the last response arrived (the Inbox's row time).
  last_response_at INTEGER,
  -- The per-form hourly cap's window and count.
  hour_start       INTEGER NOT NULL DEFAULT 0,
  hour_count       INTEGER NOT NULL DEFAULT 0,
  suspended_at     INTEGER,
  -- The new-response email's throttle: when one last went, and how many arrived since.
  last_email_at    INTEGER,
  held_emails      INTEGER NOT NULL DEFAULT 0,
  deleted_at       INTEGER,
  -- The form tab's name, heading and response board, for the Inbox, kept by the plan's outbox.
  tab_name         TEXT,
  heading          TEXT,
  board_tab_id     TEXT
);
CREATE INDEX IF NOT EXISTS form_links_project ON form_links (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS form_links_live_tab ON form_links (project_id, tab_id)
  WHERE suspended_at IS NULL AND deleted_at IS NULL;

-- Abuse reports against a form, one per browser.
CREATE TABLE IF NOT EXISTS form_reports (
  code       TEXT    NOT NULL REFERENCES form_links (code) ON DELETE CASCADE,
  browser    TEXT    NOT NULL,
  network    TEXT    NOT NULL,
  reason     TEXT    NOT NULL,
  note       TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (code, browser)
);
`;

// The plan's cards in the Inbox (plan-outbox.ts cardsPushOf, @liveworkspace/index-app cardsCollabPush): a card
// changed, a board's tab saved, or the type catalogue changed keys the `~cards` push. `known_people` holds the
// person ids the plan has seen write to it (its editors), so a card's hashed assignee can be named to the index;
// the oldest past KNOWN_PEOPLE_MAX go as new ones arrive.
const V4 = `
CREATE TABLE IF NOT EXISTS known_people (
  person_id TEXT    PRIMARY KEY,
  seen_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS known_people_seen ON known_people (seen_at);

CREATE TRIGGER IF NOT EXISTS outbox_cards_insert AFTER INSERT ON items
BEGIN
  DELETE FROM outbox WHERE plan_id = NEW.plan_id AND kind = 'tab' AND key = '~cards';
  INSERT INTO outbox (plan_id, kind, key) VALUES (NEW.plan_id, 'tab', '~cards');
END;
CREATE TRIGGER IF NOT EXISTS outbox_cards_update AFTER UPDATE ON items
BEGIN
  DELETE FROM outbox WHERE plan_id = NEW.plan_id AND kind = 'tab' AND key = '~cards';
  INSERT INTO outbox (plan_id, kind, key) VALUES (NEW.plan_id, 'tab', '~cards');
END;
CREATE TRIGGER IF NOT EXISTS outbox_cards_delete AFTER DELETE ON items
BEGIN
  DELETE FROM outbox WHERE plan_id = OLD.plan_id AND kind = 'tab' AND key = '~cards';
  INSERT INTO outbox (plan_id, kind, key) VALUES (OLD.plan_id, 'tab', '~cards');
END;
CREATE TRIGGER IF NOT EXISTS outbox_cards_boards AFTER UPDATE OF data, name ON tabs
  WHEN NEW.data LIKE '%"plan-board"%' OR OLD.data LIKE '%"plan-board"%'
BEGIN
  DELETE FROM outbox WHERE (plan_id, kind, key) IN (SELECT plan_id, 'tab', '~cards' FROM plan_tabs WHERE tab_id = NEW.id);
  INSERT INTO outbox (plan_id, kind, key) SELECT plan_id, 'tab', '~cards' FROM plan_tabs WHERE tab_id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS outbox_cards_plan AFTER UPDATE OF item_types, owner_id, team_id ON plan
  WHEN OLD.item_types IS NOT NEW.item_types OR OLD.owner_id IS NOT NEW.owner_id OR OLD.team_id IS NOT NEW.team_id
BEGIN
  DELETE FROM outbox WHERE plan_id = NEW.id AND kind = 'tab' AND key = '~cards';
  INSERT INTO outbox (plan_id, kind, key) VALUES (NEW.id, 'tab', '~cards');
END;
`;

// A tab shared with other plans (docs/specs/006-project/tab-project-many-to-many.md): tab_shares lists the OTHER
// plans holding each, share_outbox what this one owes them (@liveworkspace/index-app tab-shares.ts). Its own step:
// it was first written into V1, which plans made before then had already run, so they had neither table and every
// write and preview of theirs failed ("no such table: share_outbox"). Every statement is IF NOT EXISTS, so a plan
// made in between, which has them, runs it harmlessly.
const V5 = tabSharesSchema();

const STEPS: readonly string[] = [V1, V2, V3, V4, V5];

export const PLAN_SCHEMA_VERSION = STEPS.length;

type Exec = (query: string) => { toArray(): Record<string, unknown>[] };

// Bring the plan's SQLite up to PLAN_SCHEMA_VERSION. Idempotent: every statement is IF NOT EXISTS, and the
// version row skips what already ran. Runs inside the caller's transaction when it has one.
export function migratePlanSchema(exec: Exec): void {
  exec('CREATE TABLE IF NOT EXISTS _plan_schema (version INTEGER NOT NULL)');
  const row = exec('SELECT version FROM _plan_schema LIMIT 1').toArray()[0];
  const at = typeof row?.version === 'number' ? row.version : 0;
  if (at >= STEPS.length) return;
  for (let step = at; step < STEPS.length; step++) exec(STEPS[step]!);
  exec('DELETE FROM _plan_schema');
  exec(`INSERT INTO _plan_schema (version) VALUES (${STEPS.length})`);
}

// Whether the plan's SQLite holds a schema at all: a read that writes nothing, for a Durable Object woken
// by an id with no plan behind it.
export function hasPlanSchema(exec: Exec): boolean {
  return (
    exec("SELECT 1 AS present FROM sqlite_master WHERE name = '_plan_schema'").toArray().length > 0
  );
}
