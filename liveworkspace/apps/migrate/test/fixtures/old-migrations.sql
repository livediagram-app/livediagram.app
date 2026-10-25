-- The historical livediagram.app's D1 migrations, frozen at its production schema level
-- (0099_workbench_workspace.sql, its repository's origin/main), for the migrate tool's tests: each one follows
-- its "-- migration: <name>" line. Read-only reference; never applied anywhere but a test's SQLite.

-- migration: 0001_init.sql
-- Diagrams: one row per saved diagram. `data` is the full JSON payload
-- of `tabs[]` (same shape the frontend persists today via localStorage),
-- stored as TEXT and parsed at the boundary. Document-store pattern
-- because every read/write hits the whole document anyway and the
-- frontend already round-trips JSON.
CREATE TABLE diagrams (
  id           TEXT    PRIMARY KEY,
  owner_id     TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  data         TEXT    NOT NULL,
  saved_at     INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);

-- Owner-scoped list queries are the only multi-row pattern today.
CREATE INDEX idx_diagrams_owner_recent ON diagrams (owner_id, saved_at DESC);

-- Participants: one row per local identity. Mirrors the
-- `Participant` type in apps/live/lib/identity.ts (id, name, color).
-- Status is volatile (online/away/stale) and stays client-side until
-- websockets propagate it, so it's not stored here.
CREATE TABLE participants (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);

-- migration: 0002_share.sql
-- A diagram is private by default. Sharing produces a short share code
-- that goes into the share URL `/live?s=<code>`; the owner's URL
-- (`/live?d=<id>`) stays the same and remains private to them. Realtime
-- (Durable Object room + presence) is only active while `shareable = 1`,
-- so unshared diagrams skip the WebSocket entirely.
--
-- `share_code` is nullable: NULL means "never shared". Revoking sets it
-- back to NULL; re-sharing mints a new code, so old URLs are invalid.
ALTER TABLE diagrams ADD COLUMN share_code TEXT;
ALTER TABLE diagrams ADD COLUMN shareable INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_diagrams_share_code ON diagrams (share_code)
WHERE share_code IS NOT NULL;

-- migration: 0003_share_links.sql
-- Multiple share links per diagram, each with its own role. Replaces
-- the single-code model from migration 0002 by:
--   1. introducing a share_links table keyed on the short code,
--   2. backfilling existing shared diagrams as `edit` links,
--   3. leaving the `share_code` / `shareable` columns in place for
--      now so the API can roll out gradually. A future migration can
--      drop them once nothing reads them.
--
-- Role vocabulary is intentionally narrow: 'edit' grants full
-- read/write to the diagram, 'view' is read-only. Anything more
-- granular can be added with a new column or a separate permissions
-- table later.

CREATE TABLE share_links (
  code        TEXT    PRIMARY KEY,
  diagram_id  TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('edit', 'view')),
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX idx_share_links_diagram ON share_links (diagram_id);

-- Backfill: every currently-shared diagram becomes an `edit` link
-- under its existing code. Older diagrams whose share_code is NULL
-- are left untouched.
INSERT INTO share_links (code, diagram_id, role, created_at)
SELECT share_code, id, 'edit', created_at
FROM diagrams
WHERE share_code IS NOT NULL AND shareable = 1;

-- migration: 0004_change_log.sql
-- Per-diagram audit log. One row per undoable commit. Dropped by
-- 0064_drop_change_log.sql (see docs/specs/012-collaboration/README.md).
--
-- before_state / after_state are JSON objects keyed by element id:
--   null  → element didn't exist on that side of the change
--   {...} → full Element snapshot
-- The pair lets the live app surgically revert one entry without
-- discarding any unrelated changes that came after.

CREATE TABLE change_log (
  id                TEXT PRIMARY KEY,
  diagram_id        TEXT NOT NULL,
  tab_id            TEXT,
  participant_id    TEXT NOT NULL,
  participant_name  TEXT NOT NULL,
  participant_color TEXT NOT NULL,
  kind              TEXT NOT NULL,
  summary           TEXT NOT NULL,
  element_ids       TEXT NOT NULL,
  before_state      TEXT NOT NULL,
  after_state       TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX change_log_diagram_idx ON change_log(diagram_id, created_at DESC);
CREATE INDEX change_log_tab_idx     ON change_log(tab_id);

-- migration: 0005_tabs.sql
-- Per-tab storage. See docs/specs/006-document/per-tab-storage.md.
--
-- Before this migration tabs lived as a JSON array inside
-- diagrams.data. Every keystroke serialised every tab on every save.
-- After: each tab is its own row keyed on (id), referenced by
-- diagrams via the FK. diagrams.data stays in place for one release
-- window so a rollback can fall back to the old format; a later
-- migration drops it.
--
-- Backfill: we walk each existing diagram and explode its data JSON
-- into one row per tab. SQLite's json_each works perfectly for this.

CREATE TABLE tabs (
  id           TEXT PRIMARY KEY,
  diagram_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  order_index  INTEGER NOT NULL,
  -- JSON shape mirrors the live app's Tab type minus { id, name },
  -- which live on the row. Holds elements + per-tab metadata
  -- (theme, backgroundColor, backgroundPattern, backgroundOpacity,
  -- patternColor, templateChosen, locked).
  data         TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX tabs_diagram_idx ON tabs(diagram_id, order_index);

-- Backfill from the old diagrams.data blob. `json_each` iterates the
-- top-level tabs array; `value` gives us each tab object. We strip
-- id/name out before stashing the rest in data, since those become
-- their own columns. `key` is the array index, which doubles as
-- order_index. saved_at is reused as updated_at.
INSERT INTO tabs (id, diagram_id, name, order_index, data, updated_at)
SELECT
  json_extract(je.value, '$.id')   AS id,
  d.id                              AS diagram_id,
  json_extract(je.value, '$.name') AS name,
  je.key                            AS order_index,
  json_remove(je.value, '$.id', '$.name') AS data,
  d.saved_at                        AS updated_at
FROM diagrams d, json_each(d.data) je;

-- migration: 0006_drop_diagrams_data.sql
-- The diagrams.data JSON blob was retained one release window as a
-- rollback safety net after the per-tab storage refactor (docs/specs/006-document/per-tab-storage.md +
-- migration 0005). The new code has been live and writing to the
-- `tabs` table; the column is now dead weight.
--
-- D1's SQLite (3.45+) supports ALTER TABLE DROP COLUMN cleanly so
-- this is a one-liner. Existing rows lose nothing else.

ALTER TABLE diagrams DROP COLUMN data;

-- migration: 0007_folders.sql
-- Folders. See docs/specs/013-workspace/folders.md.
--
-- Each diagram belongs to at most one folder (folder_id IS NULL → the
-- conceptual "Unsorted" bucket). Folders nest via self-referential
-- parent_id; both FKs use ON DELETE SET NULL so deleting a folder
-- promotes its direct children rather than cascading. Cycle
-- prevention on the folders tree lives in the API layer (D1 can't
-- enforce it declaratively).

CREATE TABLE folders (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  parent_id   TEXT NULL,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE INDEX folders_owner_idx ON folders(owner_id);
CREATE INDEX folders_parent_idx ON folders(parent_id);

-- Diagrams reference folders via a nullable column. SQLite doesn't
-- support adding a column with a REFERENCES clause via ALTER, so the
-- FK is declared but unenforced at the schema level — the app keeps
-- referential integrity via the API.
ALTER TABLE diagrams ADD COLUMN folder_id TEXT NULL;

CREATE INDEX diagrams_folder_idx ON diagrams(folder_id);

-- migration: 0008_drop_diagrams_share_code.sql
-- Drop diagrams.share_code. The column was a single-code field from
-- before share_links (migration 0003) introduced per-link rows for
-- multi-link sharing. The API now derives the diagram's "primary"
-- share code from share_links directly; the column has no remaining
-- readers after this release and is dropping out of every DTO.
--
-- No data migration needed — every code that mattered already lives
-- in share_links (createShareLink wrote both; deleteShareLink kept
-- the column in sync). The column simply goes away.
--
-- The unique index from migration 0002 has to go first or SQLite
-- refuses to drop the underlying column.

DROP INDEX IF EXISTS idx_diagrams_share_code;
ALTER TABLE diagrams DROP COLUMN share_code;

-- migration: 0009_drop_template_chosen.sql
-- Drop `templateChosen` from every stored tab's JSON blob.
--
-- The field was added when the per-tab template picker first
-- landed: it told the editor "the user has dismissed the picker
-- for this tab, don't re-show it". It belongs in UI state, not in
-- persistent diagram state — clearing all elements on a tab still
-- shouldn't re-show the picker WITHIN a session, but a refresh
-- showing the picker again on an empty tab is the right behaviour.
--
-- Client writes already strip the field; this catches every row
-- written before that change.

UPDATE tabs
   SET data = json_remove(data, '$.templateChosen'),
       updated_at = strftime('%s', 'now') * 1000
 WHERE json_extract(data, '$.templateChosen') IS NOT NULL;

-- migration: 0010_shared_with.sql
-- Track which diagrams a non-owner has accessed via a share link, so
-- the live app can render a "Shared with you" accordion in the
-- Explorer (docs/specs/013-workspace/folders.md / item #8 on the post-prototype feature haul).
--
-- Each row says "owner OWNER_ID has opened diagram DIAGRAM_ID at
-- least once via a share link, most recently at LAST_SEEN, under
-- ROLE." Primary key on (owner_id, diagram_id) keeps the table
-- idempotent — repeat visits just bump last_seen.
--
-- Cascades through diagrams: revoking a diagram (account delete,
-- explicit removal) drops every visitor's reference for free.
CREATE TABLE shared_with (
  owner_id TEXT NOT NULL,
  diagram_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('edit', 'view')),
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (owner_id, diagram_id),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX shared_with_by_owner ON shared_with(owner_id, last_seen DESC);

-- migration: 0011_diagram_tabs.sql
-- Many-to-many tab ↔ diagram link table. See docs/specs/006-document/tab-document-many-to-many.md for the full
-- model + phasing. This migration is the first of four:
--
--   0011 (this) — add diagram_tabs, backfill from tabs.diagram_id /
--                 tabs.order_index. Reads start going through the
--                 link table; writes update both the link table
--                 AND the legacy tabs.diagram_id column. No
--                 surface change.
--   #14         — drop change_log.diagram_id (now derivable).
--   #15         — drop change_log.participant_name + _color.
--   future     — drop tabs.diagram_id + tabs.order_index once
--                 every reader has moved off the legacy path.

CREATE TABLE diagram_tabs (
  diagram_id  TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (diagram_id, tab_id),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id)     REFERENCES tabs(id)     ON DELETE CASCADE
);

-- Lookup orderings: "give me this diagram's tabs in order" is the
-- hot read path, and "which diagrams contain this tab?" is the
-- inverted one #14 + #15 will lean on.
CREATE INDEX diagram_tabs_by_diagram ON diagram_tabs(diagram_id, order_index);
CREATE INDEX diagram_tabs_by_tab     ON diagram_tabs(tab_id);

-- Backfill from the legacy tabs.diagram_id column. Every existing
-- (id, diagram_id, order_index) becomes one link row at the same
-- order_index. updated_at is the best available timestamp for
-- "when did this tab join this diagram" — the original create
-- time wasn't tracked.
INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at)
SELECT diagram_id, id, order_index, updated_at FROM tabs;

-- migration: 0012_change_log_drop_diagram_id.sql
-- Drop change_log.diagram_id (item #14 / docs/specs/006-document/tab-document-many-to-many.md).
--
-- Every change_log entry is keyed on a tab_id today, and a tab now
-- (post migration 0011) lives in a many-to-many relationship with
-- diagrams via the diagram_tabs link table. That means "which
-- diagram does this change belong to" stops being a single-value
-- answer — the change belongs to every diagram that contains the
-- tab. Storing diagram_id on the change_log row freezes a snapshot
-- of that relationship at write time, which is the wrong place to
-- represent it.
--
-- After this migration, GET /api/diagrams/:id/log filters by
-- joining change_log → tabs → diagram_tabs on the requesting
-- diagram. Tab-scoped reads (`?tab=<tabId>`) stay one query.
--
-- SQLite supports ALTER TABLE … DROP COLUMN since 3.35, BUT
-- refuses when a FOREIGN KEY references the column. The shipped
-- 0004_change_log.sql declared `FOREIGN KEY (diagram_id)
-- REFERENCES diagrams(id) ON DELETE CASCADE`, so we use the
-- 12-step table-recreation pattern documented in the SQLite docs:
-- create the new shape, copy rows, drop the old, rename. Same
-- effect as DROP COLUMN once we're past it.

-- Drop the old indexes first so the recreation can claim their
-- names; they get re-built below at the end.
DROP INDEX IF EXISTS change_log_diagram_idx;
DROP INDEX IF EXISTS change_log_tab_idx;

CREATE TABLE change_log_new (
  id                TEXT PRIMARY KEY,
  tab_id            TEXT,
  participant_id    TEXT NOT NULL,
  participant_name  TEXT NOT NULL,
  participant_color TEXT NOT NULL,
  kind              TEXT NOT NULL,
  summary           TEXT NOT NULL,
  element_ids       TEXT NOT NULL,
  before_state      TEXT NOT NULL,
  after_state       TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

INSERT INTO change_log_new (id, tab_id, participant_id, participant_name, participant_color, kind, summary, element_ids, before_state, after_state, created_at)
SELECT id, tab_id, participant_id, participant_name, participant_color, kind, summary, element_ids, before_state, after_state, created_at
FROM change_log;

DROP TABLE change_log;
ALTER TABLE change_log_new RENAME TO change_log;

-- "Most recent N entries for this diagram" still needs a fast
-- created_at sort. The diagram-scoped filter now goes through the
-- link table so the inner index is on (tab_id, created_at) —
-- diagram filter outside, then walk the order. Tab-scoped reads
-- pick up the same index.
CREATE INDEX change_log_tab_created_at_idx ON change_log(tab_id, created_at DESC);

-- migration: 0013_change_log_drop_participant_denorm.sql
-- Drop change_log.participant_name + participant_color (item #15 /
-- docs/specs/006-document/tab-document-many-to-many.md). They were copy-on-write snapshots so the UI could render
-- "who did this" without needing the participants row to still
-- exist, but the denormalisation costs us:
--
-- 1. A rename in `participants` doesn't propagate to historical
--    change_log entries — old rows show the participant's old name
--    forever.
-- 2. Two columns of duplicate state on every audit row, the most
--    write-heavy table by entry count.
--
-- Post-migration the api joins through `participants` on read.
-- Orphaned participant ids (sign-out, account delete cascading
-- through diagrams → tabs → change_log doesn't always reach a still
-- alive participants row) fall back to "Unknown" / a muted grey on
-- the client.
--
-- Standard 12-step recreate dance again — `tab_id REFERENCES
-- tabs(id)` would let DROP COLUMN succeed in isolation, but doing
-- two recreates back-to-back is cleaner than mixing semantics.

DROP INDEX IF EXISTS change_log_tab_created_at_idx;

CREATE TABLE change_log_new (
  id             TEXT PRIMARY KEY,
  tab_id         TEXT,
  participant_id TEXT NOT NULL,
  kind           TEXT NOT NULL,
  summary        TEXT NOT NULL,
  element_ids    TEXT NOT NULL,
  before_state   TEXT NOT NULL,
  after_state    TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

INSERT INTO change_log_new (id, tab_id, participant_id, kind, summary, element_ids, before_state, after_state, created_at)
SELECT id, tab_id, participant_id, kind, summary, element_ids, before_state, after_state, created_at
FROM change_log;

DROP TABLE change_log;
ALTER TABLE change_log_new RENAME TO change_log;

CREATE INDEX change_log_tab_created_at_idx ON change_log(tab_id, created_at DESC);

-- migration: 0014_images.sql
-- Image element gallery, per docs/specs/009-elements/images.md.
--
-- Each row indexes one image whose bytes live in the R2 bucket bound
-- as IMAGES (key === images.id). The (owner_id, sha256) unique index
-- drives dedupe so a second upload of identical bytes by the same
-- owner short-circuits without touching R2. The (owner_id, created_at)
-- index serves the gallery list endpoint.

CREATE TABLE images (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  byte_size     INTEGER NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  original_name TEXT,
  created_at    INTEGER NOT NULL
);

CREATE UNIQUE INDEX images_owner_sha_idx ON images (owner_id, sha256);
CREATE INDEX images_owner_created_idx ON images (owner_id, created_at DESC);

-- migration: 0015_telemetry_events.sql
-- Anonymous product telemetry, per docs/specs/017-telemetry/telemetry.md. Each row is a three-field
-- event (category / action / type) plus a server-stamped timestamp.
-- There is deliberately NO owner / IP / user-generated-content column:
-- rows are anonymous by construction, so the public /telemetry
-- dashboard can never surface anything identifying.
--
-- Lives in the existing DB (not a separate database) so self-hosters
-- who already provisioned it get telemetry + the dashboard with zero
-- extra setup. The ts index serves the fixed-window aggregate queries
-- (today / last 7 days / last 30 days).

CREATE TABLE events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  action   TEXT NOT NULL,
  type     TEXT,
  ts       INTEGER NOT NULL
);

CREATE INDEX events_ts_idx ON events (ts);

-- migration: 0016_user_preferences.sql
-- Per-user editor preferences (docs/specs/007-editor/user-preferences.md). One row per owner, with the
-- preference flags themselves stored as a JSON blob so adding a new
-- flag never requires a schema change. The opaque-blob shape mirrors
-- how docs/specs/017-telemetry/telemetry.md keeps `events` flexible: each row's content is the
-- client's responsibility, the server just bounds the size.
--
-- Owners are the same hybrid identity the rest of the api uses
-- (docs/specs/014-identity/auth-and-guest-access.md): Clerk userId when the request carries a verified Bearer
-- token, the per-browser `X-Owner-Id` participant id otherwise. Self-
-- hosters without Clerk get the guest path for free.

CREATE TABLE user_preferences (
  owner_id   TEXT PRIMARY KEY NOT NULL,
  prefs      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- migration: 0017_share_password.sql
-- Optional per-diagram share password (docs/specs/013-workspace/share-password.md). When set, any non-owner
-- opening a share link for this diagram must supply the password before the
-- api will resolve the diagram or honour reads / writes carried on that
-- share code. One password covers every share link the diagram has.
--
-- Stored in plain text on purpose: the owner reads it back and edits it on
-- the Share dialog, and the threat model is "stop drive-by URL guessing", not
-- cryptographic secrecy. It lives behind the owner-authenticated API and is
-- NEVER returned in the standard diagram DTO (only via the owner-only share
-- endpoints). NULL = no password (the default for every existing diagram).

ALTER TABLE diagrams ADD COLUMN share_password TEXT;

-- migration: 0018_diagram_tabs_folder.sql
-- Tab folders (docs/specs/006-document/tab-folders.md). A diagram's tabs can be grouped into
-- one-level, named folders along the tab bar. Membership is
-- per-diagram, so it lives on the diagram_tabs link row alongside
-- order_index (a tab shared into two diagrams can be foldered in
-- one and loose in the other — see docs/specs/006-document/tab-document-many-to-many.md).
--
-- NULL = loose (no folder). No backfill: every existing tab is
-- loose. No index: folders are derived by a client-side scan over
-- the already-ordered hot read (diagram_tabs_by_diagram).
--
-- Deliberately NOT mirrored onto the legacy `tabs` table the way
-- order_index is (0011) — folder membership is a diagram-link
-- concept with no legacy denormalised equivalent.
ALTER TABLE diagram_tabs ADD COLUMN folder TEXT;

-- migration: 0019_teams.sql
-- Teams (docs/specs/013-workspace/teams.md): named groups of signed-in users with Admin/Member
-- roles, plus the member link table that doubles as the invite store.
--
-- teams has no owner column: ownership is the 'admin' role on the
-- link rows, so a team survives its creator leaving (the last-admin
-- guard in the API layer keeps at least one admin alive).
--
-- team_members.user_id is the Clerk user id, NULL while the invite
-- is pending; email is the lowercased invite address, NULL only on a
-- creator row minted when the JWT carried no email claim. The API
-- layer guarantees one of the two is always set (SQLite CHECK kept
-- out for parity with the rest of the schema, which enforces shape
-- in the worker).

CREATE TABLE teams (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  organisation  TEXT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE team_members (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL,
  user_id     TEXT NULL,
  email       TEXT NULL,
  role        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX team_members_team_idx ON team_members(team_id);
-- "Which teams am I in" (the GET /api/teams join).
CREATE INDEX team_members_user_idx ON team_members(user_id);
-- The lazy invite claim ("connect every pending row for this email").
CREATE INDEX team_members_email_idx ON team_members(email);
-- One row per address per team; NULL emails (creator rows without a
-- JWT email claim) are distinct under SQLite's unique semantics so
-- they don't collide.
CREATE UNIQUE INDEX team_members_team_email_uq ON team_members(team_id, email);

-- migration: 0020_share_link_expiry.sql
-- Share-link expiry (docs/specs/013-workspace/share-link-expiry.md): an optional lifetime chosen at link
-- creation. `expiry` keeps the chosen duration token so Extend knows
-- what to re-apply; `expires_at` is the enforcement deadline the
-- read-side lookup filters on. Both NULL = never expires, which is
-- what every pre-existing row gets.

ALTER TABLE share_links ADD COLUMN expiry TEXT NULL;
ALTER TABLE share_links ADD COLUMN expires_at INTEGER NULL;

-- migration: 0021_team_member_status.sql
-- Invite accept/decline handshake (docs/specs/013-workspace/teams.md). Membership becomes a
-- two-step: an invite row is born 'invited' and only counts as
-- membership once its owner accepts ('joined'). Declining deletes the
-- row (no column needed for that side).
--
-- Backfill: rows that already connected a user_id joined under the
-- old auto-join rules, so they're grandfathered as 'joined' (anything
-- else would silently eject existing members). Never-connected invite
-- rows (user_id IS NULL) become 'invited' — exactly the state the new
-- flow would have put them in.

ALTER TABLE team_members ADD COLUMN status TEXT NULL;

UPDATE team_members
SET status = CASE WHEN user_id IS NULL THEN 'invited' ELSE 'joined' END;

-- migration: 0022_team_library.sql
-- Team shared diagrams (docs/specs/013-workspace/team-shared-documents.md): both folders and diagrams gain a
-- nullable team scope. NULL = personal (every pre-existing row);
-- non-null = part of that team's shared library, authorised by
-- joined membership (docs/specs/013-workspace/teams.md) rather than ownership. A team diagram
-- with folder_id NULL sits in the team's synthetic Unsorted, exactly
-- mirroring the personal tree's NULL-folder semantics (docs/specs/013-workspace/folders.md).

ALTER TABLE folders ADD COLUMN team_id TEXT NULL;
CREATE INDEX folders_team_idx ON folders(team_id);

ALTER TABLE diagrams ADD COLUMN team_id TEXT NULL;
CREATE INDEX diagrams_team_idx ON diagrams(team_id);

-- migration: 0023_invite_token.sql
-- Token-based team invites (docs/specs/013-workspace/teams.md): an unguessable token per pending
-- invite so a person can claim it from a shared link, independent of
-- the Clerk session-token `email` claim (which the auto-connect path
-- relies on and which is easy to misconfigure). NULL on joined /
-- creator rows; set when an invite is created. Indexed for the
-- claim-by-token lookup.
ALTER TABLE team_members ADD COLUMN invite_token TEXT NULL;
CREATE INDEX team_members_invite_token_idx ON team_members(invite_token);

-- migration: 0024_perf_indexes.sql
-- Composite indexes for hot read paths (perf review). No schema or
-- data changes, indexes only.

-- 1. team_members(team_id, user_id): getMembership runs on the
--    team-diagram access hot path (canReadDiagram / canEditDiagram on
--    every team-diagram read and autosave). The existing single-column
--    team_members_user_idx / team_members_team_idx force a seek on one
--    column then a filter on the other; this composite resolves the
--    (team_id, user_id) lookup in a single exact seek.
CREATE INDEX team_members_team_user_idx ON team_members (team_id, user_id);

-- 2. share_links primary-code derivation. The diagram list + "shared
--    with you" endpoints derive each row's primary share code via a
--    correlated subquery:
--      WHERE diagram_id = ? [AND role = ?] ORDER BY created_at ASC LIMIT 1
--    With only idx_share_links_diagram(diagram_id) SQLite seeks by
--    diagram_id then SORTS the matches to satisfy ORDER BY created_at.
--    These composites carry created_at (and role) in the index so the
--    ordered LIMIT 1 is answered from the index alone, no sort. The
--    (diagram_id, created_at) index also supersedes the plain
--    diagram_id index (same leading column) for every other lookup.
DROP INDEX idx_share_links_diagram;
CREATE INDEX idx_share_links_diagram_created ON share_links (diagram_id, created_at);
CREATE INDEX idx_share_links_diagram_role_created ON share_links (diagram_id, role, created_at);

-- migration: 0025_team_invite_link.sql
-- Shareable team invite link (docs/specs/013-workspace/teams.md): an admin can actively turn on
-- a per-team join link that expires after a week. Anyone signed in who
-- opens the link can Join the team as a member. Distinct from the
-- per-address email invites (team_members rows) — this is one
-- regenerable token on the team itself, with its own expiry. NULL token
-- = the link is off. Indexed for the token -> team lookup on join.
ALTER TABLE teams ADD COLUMN invite_link_token TEXT NULL;
ALTER TABLE teams ADD COLUMN invite_link_expires_at INTEGER NULL;
CREATE INDEX teams_invite_link_token_idx ON teams(invite_link_token);

-- migration: 0026_custom_themes.sql
-- User-built custom themes, per docs/specs/011-theme/custom-themes.md.
--
-- Owner-scoped (Clerk sub or the X-Owner-Id guest id, like folders /
-- diagrams), guests included. `definition` is the JSON-serialised
-- themable payload (CustomThemeDefinition): backdrop + element colours
-- + optional palette / per-shape colours. The id is `custom:<uuid>`,
-- minted client-side, so it never collides with a built-in theme id and
-- can sit on Tab.theme unchanged. The (owner_id, created_at) index
-- serves the newest-first list endpoint.

CREATE TABLE custom_themes (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  definition  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX custom_themes_owner_idx ON custom_themes (owner_id);
CREATE INDEX custom_themes_owner_created_idx ON custom_themes (owner_id, created_at DESC);

-- migration: 0027_api_tokens.sql
-- API tokens for external callers (docs/specs/015-api/public-api-and-tokens.md). Signed-in (Clerk) users only — a
-- token always acts as a Clerk userId, never a guest id. We store only the
-- SHA-256 hash of the secret (the plaintext is shown once at creation and is
-- never persisted); lookup is by that unique hash. `expires_at` is NOT NULL
-- and fixed at created_at + 6 months — there are no never-expires tokens.
-- Account deletion cascades here via a DELETE in db/account.ts (owner_id match).

CREATE TABLE api_tokens (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  name         TEXT,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at   INTEGER NOT NULL,
  revoked      INTEGER NOT NULL DEFAULT 0
);

-- owner_id index serves the management list + the per-owner live-count cap.
-- token_hash is already indexed by its UNIQUE constraint (the auth lookup).
CREATE INDEX api_tokens_owner_idx ON api_tokens (owner_id);

-- migration: 0028_diagram_source.sql
-- Diagram provenance (docs/specs/013-workspace/folders.md "Generated" dynamic folder, docs/specs/015-api/mcp-server.md): a
-- nullable source tag recording how a diagram came to exist. NULL = made
-- by a person in the editor (every pre-existing row); 'mcp' = created by
-- an external AI tool through the MCP server; 'ai' = created by the
-- in-editor AI assistant (reserved — no producer today). The Explorer
-- surfaces a synthetic "Generated" folder over the rows where source IS
-- NOT NULL, and keeps them out of Unsorted. Set once on create and never
-- rewritten by the metadata upsert, so an autosave can't clear it.
ALTER TABLE diagrams ADD COLUMN source TEXT NULL;
CREATE INDEX diagrams_source_idx ON diagrams(source);

-- migration: 0029_email_lifecycle.sql
-- docs/specs/014-identity/transactional-email.md: transactional & lifecycle email (Resend).
-- One row per AUTHENTICATED owner (Clerk user id), created on the first
-- request we see them when email is enabled. Drives the welcome + the
-- week-1 / week-2 onboarding series (the *_sent_at stamps make each send
-- idempotent). Rows are removed by deleteAccount (db/account.ts).
CREATE TABLE IF NOT EXISTS email_lifecycle (
  owner_id        TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  welcome_sent_at INTEGER,
  week1_sent_at   INTEGER,
  week2_sent_at   INTEGER
);

-- The cron series-sender scans by age, so index the timestamp it filters on.
CREATE INDEX IF NOT EXISTS idx_email_lifecycle_due ON email_lifecycle (created_at);

-- migration: 0030_api_token_expiry_warned.sql
-- docs/specs/014-identity/transactional-email.md (#3): track that we've sent the "your API token expires soon" email
-- for a token, so the daily cron warns once (7 days out) and never repeats.
-- NULL = not yet warned. Cleared implicitly when the token row is deleted
-- (account deletion / revoke-and-recreate gets a fresh row).
ALTER TABLE api_tokens ADD COLUMN expiry_warned_at INTEGER;

-- migration: 0031_email_activation.sql
-- docs/specs/014-identity/transactional-email.md (#4): track the one-time activation nudge ("you signed up but haven't
-- drawn anything yet") so it fires at most once per user. NULL = not yet sent.
-- Lives on email_lifecycle alongside the welcome / week-1 / week-2 stamps.
ALTER TABLE email_lifecycle ADD COLUMN activation_sent_at INTEGER;

-- migration: 0032_email_winback.sql
-- docs/specs/014-identity/transactional-email.md (#5): track the one-time win-back ("you've been away for a while")
-- email so it fires at most once per quiet user. NULL = not yet sent.
ALTER TABLE email_lifecycle ADD COLUMN winback_sent_at INTEGER;

-- migration: 0033_email_milestone.sql
-- docs/specs/014-identity/transactional-email.md (#6): track the one-time diagram-count milestone email so it fires
-- once per owner (the first milestone they reach). NULL = not yet sent.
ALTER TABLE email_lifecycle ADD COLUMN milestone_sent_at INTEGER;

-- migration: 0034_email_first_share.sql
-- docs/specs/014-identity/transactional-email.md (#6): track the one-time "first shared link" milestone email so it
-- fires once per owner. NULL = not yet sent.
ALTER TABLE email_lifecycle ADD COLUMN first_share_sent_at INTEGER;

-- migration: 0035_diagram_comment_notified.sql
-- docs/specs/014-identity/transactional-email.md (#1): throttle the immediate "new comment" email to at most one per
-- diagram per ~15 min, so a burst of comments doesn't spam the owner. Stores the
-- last time we emailed about a comment on this diagram. NULL = never.
ALTER TABLE diagrams ADD COLUMN comment_notified_at INTEGER;

-- migration: 0036_diagram_thumbnail.sql
-- docs/specs/006-document/document-snapshots.md: freshness marker for a diagram's cached SVG snapshot. The
-- snapshot bytes live in R2 (key `thumb/<diagramId>`); this column
-- records when they were last rendered so the render-on-read path can
-- tell a stale snapshot (saved_at > thumb_rendered_at) it must
-- re-render from a fresh one it can stream straight from R2. NULL =
-- never rendered. No backfill: the first read of each diagram renders +
-- caches lazily.
ALTER TABLE diagrams ADD COLUMN thumb_rendered_at INTEGER;

-- migration: 0037_ws_tickets.sql
-- One-time WebSocket room tickets (docs/specs/015-api/api.md "Realtime model"). Browsers
-- can't put auth headers on a WS upgrade, so the client first asks the
-- authenticated REST endpoint (POST /api/diagrams/:id/room-ticket) for a
-- short-lived single-use ticket carrying the server-resolved role, then
-- presents it as `?t=` on the upgrade. Closes the hole where a team
-- diagram's upgrade granted edit to any unverified `?o=<member-id>`
-- (member ids are visible to every teammate, so a removed member could
-- keep joining the room).
CREATE TABLE ws_tickets (
  ticket TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- migration: 0038_change_log_created_idx.sql
-- The daily change-log retention sweep deletes by created_at alone
-- (deleteOldChangeLogEntries: DELETE FROM change_log WHERE created_at < ?),
-- but the only index covering created_at was the composite
-- (tab_id, created_at) from 0012/0013 — useless for a leading
-- created_at predicate, so the sweep full-scanned the table once a day.
CREATE INDEX change_log_created_idx ON change_log (created_at);

-- migration: 0039_api_token_read_only.sql
-- Read-only API tokens (docs/specs/015-api/public-api-and-tokens.md §3.4 + docs/specs/015-api/mcp-server.md §4.11). A token minted with
-- read_only = 1 may only make GET/HEAD requests; the api rejects every write
-- (POST/PUT/DELETE) it presents. The MCP OAuth consent screen offers this so a
-- cautious user can let an AI tool VIEW their diagrams without granting edit.
-- Default 0 keeps every existing token full read+write.
ALTER TABLE api_tokens ADD COLUMN read_only INTEGER NOT NULL DEFAULT 0;

-- migration: 0040_favourites.sql
-- Per-user diagram favourites (docs/specs/013-workspace/favourites.md).
--
-- Each row says "owner OWNER_ID starred diagram DIAGRAM_ID at CREATED_AT".
-- Primary key on (owner_id, diagram_id) makes starring idempotent.
--
-- A TABLE rather than a flag on `diagrams`, because favouriting is
-- PER-USER: starring a diagram in a shared team folder must not star it
-- for the rest of the team. It's also a table rather than a key in the
-- user_preferences blob (which is how docs/specs/013-workspace/hide-from-recent.md stores hidden-from-Recent
-- ids) because that blob is capped at 4 KB server-side — roughly 100
-- 36-char UUIDs — and favourites are meant to be unlimited. Blowing that
-- cap would start failing EVERY preference write, not just this one.
--
-- Cascades through diagrams: deleting a diagram drops everyone's star on
-- it for free, so the Favourites view can never list a dead id.
CREATE TABLE favourites (
  owner_id TEXT NOT NULL,
  diagram_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, diagram_id),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

-- The only read pattern: "every diagram this owner starred".
CREATE INDEX idx_favourites_owner ON favourites(owner_id);

-- migration: 0041_diagram_presentation.sql
-- Slide decks (docs/specs/012-collaboration/presentation-mode.md): the presentation built over a diagram.
--
-- Diagram-level rather than per-tab, because a slide belongs to ONE tab but
-- the DECK does not: its order interleaves tabs freely (A, C, A), so no single
-- tab can own the list. Tab bodies (0005) could not carry it.
--
-- A JSON blob for the same reason `diagrams.data` originally was (0001): every
-- read and write hits the whole thing anyway. A deck is tens of slides, each a
-- name, a tab id and a list of element ids, and there is no query that wants
-- rows — "which slides hold this element" is a filter over a small in-memory
-- array, not a join.
--
-- Slides store element REFERENCES, never element copies, which is what keeps a
-- deck in step with the diagram it presents. Nothing in here is content: if
-- every diagram lost this column tomorrow, no diagram would lose any work.
--
-- NULL = no deck, which is every pre-existing row.
ALTER TABLE diagrams ADD COLUMN presentation TEXT NULL;

-- migration: 0042_timeline.sql
-- Timeline (docs/specs/013-workspace/timeline.md) — the Explorer's landing feed.
--
-- Two tables plus a per-scope state row. The split matters: an event
-- row holds WHAT happened once, and the scopes table holds WHO should
-- see it. A comment on a diagram in a twelve-person team library is one
-- `timeline_events` row and twelve `timeline_event_scopes` rows, not
-- twelve copies of the comment text.
--
-- Deliberately NOT a view over existing tables. Comments and assigned
-- actions live inside element JSON in `tabs` (packages/diagram), so
-- there is nothing to index or sort without parsing every tab; and the
-- events we care about (a member joined, an invite arrived) have no
-- durable row at all today. Every event is written at the moment it
-- happens, by the api worker, on the write path.

CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  -- Owner id of whoever did the thing: a Clerk `sub`, or a guest
  -- participant id (docs/specs/014-identity/auth-and-guest-access.md hybrid identity). NULL for system events
  -- with no human actor, e.g. a token-expiry warning.
  actor_id TEXT,
  -- The domain object this is about. 'diagram' | 'team' | 'account'.
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  -- What happened to it. One source produces many event types over its
  -- life, which is why this is separate from source_type.
  event_type TEXT NOT NULL,
  -- '' for one-shot events (a diagram is created once). Carries
  -- '<actorId>:<YYYY-MM-DD>' for the coalesced editing event, which is
  -- the one event type that deliberately extends itself through a day
  -- rather than emitting per save (docs/specs/013-workspace/timeline.md §4.2).
  dedupe_key TEXT NOT NULL DEFAULT '',
  -- Title Case category, never user content ("Comment Added").
  title TEXT NOT NULL,
  -- Where user content goes (diagram names, comment text, people).
  description TEXT,
  -- Sort key, epoch ms. Integer rather than the ISO strings the shape
  -- was borrowed from: SQLite string-compares a TEXT column, and a
  -- mix of `datetime('now')` output, `toISOString()`, and date-only
  -- values does not sort. `change_log.created_at` is already epoch ms.
  occurred_at INTEGER NOT NULL,
  -- JSON extras the renderer needs, captured at emit time so drawing
  -- the feed never fans out into other tables.
  snapshot TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  -- Makes emission idempotent: a retried request, or a backfill
  -- covering ground a live emit already covered, updates this row
  -- instead of duplicating it.
  UNIQUE (source_type, source_id, event_type, dedupe_key)
);

-- The retention sweep's predicate (docs/specs/013-workspace/timeline.md §3.5).
CREATE INDEX timeline_events_occurred_idx ON timeline_events (occurred_at);

CREATE TABLE timeline_event_scopes (
  event_id TEXT NOT NULL REFERENCES timeline_events (id) ON DELETE CASCADE,
  -- v1 emits only 'user' (scope_id = an owner id). Free text with no
  -- CHECK on purpose: a later per-diagram or per-team feed is a new
  -- value here plus a renderer, not a migration.
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  -- Doubles as the read index: the feed query is a prefix scan on
  -- (scope_type, scope_id).
  PRIMARY KEY (scope_type, scope_id, event_id)
);

-- Cascade lookups when a source entity is deleted, and the guest ->
-- Clerk id migration on sign-up.
CREATE INDEX timeline_event_scopes_event_idx ON timeline_event_scopes (event_id);

CREATE TABLE timeline_scope_state (
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  -- NULL until the one-shot backfill has seeded this scope from the
  -- caller's existing diagrams + team memberships (docs/specs/013-workspace/timeline.md §5).
  backfilled_at INTEGER,
  last_refreshed_at INTEGER,
  PRIMARY KEY (scope_type, scope_id)
);

-- migration: 0043_timeline_last_seen.sql
-- Timeline unread marker (docs/specs/013-workspace/timeline.md §2.5).
--
-- `last_refreshed_at` was written by the Refresh button, which is gone:
-- the feed loads on mount and seeds itself off that same read, so a
-- manual refresh had nothing to do. The column is repurposed for the
-- question the feed actually needs to answer — "what has happened since
-- I was last here" — which is the whole premise of the surface and had
-- nothing tracking it.
--
-- A rename rather than a new column: the old value was a read timestamp
-- for the same scope by the same user, so it is a truthful (if
-- conservative) starting point for "last seen". Nobody loses a marker.

ALTER TABLE timeline_scope_state RENAME COLUMN last_refreshed_at TO last_seen_at;

-- migration: 0044_collab_index.sql
-- Collaboration index (docs/specs/013-workspace/inbox.md) — what the Inbox reads.
--
-- Assigned actions (docs/specs/012-collaboration/assigned-actions.md) and comment threads (docs/specs/008-canvas/canvas-and-palette.md) live INSIDE
-- element JSON in `tabs.data`, and that stays the source of truth: the
-- editor, the realtime room, undo grafting, and export all read them
-- from there. These two tables are a PROJECTION of that JSON that SQL
-- can filter ("open actions assigned to me, across every diagram"),
-- written in the same batch as the tab row so they can never drift
-- from the blob they mirror. docs/specs/012-collaboration/assigned-actions.md §9 named this as the follow-up
-- shape: a table added later without moving the source of truth.
--
-- Keyed by TAB, not diagram: a tab can belong to several diagrams
-- (docs/specs/006-document/tab-document-many-to-many.md), so the diagram is resolved at read time through
-- `diagram_tabs`. That is also what makes deletion free — a tab's rows
-- cascade with the tab, and a diagram's tabs cascade with the diagram.
--
-- One row per element per kind (at most one action and one thread per
-- element), so a save is a full replace of the tab's rows: two DELETEs
-- plus one INSERT per element that carries the thing. No diffing.

CREATE TABLE collab_actions (
  tab_id             TEXT    NOT NULL,
  element_id         TEXT    NOT NULL,
  action_id          TEXT    NOT NULL,
  -- The element's list name (label / first table cell / "Untitled"),
  -- so the row can say WHERE the action is without parsing the tab.
  element_label      TEXT    NOT NULL,
  name               TEXT    NOT NULL,
  description        TEXT    NOT NULL,
  status             TEXT    NOT NULL,            -- 'open' | 'done'
  -- Clerk user id, a guest participant id for a signed-out
  -- self-assignment, or NULL for an invited member not yet identified
  -- with an account (their membership row id is the key then).
  assignee_user_id   TEXT,
  assignee_member_id TEXT,
  assignee_name      TEXT,
  assigner_id        TEXT    NOT NULL,
  assigner_name      TEXT,
  team_id            TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  PRIMARY KEY (tab_id, element_id),
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

-- The three involvement lookups the read applies AFTER scoping to the
-- reader's own library (docs/specs/013-workspace/inbox.md §4).
CREATE INDEX collab_actions_assignee_idx ON collab_actions (assignee_user_id, status);
CREATE INDEX collab_actions_assigner_idx ON collab_actions (assigner_id, status);
CREATE INDEX collab_actions_member_idx   ON collab_actions (assignee_member_id);

CREATE TABLE collab_threads (
  tab_id              TEXT    NOT NULL,
  element_id          TEXT    NOT NULL,
  element_label       TEXT    NOT NULL,
  resolved            INTEGER NOT NULL,           -- 0 | 1
  comment_count       INTEGER NOT NULL,
  -- JSON array of the distinct comment author ids (server-stamped
  -- `authorId`s), queried with json_each. Not indexable and not needing
  -- to be: the read is bounded by the reader's library first.
  participant_ids     TEXT    NOT NULL,
  -- What the row shows: the newest comment. Every other comment stays
  -- in the blob; no email address ever lands here (docs/specs/012-collaboration/assigned-actions.md §1).
  latest_text         TEXT    NOT NULL,
  latest_author_name  TEXT    NOT NULL,
  latest_author_color TEXT    NOT NULL,
  first_at            INTEGER NOT NULL,
  latest_at           INTEGER NOT NULL,
  PRIMARY KEY (tab_id, element_id),
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

CREATE INDEX collab_threads_open_idx ON collab_threads (resolved, latest_at);

-- Identities an owner USED TO BE (docs/specs/013-workspace/inbox.md §2.2). Comment author ids and
-- self-assigned assignee ids are written with whatever identity the
-- writer had at the time — a guest participant id for anyone signed out
-- — and the blobs are not rewritten when that guest signs up. Instead
-- each /api/migrate flow records the old id here, and the Activity read
-- matches `me ∪ aliases(me)` wherever it compares an identity.
CREATE TABLE owner_aliases (
  owner_id   TEXT    NOT NULL,
  alias_id   TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, alias_id)
);

CREATE INDEX owner_aliases_alias_idx ON owner_aliases (alias_id);

-- One row per owner once the index has been seeded from their existing
-- tabs (docs/specs/013-workspace/inbox.md §2.3). Tabs saved after this migration index
-- themselves; this is for the dormant ones.
CREATE TABLE collab_index_state (
  owner_id      TEXT    PRIMARY KEY,
  backfilled_at INTEGER NOT NULL
);

-- migration: 0045_timeline_dismissal.sql
-- Per-entry dismissal on the Timeline (docs/specs/013-workspace/timeline.md §2.9).
--
-- A reader can take one card off THEIR feed from its ⋯ menu. The event
-- row is shared by everybody it was scoped to (one comment, N
-- memberships), so the dismissal lives on the membership row, not the
-- event: a teammate removing a card from their feed leaves it on yours.
--
-- Soft, not a row delete, on purpose. `attachEventToScopes` is INSERT OR
-- IGNORE against the composite key, so a dismissed membership survives a
-- re-emit; deleting the row instead would let the coalesced editing event
-- (which upserts and re-attaches on every save) resurrect a card the
-- reader had just removed.

ALTER TABLE timeline_event_scopes ADD COLUMN deleted_at INTEGER;

-- migration: 0046_timeline_no_diagram_tombstones.sql
-- A deleted diagram leaves no trace on the Timeline (docs/specs/013-workspace/timeline.md §3.5).
--
-- The "Diagram Deleted" card was dropped: from the feed's point of view a
-- deleted diagram never existed, so the rows already written are swept
-- along with it. Their membership rows go via ON DELETE CASCADE.

DELETE FROM timeline_events WHERE event_type = 'diagram_deleted';

-- migration: 0047_auth_sightings.sql
-- Server-side sign-up / sign-in counting (docs/specs/017-telemetry/telemetry.md, Session).
--
-- Session·SignedUp and Session·SignedIn used to be emitted by the browser on
-- the email-code paths only, so a Google sign-up or sign-in (the OAuth
-- redirect through /sso-callback) was never counted. The api worker now
-- decides both from the first time it sees a verified Clerk session:
--
--   auth_sessions  one row per Clerk session id (`sid`) ever seen. A new sid
--                  is a completed sign-in or sign-up, whatever the method.
--                  Holds no owner id, so it is not personal data; swept after
--                  90 days by the daily cron.
--   auth_accounts  one row per Clerk account ever seen. A new sid whose
--                  account is ALSO new is a sign-up (counted as SignedUp
--                  only, never also as SignedIn). Removed by deleteAccount.

CREATE TABLE auth_sessions (
  session_id    TEXT PRIMARY KEY NOT NULL,
  first_seen_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_seen_idx ON auth_sessions (first_seen_at);

CREATE TABLE auth_accounts (
  owner_id      TEXT PRIMARY KEY NOT NULL,
  first_seen_at INTEGER NOT NULL
);

-- Backfill every Clerk account the database already knows about, so an
-- existing user's first request after this ships is not read as a sign-up.
-- Clerk user ids are `user_<...>`; guests are UUIDs and never match. Accounts
-- missed here (no row anywhere) are also covered at runtime: a session whose
-- first factor was verified over an hour ago counts as neither event.
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT owner_id, created_at FROM email_lifecycle;
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM diagrams WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM folders WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM user_preferences WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM shared_with WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT owner_id, 0 FROM api_tokens WHERE owner_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT user_id, 0 FROM team_members WHERE user_id LIKE 'user\_%' ESCAPE '\';
INSERT OR IGNORE INTO auth_accounts (owner_id, first_seen_at)
  SELECT DISTINCT id, 0 FROM participants WHERE id LIKE 'user\_%' ESCAPE '\';

-- migration: 0048_tab_scoped_share_links.sql
-- Tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md). A link scoped to one
-- tab opens only that tab; NULL = All tabs, which is what every existing
-- link is. shared_with records the scope the visitor was last granted, so
-- the Shared list and Activity never hand back a broader code.

ALTER TABLE share_links ADD COLUMN tab_id TEXT NULL;
ALTER TABLE shared_with ADD COLUMN tab_id TEXT NULL;

-- A room ticket carries the scope and the code that granted it from the mint
-- to the upgrade, so the room confines the session and can close it when
-- that code is revoked or rescoped.
ALTER TABLE ws_tickets ADD COLUMN tab_scope TEXT NULL;
ALTER TABLE ws_tickets ADD COLUMN share_code TEXT NULL;

-- migration: 0049_tabs_drop_legacy_columns.sql
-- Drop tabs.diagram_id + tabs.order_index (docs/specs/006-document/tab-document-many-to-many.md,
-- phase 5). Every read has gone through diagram_tabs since 0011, and the
-- diagram_id FK's ON DELETE CASCADE was a trap: deleting the diagram a tab
-- was born in destroyed the tab in every other diagram it was linked into.
--
-- SQLite can't DROP COLUMN a foreign-key column, so this is the table
-- rebuild of 0012 / 0013 with one difference that matters: `tabs` is a
-- PARENT table. With foreign keys on (D1 always has them on, and
-- defer_foreign_keys does not stop actions), DROP TABLE tabs runs an
-- implicit DELETE that cascades into diagram_tabs, change_log,
-- collab_actions and collab_threads. So every child row is parked first
-- and handed back once the new `tabs` stands under the old name.
--
-- The children's FK clauses name `tabs` as text, so they bind to the
-- rebuilt table unchanged. Tabs no diagram links are carried over as they
-- are. A child row pointing at a missing tab fails the restore's FK check,
-- which aborts the migration and halts the deploy before any worker moves.

CREATE TABLE keep_diagram_tabs AS SELECT * FROM diagram_tabs;
CREATE TABLE keep_change_log AS SELECT * FROM change_log;
CREATE TABLE keep_collab_actions AS SELECT * FROM collab_actions;
CREATE TABLE keep_collab_threads AS SELECT * FROM collab_threads;

DROP INDEX IF EXISTS tabs_diagram_idx;

CREATE TABLE tabs_new (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  -- The live app's Tab minus { id, name }: elements + per-tab settings.
  data        TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL
);

INSERT INTO tabs_new (id, name, data, updated_at)
SELECT id, name, data, updated_at FROM tabs;

DROP TABLE tabs;
ALTER TABLE tabs_new RENAME TO tabs;

-- The cascade emptied what referenced a tab; change_log rows with no tab
-- survived it, so clear each child before handing its rows back.
DELETE FROM diagram_tabs;
INSERT INTO diagram_tabs SELECT * FROM keep_diagram_tabs;
DELETE FROM change_log;
INSERT INTO change_log SELECT * FROM keep_change_log;
DELETE FROM collab_actions;
INSERT INTO collab_actions SELECT * FROM keep_collab_actions;
DELETE FROM collab_threads;
INSERT INTO collab_threads SELECT * FROM keep_collab_threads;

DROP TABLE keep_diagram_tabs;
DROP TABLE keep_change_log;
DROP TABLE keep_collab_actions;
DROP TABLE keep_collab_threads;

-- migration: 0050_image_refs.sql
-- Image reference index (docs/specs/009-elements/images.md, "Reference index").
--
-- Which gallery images a tab places lives in `tabs.data`, and that stays the
-- source of truth. This is a projection of it that SQL can query without
-- reading tab bodies: the retention sweep, the usage map and share-visitor
-- image reads all read it. Every write of `tabs.data` maintains it in the
-- same batch.
--
-- Deliberately no foreign keys. A cascade from `tabs` would empty the index
-- whenever a migration rebuilds `tabs` with DROP TABLE (0049 did exactly that
-- to its FK children), and an empty index reads as "nothing is referenced".
-- A row whose tab is gone is harmless instead: every reader joins `tabs` or
-- `diagram_tabs`, and the delete paths prune them.

CREATE TABLE image_refs (
  tab_id   TEXT NOT NULL,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;

-- The sweep and the share read look up by image.
CREATE INDEX image_refs_image_idx ON image_refs (image_id);

-- One row: progress of indexing the tabs saved before this migration. The
-- daily cron advances it in rowid pages; nothing reads the index as complete
-- until `completed_at` is set. A database with no tabs yet starts complete.
CREATE TABLE image_refs_backfill (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  created_at   INTEGER NOT NULL,
  cursor       INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);

INSERT INTO image_refs_backfill (id, created_at, cursor, completed_at)
SELECT 1,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000,
       0,
       CASE WHEN EXISTS (SELECT 1 FROM tabs) THEN NULL
            ELSE CAST(strftime('%s', 'now') AS INTEGER) * 1000 END;

-- migration: 0051_diagram_trash.sql
-- Trash (docs/specs/013-workspace/trash.md): deleting a diagram stamps the
-- time here instead of removing the row; the daily cron purges a row 30 days
-- after. NULL = live.
--
-- A column rather than a separate table: every child row (tabs through
-- diagram_tabs, share links, stars, history) keeps pointing at the diagram
-- it belongs to, so a restore is clearing one value.
--
-- 0050 is taken by the image reference index (feat/image-refs); the two
-- are independent and apply in either order.

ALTER TABLE diagrams ADD COLUMN trashed_at INTEGER NULL;

-- Partial: the live rows (nearly all of them) stay out of it. Serves the
-- purge sweep ("trashed before X, oldest first") and bounds the Trash list.
CREATE INDEX diagrams_trashed_idx ON diagrams (trashed_at) WHERE trashed_at IS NOT NULL;

-- migration: 0052_collab_thread_mentions.sql
-- Comment mentions (docs/specs/012-collaboration/comment-mentions.md): the thread index records who a thread
-- @-tags, so the Inbox (docs/specs/013-workspace/inbox.md) can list it for them even when they
-- never commented. A JSON array of user ids and team member ids, like
-- participant_ids beside it. Existing rows predate mentions, so '[]' is their
-- true value and no backfill is needed.

ALTER TABLE collab_threads ADD COLUMN mentioned_ids TEXT NOT NULL DEFAULT '[]';

-- migration: 0053_collab_actions_per_action.sql
-- An Action panel holds many actions (docs/specs/012-collaboration/action-panel.md "The data"), so the
-- Activity index (docs/specs/013-workspace/inbox.md §2) keeps one row per ACTION rather than one per
-- element. SQLite cannot change a primary key in place: rebuild the table with
-- (tab_id, element_id, action_id) as the key, copy every row across (each
-- element had at most one action, so nothing collides), and recreate the
-- three read indexes.

CREATE TABLE collab_actions_next (
  tab_id             TEXT    NOT NULL,
  element_id         TEXT    NOT NULL,
  action_id          TEXT    NOT NULL,
  element_label      TEXT    NOT NULL,
  name               TEXT    NOT NULL,
  description        TEXT    NOT NULL,
  status             TEXT    NOT NULL,
  assignee_user_id   TEXT,
  assignee_member_id TEXT,
  assignee_name      TEXT,
  assigner_id        TEXT    NOT NULL,
  assigner_name      TEXT,
  team_id            TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  PRIMARY KEY (tab_id, element_id, action_id),
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

INSERT INTO collab_actions_next
  (tab_id, element_id, action_id, element_label, name, description, status,
   assignee_user_id, assignee_member_id, assignee_name, assigner_id, assigner_name,
   team_id, created_at, updated_at)
SELECT tab_id, element_id, action_id, element_label, name, description, status,
       assignee_user_id, assignee_member_id, assignee_name, assigner_id, assigner_name,
       team_id, created_at, updated_at
  FROM collab_actions;

DROP TABLE collab_actions;
ALTER TABLE collab_actions_next RENAME TO collab_actions;

CREATE INDEX collab_actions_assignee_idx ON collab_actions (assignee_user_id, status);
CREATE INDEX collab_actions_assigner_idx ON collab_actions (assigner_id, status);
CREATE INDEX collab_actions_member_idx   ON collab_actions (assignee_member_id);

-- migration: 0055_documents.sql
-- The container is a document (docs/specs/006-document/document.md): rename the schema and
-- every stored value that names it. SQLite's RENAME carries the foreign keys of
-- share_links, shared_with, document_tabs and favourites along; indexes are recreated
-- under their new names.

ALTER TABLE diagrams RENAME TO documents;
ALTER TABLE diagram_tabs RENAME TO document_tabs;
ALTER TABLE document_tabs RENAME COLUMN diagram_id TO document_id;
ALTER TABLE favourites RENAME COLUMN diagram_id TO document_id;
ALTER TABLE share_links RENAME COLUMN diagram_id TO document_id;
ALTER TABLE shared_with RENAME COLUMN diagram_id TO document_id;
ALTER TABLE ws_tickets RENAME COLUMN diagram_id TO document_id;

DROP INDEX idx_diagrams_owner_recent;
CREATE INDEX idx_documents_owner_recent ON documents (owner_id, saved_at DESC);
DROP INDEX diagrams_folder_idx;
CREATE INDEX documents_folder_idx ON documents (folder_id);
DROP INDEX diagrams_team_idx;
CREATE INDEX documents_team_idx ON documents (team_id);
DROP INDEX diagrams_source_idx;
CREATE INDEX documents_source_idx ON documents (source);
DROP INDEX diagrams_trashed_idx;
CREATE INDEX documents_trashed_idx ON documents (trashed_at) WHERE trashed_at IS NOT NULL;
DROP INDEX diagram_tabs_by_diagram;
CREATE INDEX document_tabs_by_document ON document_tabs (document_id, order_index);
DROP INDEX diagram_tabs_by_tab;
CREATE INDEX document_tabs_by_tab ON document_tabs (tab_id);
DROP INDEX idx_share_links_diagram_created;
CREATE INDEX idx_share_links_document_created ON share_links (document_id, created_at);
DROP INDEX idx_share_links_diagram_role_created;
CREATE INDEX idx_share_links_document_role_created ON share_links (document_id, role, created_at);

-- Stored values that name the container.

-- Timeline: source, scope and event types, the titles written with each event, and the
-- snapshot keys the cards read.
UPDATE timeline_events SET source_type = 'document' WHERE source_type = 'diagram';
UPDATE timeline_events SET event_type = 'document' || substr(event_type, 8)
  WHERE event_type LIKE 'diagram\_%' ESCAPE '\';
UPDATE timeline_events SET event_type = 'team_document' || substr(event_type, 13)
  WHERE event_type LIKE 'team\_diagram\_%' ESCAPE '\';
UPDATE timeline_events SET title = 'Document Created' WHERE title = 'Diagram Created';
UPDATE timeline_events SET title = 'Document Duplicated' WHERE title = 'Diagram Duplicated';
UPDATE timeline_events SET title = 'Document Updated' WHERE title = 'Diagram Updated';
UPDATE timeline_events
  SET snapshot = replace(replace(snapshot, '"diagramId":', '"documentId":'), '"diagramName":', '"documentName":')
  WHERE snapshot LIKE '%"diagramId":%' OR snapshot LIKE '%"diagramName":%';
UPDATE timeline_event_scopes SET scope_type = 'document' WHERE scope_type = 'diagram';
UPDATE timeline_scope_state SET scope_type = 'document' WHERE scope_type = 'diagram';

-- Element links to another document, inside tab bodies and change-log states. A link is
-- written as {"kind":"diagram","diagramId":…}; the tab's own "kind":"diagram" is the tab kind
-- and never has a diagramId beside it, so it is left alone.
UPDATE tabs SET data = replace(data, '"kind":"diagram","diagramId":', '"kind":"document","documentId":')
  WHERE data LIKE '%"diagramId":%';
UPDATE change_log
  SET before_state = replace(before_state, '"kind":"diagram","diagramId":', '"kind":"document","documentId":'),
      after_state = replace(after_state, '"kind":"diagram","diagramId":', '"kind":"document","documentId":')
  WHERE before_state LIKE '%"diagramId":%' OR after_state LIKE '%"diagramId":%';

-- The notification opt-out: a lost `false` would start sending emails someone turned off.
UPDATE user_preferences
  SET prefs = replace(prefs, '"notifyDiagramJoin":', '"notifyDocumentJoin":')
  WHERE prefs LIKE '%"notifyDiagramJoin":%' AND prefs NOT LIKE '%"notifyDocumentJoin":%';

-- Telemetry history, so the public dashboard's lines continue under the new names.
UPDATE events SET category = 'Document' WHERE category = 'Diagram';
UPDATE events SET type = 'Document'
  WHERE type = 'Diagram' AND ((category = 'Team' AND action IN ('Added', 'Moved', 'Removed'))
    OR (category = 'Element' AND action = 'Linked'));
UPDATE events SET type = 'DocumentToTeam' WHERE category = 'Action' AND action = 'Moved' AND type = 'DiagramToTeam';
UPDATE events SET type = 'DocumentJoined' WHERE category = 'Email' AND action = 'Sent' AND type = 'DiagramJoined';
UPDATE events SET type = 'NotifyDocumentJoinOn' WHERE category = 'UI' AND type = 'NotifyDiagramJoinOn';
UPDATE events SET type = 'NotifyDocumentJoinOff' WHERE category = 'UI' AND type = 'NotifyDiagramJoinOff';
UPDATE events SET type = '/document' WHERE category = 'Page' AND action = 'View' AND type = '/diagram';
UPDATE events SET type = replace(replace(type, 'Diagrams', 'Documents'), 'Diagram', 'Document')
  WHERE category = 'Mcp' AND action = 'Used' AND type LIKE '%Diagram%';
UPDATE events
  SET type = replace(replace(replace(replace(type, '.Diagrams.', '.Documents.'), '.Diagram.', '.Document.'), 'DiagramMeta', 'DocumentMeta'), 'Diagram', 'Document')
  WHERE category = 'Error' AND type LIKE '%Diagram%';

-- Help articles about the container moved with it (docs/specs/018-help/help-app.md, "Renamed
-- articles"): their views, votes and page views continue under the new slug.
UPDATE events SET type = CASE type
    WHEN 'add-to-diagram' THEN 'add-to-document'
    WHEN 'diagram-not-loading' THEN 'document-not-loading'
    WHEN 'team-shared-diagrams' THEN 'team-shared-documents'
    WHEN 'search-diagrams' THEN 'search-documents'
    WHEN 'sharing-your-diagram' THEN 'sharing-your-document'
    WHEN 'working-with-diagrams' THEN 'working-with-documents'
  END
  WHERE category = 'Help' AND type IN ('add-to-diagram', 'diagram-not-loading', 'team-shared-diagrams',
    'search-diagrams', 'sharing-your-diagram', 'working-with-diagrams');
UPDATE events
  SET type = replace(replace(replace(replace(replace(replace(type,
    '/add-to-diagram', '/add-to-document'),
    '/diagram-not-loading', '/document-not-loading'),
    '/team-shared-diagrams', '/team-shared-documents'),
    '/search-diagrams', '/search-documents'),
    '/sharing-your-diagram', '/sharing-your-document'),
    '/working-with-diagrams', '/working-with-documents')
  WHERE category = 'Page' AND action = 'View' AND (type LIKE '%/add-to-diagram%' OR type LIKE '%/diagram-not-loading%'
    OR type LIKE '%/team-shared-diagrams%' OR type LIKE '%/search-diagrams%' OR type LIKE '%/sharing-your-diagram%'
    OR type LIKE '%/working-with-diagrams%');

-- migration: 0056_document_trash_reason.sql
-- Empty document clean-up (docs/specs/013-workspace/empty-document-cleanup.md):
-- why a document is in the Trash. NULL = a person deleted it; 'empty' = the
-- daily sweep moved it after 30 days with nothing on any tab. Cleared on
-- restore, so a live row is always NULL.
--
-- No backfill: every row already in the Trash was deleted by a person. No
-- index: nothing filters on it. The daily sweep scans live rows (no index
-- orders them by saved_at, and one would cost every autosave a write to save
-- a once-a-day ~10 ms scan).

ALTER TABLE documents ADD COLUMN trash_reason TEXT NULL;

-- migration: 0057_drive_mirror.sql
-- Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md, "Data";
-- blueprint docs/specs/022-drive-mirror/blueprints/drive-mirror.md).
--
-- drive_connections: one row per signed-in user who connected Drive. The
-- refresh token is AES-GCM sealed under DRIVE_TOKEN_KEY before it lands here
-- and is never read back out by any route; it is NULL for a browser-only
-- connection (a deployment with a client id but no secret). The lease columns
-- keep two devices from writing the mirror at once.
CREATE TABLE drive_connections (
  owner_id TEXT PRIMARY KEY,
  refresh_token_enc TEXT,
  root_folder_id TEXT,
  page_token TEXT,
  page_token_saved_at INTEGER,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reconnect')),
  connected_at INTEGER NOT NULL,
  lease_holder TEXT,
  lease_expires_at INTEGER
);

-- drive_items: one row per mirrored document or folder, holding the Drive state
-- livediagram last wrote (or accepted), so a change read back from Drive is
-- recognised as an echo of our own write. Removed with the document (in
-- documentRemovalStatements), the folder (deleteFolder) or the account.
CREATE TABLE drive_items (
  owner_id TEXT NOT NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('document', 'folder')),
  ld_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ld_name TEXT NOT NULL,
  parent_id TEXT,
  trashed INTEGER NOT NULL DEFAULT 0,
  md5 TEXT,
  head_revision_id TEXT,
  mirrored_saved_at INTEGER,
  notice TEXT CHECK (notice IS NULL OR notice = 'unseen_folder'),
  notice_parent_id TEXT,
  PRIMARY KEY (owner_id, item_kind, ld_id),
  UNIQUE (owner_id, drive_file_id)
);

-- The removal paths delete by (item_kind, ld_id) across owners.
CREATE INDEX drive_items_ld_idx ON drive_items (item_kind, ld_id);

-- migration: 0058_profile_pictures.sql
-- Profile pictures for collaborators (docs/specs/014-identity/profile-picture.md §6).
--
-- participants.picture_url: the participant's published picture, a Clerk image URL (never bytes).
-- Set only by the participant's own verified Clerk session through
-- PUT /api/participants/<id>/picture, null for guests, when the switch is off, and until the
-- first write. Deleted with the participant row on account deletion.
ALTER TABLE participants ADD COLUMN picture_url TEXT NULL;

-- ws_tickets.account: 1 when the ticket was minted by a verified Clerk session, so the realtime
-- room knows which sessions may publish a picture and which may receive one.
ALTER TABLE ws_tickets ADD COLUMN account INTEGER NOT NULL DEFAULT 0;

-- migration: 0059_tab_element_count.sql
-- Which documents are empty, without reading a tab body (docs/specs/006-document/document-snapshots.md,
-- "An empty document is never asked for").
--
-- tabs.element_count: how many elements the tab's `data` holds, or null when unknown. Every tab write binds
-- it from the tab the api already holds. Existing tabs start unknown (null reads as not empty, so their
-- thumbnail is still asked for) and are filled in lazily, by their next write or by the thumbnail route
-- once it has parsed them: no statement here reads a body, so this migration is constant-time however
-- large the table is.
ALTER TABLE tabs ADD COLUMN element_count INTEGER NULL;

-- migration: 0060_shape_libraries.sql
-- Shape libraries, per docs/specs/013-workspace/shape-libraries.md.
--
-- Owner-scoped (Clerk sub or the X-Owner-Id guest id, like custom_themes),
-- guests included. `items` is the JSON array of library items as the api
-- validated them (validateShapeLibraryItems), within the tab byte budget.
-- The (owner_id, created_at) index serves the newest-first list and the
-- per-owner count. 0059 is taken by an open pull request; if the merge
-- order changes, this file takes the next free number.

CREATE TABLE shape_libraries (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  source      TEXT NOT NULL,
  items       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX shape_libraries_owner_created_idx ON shape_libraries (owner_id, created_at DESC);

-- migration: 0061_draw_telemetry.sql
-- Draw mode's events are the Draw category (docs/specs/007-editor/editor-modes.md "Telemetry"):
-- the category was named Whiteboard while whiteboarding was a tab kind. The stored history moves
-- with it, so the public dashboard's lines continue under the new name.
UPDATE events SET category = 'Draw' WHERE category = 'Whiteboard';

-- migration: 0061_placement_defaults.sql
-- Default folders, per docs/specs/013-workspace/default-folders.md.
--
-- One row per person and default key (`mode:diagram`, `mode:draw`): the folder
-- that person's new documents of that key land in when no place is chosen.
-- Owner-scoped (Clerk sub or the X-Owner-Id guest id), guests included.
--
-- `folder_id` deliberately has no foreign key and no ON DELETE: a default whose
-- folder is gone is skipped when used and kept, so a restore that recreates
-- the same folder id revives it. The primary key's owner_id prefix serves the
-- only read, "this person's defaults".

CREATE TABLE placement_defaults (
  owner_id    TEXT NOT NULL,
  default_key TEXT NOT NULL,
  folder_id   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (owner_id, default_key)
);

-- migration: 0062_document_creation_intent.sql
-- The recorded creation intent, per docs/specs/013-workspace/default-folders.md "Recorded intent".
--
-- Written by the insert that creates a document and never rewritten: `opens_in` is the editor mode
-- its first tab opens in, `tab_kind` that tab's kind at creation (the general `diagram` tab, or a
-- specific kind such as `event-storming`), `template_family` the family of the template it was made
-- from (`retrospective`, `kanban`) when it has one. All nullable with no default and no backfill: a
-- NULL `opens_in` is unknown (a row from before intents were recorded, or a create that carried
-- none), never Diagram, and the other two are then unknown too. `tab_kind` is a column of its own
-- because nothing else records the first tab's kind at creation: tabs are reordered, removed and
-- shared after it. They feed the Explorer's Opens in and Board chips.

ALTER TABLE documents ADD COLUMN opens_in TEXT;
ALTER TABLE documents ADD COLUMN tab_kind TEXT;
ALTER TABLE documents ADD COLUMN template_family TEXT;

-- migration: 0063_document_opens.sql
-- Explorer Home's opens, per docs/specs/013-workspace/explorer-home.md "Opens" and its blueprint
-- (docs/specs/013-workspace/blueprints/explorer-home.md "Data and persistence").
--
-- One row per person per document they have opened: how many UTC days they opened it on, and the
-- frecency key Jump back in ranks by (the instant the decayed open score falls to one, so the rank
-- index answers in order with no arithmetic). Owner-keyed like favourites: guests included, moved
-- on sign-up, deleted with the account. A purged document takes everyone's rows with it.
-- 0061 and 0062 are taken by open branches; if the merge order changes, this file takes the next
-- free number.

CREATE TABLE document_opens (
  owner_id        TEXT NOT NULL,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  open_days       INTEGER NOT NULL,
  first_opened_at INTEGER NOT NULL,
  last_opened_at  INTEGER NOT NULL,
  last_open_day   TEXT NOT NULL,
  frecency_key    INTEGER NOT NULL,
  PRIMARY KEY (owner_id, document_id)
);

-- Jump back in: one person's rows, strongest first.
CREATE INDEX document_opens_rank_idx ON document_opens (owner_id, frecency_key DESC);
-- The daily retention sweep.
CREATE INDEX document_opens_last_idx ON document_opens (last_opened_at);

-- Home's Timeline reads a person's own events by actor, newest first; account deletion and the
-- sign-up migration match on actor_id too.
CREATE INDEX timeline_events_actor_idx ON timeline_events (actor_id, occurred_at DESC, id DESC);

-- Explorer Home seeds Jump back in once per person from their real edit days; the stamp rides the
-- user scope-state row, which account deletion and sign-up migration already handle.
ALTER TABLE timeline_scope_state ADD COLUMN frecency_seeded_at INTEGER;

-- The Timeline backfill reconstructs a document's last save as its owner's edit without knowing who
-- saved. It now says so (snapshot.backfilled); this marks the rows it wrote before that. A live edit
-- is stored within milliseconds of the time it claims (its occurred_at only walks forward), so an
-- edit stored more than a minute after its own time is a reconstruction.
UPDATE timeline_events
   SET snapshot = json_set(snapshot, '$.backfilled', json('true'))
 WHERE event_type = 'document_edited' AND created_at - occurred_at > 60000;

-- migration: 0064_drop_change_log.sql
-- Retire the Tab Activity panel's audit log (removed, see
-- docs/specs/012-collaboration/README.md "Removed: the Activity panel"). Undo / Redo never read this table, they replay in-memory
-- snapshots, so nothing else depends on it. The daily retention sweep that
-- pruned it is gone in the same change.
--
-- Dropping the table drops its indexes too; the explicit DROP INDEX lines just
-- make the intent readable and keep a partially-applied replay idempotent.

DROP INDEX IF EXISTS change_log_created_idx;
DROP INDEX IF EXISTS change_log_tab_created_at_idx;
DROP TABLE IF EXISTS change_log;

-- migration: 0065_within_reach.sql
-- Within reach replaces frecency in Explorer Home's Jump back in
-- (docs/specs/013-workspace/explorer-home.md "Jump back in"; blueprint
-- docs/specs/013-workspace/blueprints/explorer-home.md "Data and persistence").
--
-- Most used now counts use days (the person's document_opened events and real
-- edits) over the last 90 days at read time, and recent reads the last open, so
-- the frecency rank, its index, the lifetime counters and the one-off seed's
-- stamp have nothing left to serve. The index goes first: a column under an
-- index cannot be dropped.

DROP INDEX IF EXISTS document_opens_rank_idx;
ALTER TABLE document_opens DROP COLUMN frecency_key;
ALTER TABLE document_opens DROP COLUMN open_days;
ALTER TABLE document_opens DROP COLUMN first_opened_at;
ALTER TABLE timeline_scope_state DROP COLUMN frecency_seeded_at;

-- migration: 0066_illustrate_telemetry.sql
-- Infographic mode is Illustrate mode (docs/specs/007-editor/editor-modes.md "Telemetry"): its
-- events were renamed with it. The stored history moves with them, so the public dashboard's lines
-- continue under the new names.
UPDATE events SET type = 'ModeIllustrate' WHERE category = 'Editor' AND action = 'Changed' AND type = 'ModeInfographic';
UPDATE events SET type = 'OpensInIllustrate' WHERE category = 'Tab' AND action = 'Changed' AND type = 'OpensInInfographic';
UPDATE events SET type = 'IllustrateModeOn' WHERE category = 'UI' AND action = 'Toggled' AND type = 'InfographicModeOn';
UPDATE events SET type = 'IllustrateModeOff' WHERE category = 'UI' AND action = 'Toggled' AND type = 'InfographicModeOff';

-- migration: 0067_agent_changesets.sql
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

-- migration: 0068_community.sql
-- Community (docs/specs/025-community/community.md; blueprint docs/specs/025-community/blueprints/community.md §3):
-- documents published to the public gallery, their likes, copies and reports, and the community link each post owns.

-- What a share link is for. 'community' marks a post's own link: never listed for the owner, never expiring, no room,
-- no comments. Every existing link is an ordinary one.
ALTER TABLE share_links ADD COLUMN purpose TEXT NOT NULL DEFAULT 'share'
  CHECK (purpose IN ('share', 'community'));

-- One row per published document. Deleting the document (permanent delete) or the community link (unpublish)
-- cascades the post away with its likes, copies, reports and tags. The Trash leaves it alone: public reads join
-- `documents` and skip a trashed one, so a restore lists it again.
CREATE TABLE community_posts (
  id           TEXT    PRIMARY KEY,
  document_id  TEXT    NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  share_code   TEXT    NOT NULL UNIQUE REFERENCES share_links(code) ON DELETE CASCADE,
  author_id    TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  -- The display array (JSON); community_post_tags holds the same set for filtering.
  tags         TEXT    NOT NULL DEFAULT '[]',
  -- Lowercased title, description and tags: what search matches against.
  search_text  TEXT    NOT NULL,
  like_count   INTEGER NOT NULL DEFAULT 0,
  copy_count   INTEGER NOT NULL DEFAULT 0,
  state        TEXT    NOT NULL DEFAULT 'listed' CHECK (state IN ('listed', 'hidden')),
  hidden_by    TEXT    NULL CHECK (hidden_by IN ('reports', 'operator')),
  published_at INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX idx_community_posts_new ON community_posts (state, published_at DESC);
CREATE INDEX idx_community_posts_loved ON community_posts (state, like_count DESC, published_at DESC);
CREATE INDEX idx_community_posts_copied ON community_posts (state, copy_count DESC, published_at DESC);
CREATE INDEX idx_community_posts_category ON community_posts (category, state, published_at DESC);
CREATE INDEX idx_community_posts_author ON community_posts (author_id);

CREATE TABLE community_post_tags (
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX idx_community_post_tags_tag ON community_post_tags (tag);

-- One like per community key (a random per-browser key, never an owner id) per post.
CREATE TABLE community_likes (
  post_id    TEXT    NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  liker_key  TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, liker_key)
);

-- One row per distinct person who copied the post's document through its community link.
CREATE TABLE community_copies (
  post_id    TEXT    NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  copier_id  TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, copier_id)
);

-- One report per community key per post. `network_hash` is a one-way hash of the reporter's address salted with the
-- post id, so automatic hiding can require distinct networks without it being comparable across posts.
CREATE TABLE community_reports (
  post_id      TEXT    NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reporter_key TEXT    NOT NULL,
  network_hash TEXT    NOT NULL,
  reason       TEXT    NOT NULL
    CHECK (reason IN ('spam', 'offensive', 'personal-info', 'copyright', 'other')),
  note         TEXT    NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (post_id, reporter_key)
);

-- migration: 0069_community_anonymous.sql
-- Anonymous Community posts (docs/specs/025-community/community.md "Publishing"): when set, the post shows
-- "Anonymous" instead of the author's name and picture everywhere it is shown. Posts published before this
-- migration kept their name, so they stay named (0).
ALTER TABLE community_posts ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0;

-- migration: 0070_community_networks.sql
-- Community counts that one person cannot inflate (docs/specs/025-community/community.md "Likes"; blueprint §3, §7).
-- A like and a copy remember the network they came from (a one-way hash of the caller's address range, salted with
-- the post id), so a post's like and copy counts take at most a few from any one network. Rows from before this
-- migration have none and each counts on its own, as before.
ALTER TABLE community_likes ADD COLUMN network_hash TEXT;
ALTER TABLE community_copies ADD COLUMN network_hash TEXT;

-- Featured on the home page ranks posts by likes in the last three months: read by time, not the whole table.
CREATE INDEX idx_community_likes_created ON community_likes (created_at);

-- A guest's copies follow them to their account, and an account's copies go with it: both look a copier up.
CREATE INDEX idx_community_copies_copier ON community_copies (copier_id);

-- migration: 0071_items.sql
-- Items: a document's item store (docs/specs/026-plan/items.md, blueprint item-store.md
-- "Data and persistence"). Items are framed by Plan boards and Plan cards on the canvas
-- but stored apart from tabs. `fields` is an open JSON bag, never a column per field, so
-- the table holds any kind of item, not only tickets.
CREATE TABLE items (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  item_key INTEGER NOT NULL,
  rank TEXT NOT NULL,
  fields TEXT NOT NULL,
  rev INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (document_id, id)
);

-- The number people say out loud ("#12") is unique per document and never reused.
CREATE UNIQUE INDEX items_document_key ON items(document_id, item_key);

-- The store's revision (raised on every item write, carried by the room op) and the
-- next item key to hand out.
ALTER TABLE documents ADD COLUMN items_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN items_next_key INTEGER NOT NULL DEFAULT 1;

-- migration: 0072_item_types.sql
-- Item types (docs/specs/026-plan/item-types.md "Storage and sync"): a document's own type catalogue,
-- whole, as JSON. NULL (every document until somebody changes its types) means the built-in types,
-- read from code. Written only by PUT /api/documents/:id/item-types, never by a meta save.
ALTER TABLE documents ADD COLUMN item_types TEXT NULL;

-- migration: 0073_activity_plan_cards.sql
-- Plan cards on the Inbox (docs/specs/013-workspace/inbox.md §2.4).
--
-- The read finds a reader's cards by their hashed assignee id, so the item store gets an expression index on
-- it. Whether a card is still open, and which board to open it on, comes from the boards in tab JSON, so the
-- collaboration index gains a per-tab projection of each board's column statuses, written in the tab save's
-- own batch like collab_actions.
CREATE INDEX items_assignee ON items (json_extract(fields, '$.assignee.id'));

CREATE TABLE plan_board_statuses (
  tab_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  board_title TEXT NOT NULL,
  status TEXT NOT NULL,
  done INTEGER NOT NULL,
  board_order INTEGER NOT NULL,
  position INTEGER NOT NULL,
  -- Status before element: the read's Done check seeks (tab_id, status) for every candidate card.
  PRIMARY KEY (tab_id, status, element_id),
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

-- Re-run every reader's one-shot backfill on their next visit, so boards saved before this shipped are indexed.
-- The backfill is a full replace per tab, so re-running it over actions and threads is harmless.
DELETE FROM collab_index_state;

-- migration: 0073_ws_tickets_expiry_index.sql
-- Every room-ticket mint sweeps expired rows (DELETE ... WHERE expires_at <= ?),
-- which scanned the whole table without this index. Keeps the sweep a range
-- read however many tickets are live.
CREATE INDEX IF NOT EXISTS ws_tickets_expires_at ON ws_tickets(expires_at);

-- migration: 0074_items_open_threads.sql
-- Plan card comment threads on the Inbox (docs/specs/013-workspace/inbox.md §2.5).
--
-- The read lists a reader's open card threads per visible document. A partial index on the documents' open
-- threads lets it seek only the cards with an unresolved thread, never parsing every card of a large document.
-- Measured: a document of 20,000 cards, 2,000 with open 20-comment threads, read in ~106ms with it, ~200ms
-- without. A card with no thread, or a resolved one, is not in the index, so it costs card writes nothing.
CREATE INDEX items_open_threads ON items (document_id)
  WHERE json_extract(fields, '$.comments.resolved') = 0;

-- migration: 0075_image_grants.sql
-- Placement grants (docs/specs/009-elements/images.md, "Placement grants"). A
-- document serves an image when the image's owner owns the document, or the
-- document holds a grant for it. Grants are written when the image's owner is
-- tied to the document as a body is saved, and when a copy carries an image its
-- source could serve, so an id pasted into an unrelated document serves nothing.
-- No foreign keys, like image_refs: the document-removal batch deletes them.
CREATE TABLE image_grants (
  document_id TEXT NOT NULL,
  image_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;

-- Every reference that already crosses owners keeps rendering. There is no way
-- to tell an old paste from a legitimate placement, so all of them are granted.
INSERT OR IGNORE INTO image_grants (document_id, image_id, created_at)
SELECT DISTINCT dt.document_id, r.image_id, CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM image_refs r
  JOIN document_tabs dt ON dt.tab_id = r.tab_id
  JOIN images i ON i.id = r.image_id
  JOIN documents d ON d.id = dt.document_id
 WHERE i.owner_id <> d.owner_id;

-- migration: 0076_guest_voters.sql
-- Guest voters per network per document (docs/specs/012-collaboration/vote-integrity.md).
--
-- A guest id costs nothing to make, so a guest's vote is admitted against a cap of distinct guest voters per network
-- per document. One row per guest voter per network: `network_tag` is a SHA-256 of the document id and the caller's
-- network key (IPv4 address or IPv6 /64), `person_tag` the per-document person tag of the guest's owner id. Neither
-- can be read back. The primary key serves both the count and the membership read. Removed with the document.
CREATE TABLE guest_voters (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  network_tag TEXT NOT NULL,
  person_tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (document_id, network_tag, person_tag)
);

-- migration: 0077_workbench.sql
-- Workbench embeds (docs/specs/013-workspace/workbench-embeds.md, blueprint "Data and persistence").
--
-- A developer tool (a workbench) frames the editor signed in as a person. A token mints tickets only for an
-- origin its owner approved (a pairing); a ticket, redeemed once, opens a session confined to one document.
-- Secrets (tickets, sessions) are stored as SHA-256 hex only. Everything here is account-only: a guest never
-- holds a token, so never a row.

-- One ask to pair a token with an origin, answered once by the token's owner. `code` is the request's public
-- handle in the pairing URL: it grants nothing without the owner's own session.
CREATE TABLE workbench_pairing_requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  answered_at INTEGER NULL
);
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin) WHERE status = 'pending';
CREATE INDEX workbench_pairing_requests_expiry ON workbench_pairing_requests (expires_at);

-- A token and an origin its owner approved. Removing one ends its tickets and sessions (cascade).
CREATE TABLE workbench_pairings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  name TEXT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (token_id, origin)
);
CREATE INDEX workbench_pairings_owner ON workbench_pairings (owner_id);

-- Single-use, one-minute credentials that open one session each.
CREATE TABLE workbench_tickets (
  ticket_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER NULL
);
CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);

-- The frame acting as the person on one document.
CREATE TABLE workbench_sessions (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);
CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);

-- The room's handle on a workbench socket, so unpairing closes exactly that pairing's sockets.
ALTER TABLE ws_tickets ADD COLUMN workbench_pairing TEXT NULL;

-- migration: 0078_sheets.sql
-- Sheets: a document's sheet store (docs/specs/029-sheets/sheet-store.md, blueprint sheet-store.md "Data and
-- persistence"). A Sheet element on a tab names its sheet; the grid lives here, apart from the tab, so a sheet of
-- tens of thousands of cells never weighs on the tab's elements, snapshots or room.
CREATE TABLE sheets (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  -- The tab the sheet was made on, for life: tab-scoped links and references between sheets are by tab.
  tab_id TEXT NOT NULL,
  title TEXT NOT NULL,
  -- JSON SheetLayout: the row and column ids in order, sizes, hidden, freeze, merges, filter.
  layout TEXT NOT NULL,
  rev INTEGER NOT NULL,
  -- Kept in step with sheet_cells by every write, for the caps without a scan.
  cell_count INTEGER NOT NULL DEFAULT 0,
  cell_bytes INTEGER NOT NULL DEFAULT 0,
  -- Set by the daily sweep when no element frames the sheet; cleared when one does again.
  unframed_since INTEGER,
  -- The last write's own token: every statement of a write's batch checks it, so a write that lost the rev race
  -- (its guarded head update matched nothing) writes no cells even when a stale rev + 1 equals the current one.
  write_nonce TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (document_id, id)
);

CREATE INDEX sheets_tab ON sheets(document_id, tab_id);

-- One row per cell with an input or a format, by row id and column id: a row's place is only its position in the
-- layout, so inserting, moving and sorting rows rewrites no cell.
CREATE TABLE sheet_cells (
  document_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  col_id TEXT NOT NULL,
  input TEXT,
  format TEXT,
  PRIMARY KEY (document_id, sheet_id, row_id, col_id),
  FOREIGN KEY (document_id, sheet_id) REFERENCES sheets(document_id, id) ON DELETE CASCADE
);

-- migration: 0079_sheet_refs.sql
-- Deleting a sheet (docs/specs/029-sheets/sheet-store.md "Deleting a sheet", blueprint sheet-store.md "Deleting a
-- sheet"): which elements reference each sheet, kept by every tab write, so a sheet nothing references is noted
-- the moment it happens and expires by one indexed query, instead of a daily sample of tabs.
ALTER TABLE sheets RENAME COLUMN unframed_since TO unreferenced_since;

-- 1 when the editor deleted the sheet with its element: the sheet goes as soon as nothing references it.
ALTER TABLE sheets ADD COLUMN delete_when_unreferenced INTEGER;

-- A tab's references: every Sheet element's sheetId, and every copy not yet made's copyOf.
CREATE TABLE sheet_refs (
  tab_id TEXT NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, sheet_id)
);

CREATE INDEX sheet_refs_sheet ON sheet_refs(sheet_id);

CREATE INDEX sheets_unreferenced ON sheets(unreferenced_since) WHERE unreferenced_since IS NOT NULL;

-- The document's sheets settle as their references change, and only then: a tab write whose references are as they
-- were inserts and deletes no row here, so it pays nothing. Milliseconds since the epoch, from SQLite's own clock.
-- A removed reference: the sheet is unreferenced from now if nothing else references it, and deleted when the
-- editor deleted it with its element.
CREATE TRIGGER sheet_refs_removed AFTER DELETE ON sheet_refs
BEGIN
  DELETE FROM sheets
   WHERE id = OLD.sheet_id
     AND document_id IN (SELECT document_id FROM document_tabs WHERE tab_id = OLD.tab_id)
     AND delete_when_unreferenced = 1
     AND NOT EXISTS (SELECT 1 FROM sheet_refs r JOIN document_tabs dt ON dt.tab_id = r.tab_id
                      WHERE r.sheet_id = sheets.id AND dt.document_id = sheets.document_id);
  UPDATE sheets SET unreferenced_since = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
   WHERE id = OLD.sheet_id
     AND document_id IN (SELECT document_id FROM document_tabs WHERE tab_id = OLD.tab_id)
     AND unreferenced_since IS NULL
     AND NOT EXISTS (SELECT 1 FROM sheet_refs r JOIN document_tabs dt ON dt.tab_id = r.tab_id
                      WHERE r.sheet_id = sheets.id AND dt.document_id = sheets.document_id);
END;

-- An added reference: the sheet is referenced again.
CREATE TRIGGER sheet_refs_added AFTER INSERT ON sheet_refs
BEGIN
  UPDATE sheets SET unreferenced_since = NULL
   WHERE id = NEW.sheet_id
     AND document_id IN (SELECT document_id FROM document_tabs WHERE tab_id = NEW.tab_id)
     AND unreferenced_since IS NOT NULL;
END;

-- migration: 0080_participate_links.sql
-- Participant links (docs/specs/013-workspace/share-roles.md; blueprint "Data and persistence").
--
-- A link's access level gains a third value, `participate`. `role` keeps its two-valued CHECK and is written as
-- 'view' for a Participant link, so a worker from before this change, which reads any role it does not know as
-- edit, reads a Participant link as a Viewer and fails closed. `level` carries the real level; NULL on every row
-- written before, which reads as its `role`. Adding a column instead of rebuilding the table also leaves
-- community_posts, which cascades from share_links, untouched.
ALTER TABLE share_links ADD COLUMN level TEXT NULL
  CHECK (level IS NULL OR level IN ('view', 'participate', 'edit'));

-- A visit records the level it was granted the same way, so "Shared with you" finds the link at that level.
ALTER TABLE shared_with ADD COLUMN level TEXT NULL
  CHECK (level IS NULL OR level IN ('view', 'participate', 'edit'));

-- The room ticket of a Participant carries its adder key: the server-derived id the room stamps on the stickies
-- and text it adds, so it may later delete those and only those.
ALTER TABLE ws_tickets ADD COLUMN adder_key TEXT NULL;

-- migration: 0081_shared_with_share_code.sql
-- The link a visit came in through (docs/specs/013-workspace/share-roles.md "Share links"): a visit opens the
-- document through that link only while it is live, so revoking it ends the visits it granted. NULL for visits
-- recorded before this column, which keep the older rule (the oldest live link of their role and scope) until
-- their next open records one.
ALTER TABLE shared_with ADD COLUMN share_code TEXT NULL;

-- Revoking a link deletes the visits it granted: found by document and code.
CREATE INDEX shared_with_document_code_idx ON shared_with(document_id, share_code);

-- migration: 0082_item_types_rev.sql
-- The type catalogue's revision (docs/specs/026-plan/item-types.md "Storage and sync"): raised by every write of
-- `item_types`, and named by a write as the catalogue it changed (`expectedRev`), so two editors saving at once never
-- overwrite each other: the one that read an older catalogue is refused (409) and re-applies its change.
ALTER TABLE documents ADD COLUMN item_types_rev INTEGER NOT NULL DEFAULT 0;

-- migration: 0083_team_member_unique_user.sql
-- One membership row per person per team (docs/specs/013-workspace/teams.md "Members"). The lazy
-- invite claim used to attach every unclaimed invite for an email, even in a team that person had
-- already joined by link, leaving two rows for one user: the team listed them twice and removing
-- one row left the other holding access.
--
-- 1. Keep the best row of each duplicate set: joined before invited, then the oldest. If any row in
--    the set was a joined admin, the keeper keeps that admin role, so a dedupe never strands a team
--    without its admin.
UPDATE team_members SET role = 'admin'
WHERE user_id IS NOT NULL
  AND id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY team_id, user_id
        ORDER BY CASE status WHEN 'joined' THEN 0 ELSE 1 END, created_at, id
      ) AS rn
      FROM team_members WHERE user_id IS NOT NULL
    ) WHERE rn = 1
  )
  AND EXISTS (
    SELECT 1 FROM team_members dup
    WHERE dup.team_id = team_members.team_id AND dup.user_id = team_members.user_id
      AND dup.role = 'admin' AND dup.status = 'joined'
  );

DELETE FROM team_members
WHERE user_id IS NOT NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY team_id, user_id
        ORDER BY CASE status WHEN 'joined' THEN 0 ELSE 1 END, created_at, id
      ) AS rn
      FROM team_members WHERE user_id IS NOT NULL
    ) WHERE rn = 1
  );

-- 2. Then the database refuses a second row for the same user in a team. Pending email invites
--    (user_id NULL) stay outside it; UNIQUE(team_id, email) already covers those.
CREATE UNIQUE INDEX team_members_team_user_unique
  ON team_members (team_id, user_id) WHERE user_id IS NOT NULL;

-- migration: 0084_tab_stats.sql
-- What the Explorer's Details view shows of a document without reading a tab body
-- (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come from").
--
-- One row per tab: its editor mode, element and comment counts, the byte size of its stored body,
-- and when it was written. Every tab write upserts its row in the same batch. A table of its own
-- rather than columns on `tabs`, whose columns after the `data` blob sit behind its overflow pages:
-- summing over a document's tabs here reads no body. Tabs written before this migration are
-- counted by the daily cron (apps/api/src/tab-stats-backfill.ts); this migration only creates the
-- table, so it is constant-time however large `tabs` is.
CREATE TABLE tab_stats (
  tab_id        TEXT    PRIMARY KEY REFERENCES tabs(id) ON DELETE CASCADE,
  mode          TEXT    NOT NULL,
  element_count INTEGER NOT NULL,
  comment_count INTEGER NOT NULL,
  data_bytes    INTEGER NOT NULL,
  written_at    INTEGER NOT NULL
);

-- migration: 0085_document_join_notified.sql
-- docs/specs/014-identity/profile-and-email-notifications.md (a): throttle the "someone joined your document"
-- email to at most one per document per ~15 min, the new-comment email's rule (comment_notified_at, 0035),
-- so a run of first visits is one email, not one per visitor. The last time we emailed about a join on this
-- document. NULL = never.
ALTER TABLE documents ADD COLUMN join_notified_at INTEGER;

-- migration: 0086_email_lifecycle_attempts.sql
-- docs/specs/014-identity/transactional-email.md §5: failed lifecycle sends per owner, so an address that
-- always fails (a deleted mailbox, a hard bounce) stops being retried after MAX_SEND_ATTEMPTS
-- (db/email-lifecycle.ts) instead of filling the oldest-first daily batch forever. A successful send, or a
-- changed address, resets the count. last_attempt_at is the last failure (ms), for diagnosis.
ALTER TABLE email_lifecycle ADD COLUMN send_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_lifecycle ADD COLUMN last_attempt_at INTEGER;

-- migration: 0087_notify_email_claims.sql
-- docs/specs/012-collaboration/assigned-actions.md §4 + docs/specs/012-collaboration/comment-mentions.md "The email": one row per
-- action-assigned or mention email sent. claim_key hashes the sender, document, recipient and the text the
-- email carries, so a replayed request emails nobody twice inside the dedupe window; sender_id + created_at
-- cap how many such emails one account can send an hour (db/notify-email-claims.ts). The daily cron deletes
-- rows past the dedupe window.
CREATE TABLE notify_email_claims (
  claim_key  TEXT PRIMARY KEY,
  sender_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX notify_email_claims_sender ON notify_email_claims (sender_id, created_at);
CREATE INDEX notify_email_claims_created ON notify_email_claims (created_at);

-- migration: 0088_drive_google_account.sql
-- docs/specs/022-drive-mirror/drive-mirror.md "Data": the Google account a broker connection belongs to
-- (Drive's `about.user.permissionId`, a stable per-account id), recorded on every consent. A consent by a
-- different Google account clears the root folder, the page token and every drive_items row, which name
-- the first account's files. NULL on rows made before this migration and on browser-only connections;
-- the first consent after it records the account without clearing anything.
ALTER TABLE drive_connections ADD COLUMN google_account_id TEXT;

-- migration: 0089_drive_account_switch.sql
-- docs/specs/022-drive-mirror/drive-mirror.md "Reconnecting with another Google account": a consent by a
-- different Google account than google_account_id waits here for the owner to confirm or cancel the
-- switch. The sealed refresh token is sealed exactly as refresh_token_enc; the expiry is epoch ms
-- (DRIVE_ACCOUNT_SWITCH_TTL_MS after the consent). All three are NULL when no switch is pending.
ALTER TABLE drive_connections ADD COLUMN pending_refresh_token_enc TEXT;
ALTER TABLE drive_connections ADD COLUMN pending_google_account_id TEXT;
ALTER TABLE drive_connections ADD COLUMN pending_expires_at INTEGER;

-- migration: 0090_card_types_start_empty.sql
-- Card types start empty (docs/specs/026-plan/item-types.md "The type catalogue"): a document whose card types were
-- never chosen (`item_types` NULL) now reads as none, and the five default types arrive only through Add Default
-- Types. A document made before that with cards kept the five default types its cards were made with, so it is given
-- them here, stored, exactly as the code defines them (defaultCatalogue, validated). The revision is raised so an
-- editor still holding the unchosen catalogue re-reads before its next change lands. Documents with no cards stay
-- NULL and so start empty.
UPDATE documents
SET
  item_types = '{"version":1,"types":[{"id":"project","label":"Project","newTitle":"New project","glyph":"project","color":"#18181b","fields":["title","status","description","assignee","priority","color","start","due","labels","comments"]},{"id":"task","label":"Task","newTitle":"New task","glyph":"task","color":"#71717a","fields":["title","status","description","assignee","parent","priority","estimate","due","checklist","labels","comments"],"custom":[{"id":"parent","label":"Parent","kind":"card","linkType":"project"}]},{"id":"note","label":"Note","newTitle":"New note","glyph":"note","color":"#2563eb","fields":["title","status","description","votes","comments"]},{"id":"idea","label":"Idea","newTitle":"New idea","glyph":"idea","color":"#eab308","fields":["title","status","description","votes","labels","comments"]},{"id":"action","label":"Action","newTitle":"New action","glyph":"action","color":"#dc2626","fields":["title","status","description","assignee","due","checklist","comments"]}]}',
  item_types_rev = item_types_rev + 1
WHERE item_types IS NULL
  AND EXISTS (SELECT 1 FROM items WHERE items.document_id = documents.id);

-- migration: 0091_document_and_author_lookups.sql
-- Lookups by document and by author (docs/specs/015-api/api.md "Owner-keyed data"). Each of these
-- tables keys its rows by owner first, so a statement by document id or author id read the whole table:
--
-- - deleting a document (or purging it from the Trash) cascades into favourites, document_opens,
--   workbench_tickets and workbench_sessions by document_id, and each cascade scanned its table;
-- - the guest-to-account migration and account deletion find agent_changesets by author_id.
--
-- Measured on SQLite with 100,000 favourites: deleting one document's rows took 2.52 ms before, 0.003 ms after;
-- the other tables scanned the same way. apps/api/src/db/lookup-plans.test.ts pins the plans.
CREATE INDEX favourites_document_idx ON favourites (document_id);
CREATE INDEX document_opens_document_idx ON document_opens (document_id);
CREATE INDEX agent_changesets_author_idx ON agent_changesets (author_id);
CREATE INDEX workbench_tickets_document_idx ON workbench_tickets (document_id);
CREATE INDEX workbench_sessions_document_idx ON workbench_sessions (document_id);

-- The favourites primary key (owner_id, document_id) already serves every read by owner, so this index only
-- cost every star and unstar a second index write.
DROP INDEX idx_favourites_owner;

-- migration: 0092_forms.sql
-- Form links (docs/specs/030-forms/forms.md "Publishing and the form link"). A Form tab's public address: the
-- code a respondent opens, whether the form takes responses, and its running response number. The form itself
-- stays on its tab; a link only names it, so a copy of the document is never published.
--
-- One live (unsuspended) link per Form tab. A suspended link is kept, so its code never answers again and the
-- document's suspensions can be counted.
CREATE TABLE form_links (
  code TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL,
  open INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  -- The response number last given (blueprint §11: never reused).
  responses INTEGER NOT NULL DEFAULT 0,
  -- When the last response arrived (the Inbox's row time).
  last_response_at INTEGER,
  -- The per-form hourly cap's window and count.
  hour_start INTEGER NOT NULL DEFAULT 0,
  hour_count INTEGER NOT NULL DEFAULT 0,
  suspended_at INTEGER,
  -- The new-response email's throttle: when one last went, and how many arrived since.
  last_email_at INTEGER,
  held_emails INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX form_links_live_tab ON form_links (document_id, tab_id) WHERE suspended_at IS NULL;
CREATE INDEX form_links_document ON form_links (document_id);

-- Reports from respondents (docs/specs/030-forms/forms.md "Report This Form"): one per browser per link.
CREATE TABLE form_reports (
  code TEXT NOT NULL REFERENCES form_links (code) ON DELETE CASCADE,
  browser TEXT NOT NULL,
  network TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (code, browser)
);

-- What each reader has seen of a form's responses (docs/specs/030-forms/forms.md "Hearing about responses"):
-- the last response number, so unseen = responses - seen_number with no row per card.
CREATE TABLE form_reads (
  code TEXT NOT NULL REFERENCES form_links (code) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  seen_number INTEGER NOT NULL,
  PRIMARY KEY (code, owner_id)
);
CREATE INDEX form_reads_owner ON form_reads (owner_id);

-- migration: 0093_form_links_deleted.sql
-- A deleted form link is kept, marked, rather than removed (docs/specs/030-forms/forms.md "Publishing and the form
-- link"): its response number carries on to the tab's next link, so numbers never repeat on one form, and its code
-- never answers again. Only a live link (not suspended, not deleted) is unique per Form tab.
ALTER TABLE form_links ADD COLUMN deleted_at INTEGER;
DROP INDEX form_links_live_tab;
CREATE UNIQUE INDEX form_links_live_tab ON form_links (document_id, tab_id)
  WHERE suspended_at IS NULL AND deleted_at IS NULL;

-- migration: 0094_tags.sql
-- Tags (docs/specs/013-workspace/tags.md): coloured labels a person makes and puts on their documents.
--
-- Personal, like favourites: a tag belongs to one owner, and putting it on a team document marks it for that owner
-- only. Their own tables rather than keys in the 4 KB user_preferences blob, which a person's tags and links would
-- outgrow, failing every preference write.
--
-- `colour` is a standard colour's name ('blue') or a custom '#rrggbb'. One name per owner, ignoring case.
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Serves every read by owner, and the one-name-per-person rule.
CREATE UNIQUE INDEX tags_owner_name ON tags (owner_id, name COLLATE NOCASE);

-- One tag on one document. Both sides cascade: deleting a tag takes it off every document, and a purged document drops
-- its tags. The primary key serves the list's join from tags; the document index keeps a document delete's cascade a
-- seek rather than a scan.
CREATE TABLE document_tags (
  tag_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (tag_id, document_id),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX document_tags_document_idx ON document_tags (document_id);

-- migration: 0095_team_invite_decline_and_reminders.sql
-- Team invites: decline from the email, reminders, and expiry (docs/specs/013-workspace/teams.md
-- "Declining from the email" and "Reminders and expiry").
--
-- `status` gains two rejected values, 'declined' and 'expired' (TEXT, no CHECK, so no column change).
--
-- decline_token_hashes: the SHA-256 hashes (hex) of the decline tokens the invite's emails carry, space-separated,
-- at most four (the invite plus three reminders). Only hashes: the token itself lives only in the email.
-- reminder1/2/3_sent_at: each reminder's stamp, 0 = skipped. reminder_attempts: failed reminder sends in a row.
-- clock_started_at: when the invite's reminder and expiry clock started (ms). A new invite sets it to its
-- created_at; an invite already pending here starts it now, at the deploy.
ALTER TABLE team_members ADD COLUMN decline_token_hashes TEXT;
ALTER TABLE team_members ADD COLUMN reminder1_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder2_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder3_sent_at INTEGER;
ALTER TABLE team_members ADD COLUMN reminder_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE team_members ADD COLUMN clock_started_at INTEGER;

-- Invites already pending were sent before reminders existed: their clock starts at this deploy, so they get the
-- full reminder series and expire 28 days from now, and none is rejected on the first run.
UPDATE team_members
   SET clock_started_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
 WHERE status = 'invited';

-- The daily sweep's reads (expiry + the three reminder stages) only ever look at pending invites by clock.
CREATE INDEX IF NOT EXISTS team_members_pending_idx ON team_members (clock_started_at)
  WHERE status = 'invited';

-- migration: 0096_ws_tickets_owner.sql
-- Room tickets carry the owner bit (docs/specs/012-collaboration/facilitator.md "Who may take it";
-- docs/specs/015-api/api.md "Realtime model"). Every editor now joins its room through a ticket, so the
-- `X-Verified-Owner` bit the facilitator baton needs ("the owner can always take it back") has to ride the
-- ticket: before this, only a bare `?o=` upgrade could set it, and a signed-in owner (who always rode a ticket)
-- was never seated as the owner. 1 when the mint resolved the caller as the document's owner (ownsDocument).
-- Tickets live 60 s, so the DEFAULT only ever applies to tickets minted in the seconds around the deploy.
ALTER TABLE ws_tickets ADD COLUMN owner INTEGER NOT NULL DEFAULT 0;

-- migration: 0097_pages_mode.sql
-- Illustrate mode is Pages mode (docs/specs/007-editor/editor-modes.md "Naming in the interface").
-- Tab bodies keep `"opensIn":"illustrate"`: every read goes through parseEditorMode, which reads it
-- as Pages. What is renamed here is what would otherwise be lost or split in two.

-- The Pages tour's seen-guard and tracks: a lost one would offer the tour again. When both names
-- are somehow present the new one is kept (upgradeLegacyPreferences drops the old on read).
UPDATE user_preferences
  SET prefs = replace(prefs, '"illustrateTourSeen":', '"pagesTourSeen":')
  WHERE prefs LIKE '%"illustrateTourSeen":%' AND prefs NOT LIKE '%"pagesTourSeen":%';
UPDATE user_preferences
  SET prefs = replace(prefs, '"illustrateTourKinds":', '"pagesTourKinds":')
  WHERE prefs LIKE '%"illustrateTourKinds":%' AND prefs NOT LIKE '%"pagesTourKinds":%';

-- Telemetry history, so the public dashboard's lines continue under the new names: the mode
-- switch, opens-in, leave, tour, Settings and export events (ModeIllustrate, OpensInIllustrate,
-- LeaveIllustrateConfirmed, IllustrateTour*, IllustrateTourStep*, IllustrateModeOn/Off,
-- TemplateModeIllustrate, IllustratePNG ... IllustrateGIFPages). Error types name code, not
-- the product, and are left as they were.
UPDATE events SET type = replace(type, 'Illustrate', 'Pages')
  WHERE category IN ('Editor', 'Tab', 'UI', 'Document') AND type LIKE '%Illustrate%';

-- The help articles moved with the mode (docs/specs/018-help/help-app.md, "Renamed articles"):
-- the section's and the tour's views and votes continue under the new slugs, and their page views
-- under the new addresses.
UPDATE events SET type = CASE type
    WHEN 'illustrate' THEN 'pages-mode'
    WHEN 'illustrate-tour' THEN 'pages-tour'
  END
  WHERE category = 'Help' AND type IN ('illustrate', 'illustrate-tour');
UPDATE events
  SET type = replace(replace(type, '/canvas/illustrate/illustrate-tour', '/canvas/pages-mode/pages-tour'),
    '/canvas/illustrate', '/canvas/pages-mode')
  WHERE category = 'Page' AND action = 'View' AND type LIKE '%/canvas/illustrate%';

-- migration: 0098_workshop_mode.sql
-- Facilitate mode is Workshop mode (docs/specs/007-editor/editor-modes.md "Naming in the interface").
-- Tab bodies keep `"opensIn":"facilitate"`: every read goes through parseEditorMode, which reads it
-- as Workshop. What is renamed here is what would otherwise be lost or split in two.

-- The Workshop tour's seen-guard: a lost one would offer the tour again. When both names are
-- somehow present the new one is kept (upgradeLegacyPreferences drops the old on read).
UPDATE user_preferences
  SET prefs = replace(prefs, '"facilitateTourSeen":', '"workshopTourSeen":')
  WHERE prefs LIKE '%"facilitateTourSeen":%' AND prefs NOT LIKE '%"workshopTourSeen":%';

-- Telemetry history, so the public dashboard's lines continue under the new names: the mode
-- switch, template-mode, default-folder, tour and Settings events (ModeFacilitate,
-- TemplateModeFacilitate, DefaultModeFacilitate, FacilitateTour*, FacilitateTourStep*,
-- FacilitateTourSeenOn/Off). GLOB is case-sensitive, so the facilitator's own events
-- (Facilitator..., Facilitation..., Facilitated...) are left alone. Error types name code, not the
-- product, and are left as they were.
UPDATE events SET type = replace(type, 'Facilitate', 'Workshop')
  WHERE category NOT IN ('Error', 'Help', 'Page') AND type GLOB '*Facilitate*'
    AND type NOT GLOB '*Facilitate[ds]*';

-- The help articles moved with the mode (docs/specs/018-help/help-app.md, "Renamed articles"):
-- the section's and the tour's views and votes continue under the new slugs, and their page views
-- under the new addresses.
UPDATE events SET type = CASE type
    WHEN 'facilitate-mode' THEN 'workshop-mode'
    WHEN 'facilitate-tour' THEN 'workshop-tour'
  END
  WHERE category = 'Help' AND type IN ('facilitate-mode', 'facilitate-tour');
UPDATE events
  SET type = replace(replace(type, '/canvas/facilitate-mode/facilitate-tour', '/canvas/workshop-mode/workshop-tour'),
    '/canvas/facilitate-mode', '/canvas/workshop-mode')
  WHERE category = 'Page' AND action = 'View' AND type LIKE '%/canvas/facilitate-mode%';

-- migration: 0099_workbench_workspace.sql
-- The workspace scope of workbench embeds (docs/specs/013-workspace/workbench-embeds.md "Two scopes", blueprint
-- docs/specs/013-workspace/blueprints/workbench-embeds.md "Data and persistence", WB64). A ticket, a session, a
-- pairing and a pairing request each carry a scope: `document` (one document) or `workspace` (the person's whole
-- workspace). Every row from before is a `document` row, as the spec says of the pairings approved before scopes.

-- One live request per token, origin and scope: a document request and a workspace request never share a code, so
-- the pairing page never shows one question while answering another.
ALTER TABLE workbench_pairing_requests ADD COLUMN scope TEXT NOT NULL DEFAULT 'document'
  CHECK (scope IN ('document', 'workspace'));
DROP INDEX workbench_pairing_requests_live;
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin, scope) WHERE status = 'pending';

-- A workspace pairing covers the document scope too; approving a workspace request widens a document pairing in
-- place (WB50).
ALTER TABLE workbench_pairings ADD COLUMN scope TEXT NOT NULL DEFAULT 'document'
  CHECK (scope IN ('document', 'workspace'));

-- Tickets and sessions name no document in the workspace scope. SQLite cannot drop a NOT NULL, so both tables are
-- rebuilt; no table references either, so the old ones drop with nothing to park. A workspace row may name the
-- folder it starts on; it has no foreign key, since a folder deleted since is only a start place the Explorer
-- reports as gone.
CREATE TABLE workbench_tickets_new (
  ticket_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace')),
  document_id TEXT NULL REFERENCES documents(id) ON DELETE CASCADE,
  folder_id TEXT NULL,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER NULL,
  CHECK ((scope = 'document') = (document_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
INSERT INTO workbench_tickets_new
  (ticket_hash, owner_id, token_id, pairing_id, scope, document_id, folder_id, tab_id, origin, role, created_at,
   expires_at, used_at)
SELECT ticket_hash, owner_id, token_id, pairing_id, 'document', document_id, NULL, tab_id, origin, role, created_at,
       expires_at, used_at
  FROM workbench_tickets;
DROP TABLE workbench_tickets;
ALTER TABLE workbench_tickets_new RENAME TO workbench_tickets;
CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);
CREATE INDEX workbench_tickets_document_idx ON workbench_tickets (document_id);

CREATE TABLE workbench_sessions_new (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  pairing_id TEXT NOT NULL REFERENCES workbench_pairings(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'document' CHECK (scope IN ('document', 'workspace')),
  document_id TEXT NULL REFERENCES documents(id) ON DELETE CASCADE,
  folder_id TEXT NULL,
  tab_id TEXT NULL,
  origin TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK ((scope = 'document') = (document_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
INSERT INTO workbench_sessions_new
  (id, secret_hash, owner_id, token_id, pairing_id, scope, document_id, folder_id, tab_id, origin, role, created_at,
   expires_at)
SELECT id, secret_hash, owner_id, token_id, pairing_id, 'document', document_id, NULL, tab_id, origin, role,
       created_at, expires_at
  FROM workbench_sessions;
DROP TABLE workbench_sessions;
ALTER TABLE workbench_sessions_new RENAME TO workbench_sessions;
CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);
CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);
CREATE INDEX workbench_sessions_document_idx ON workbench_sessions (document_id);

-- The rooms a workspace session joined, so unpairing or revoking closes them as it closes a document session's
-- (WB55). Recorded on each room ticket the session mints; gone with its session or its document.
CREATE TABLE workbench_session_rooms (
  session_id TEXT NOT NULL REFERENCES workbench_sessions(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, document_id)
);
-- A purged document's cascade finds its rows by document.
CREATE INDEX workbench_session_rooms_document_idx ON workbench_session_rooms (document_id);

