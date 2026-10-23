-- The livedesign baseline schema (docs/specs/015-api/api.md "Storage"): every table the api worker reads and writes,
-- in one migration. It replaces the hundred-odd migrations inherited from livediagram: nothing was deployed, so
-- there is no older database to bring forward. A later change is a new numbered migration after this one.
--
-- Times are epoch milliseconds (INTEGER). JSON lives in TEXT columns. An owner id is a Clerk `sub` or a guest
-- participant id (docs/specs/014-identity/auth-and-guest-access.md).

-- ---------------------------------------------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------------------------------------------

-- A person's display name, presence colour and optional profile picture, by owner id.
CREATE TABLE participants (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  picture_url TEXT    NULL
);

-- The guest ids a signed-in account was migrated from (POST /api/migrate), so their history still reads as theirs.
CREATE TABLE owner_aliases (
  owner_id   TEXT    NOT NULL,
  alias_id   TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, alias_id)
);
CREATE INDEX owner_aliases_alias_idx ON owner_aliases (alias_id);

-- First sightings of a Clerk account and session: the sign-up and sign-in counts key on them.
CREATE TABLE auth_accounts (
  owner_id      TEXT    PRIMARY KEY NOT NULL,
  first_seen_at INTEGER NOT NULL
);

CREATE TABLE auth_sessions (
  session_id    TEXT    PRIMARY KEY NOT NULL,
  first_seen_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_seen_idx ON auth_sessions (first_seen_at);

-- Settings that follow a person between browsers: one JSON blob each.
CREATE TABLE user_preferences (
  owner_id   TEXT    PRIMARY KEY NOT NULL,
  prefs      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Personal API tokens (docs/specs/015-api/public-api-and-tokens.md): only the hash is kept.
CREATE TABLE api_tokens (
  id               TEXT    PRIMARY KEY,
  owner_id         TEXT    NOT NULL,
  token_hash       TEXT    NOT NULL UNIQUE,
  name             TEXT,
  created_at       INTEGER NOT NULL,
  last_used_at     INTEGER,
  expires_at       INTEGER NOT NULL,
  revoked          INTEGER NOT NULL DEFAULT 0,
  expiry_warned_at INTEGER,
  read_only        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX api_tokens_owner_idx ON api_tokens (owner_id);

-- The lifecycle emails each account has been sent (docs/specs/014-identity/transactional-email.md).
CREATE TABLE email_lifecycle (
  owner_id            TEXT    PRIMARY KEY,
  email               TEXT    NOT NULL,
  created_at          INTEGER NOT NULL,
  welcome_sent_at     INTEGER,
  week1_sent_at       INTEGER,
  week2_sent_at       INTEGER,
  activation_sent_at  INTEGER,
  winback_sent_at     INTEGER,
  milestone_sent_at   INTEGER,
  first_share_sent_at INTEGER,
  send_attempts       INTEGER NOT NULL DEFAULT 0,
  last_attempt_at     INTEGER
);
CREATE INDEX idx_email_lifecycle_due ON email_lifecycle (created_at);

-- One claim per notification email, so a retried request never sends it twice; the sender's rows bound its rate.
CREATE TABLE notify_email_claims (
  claim_key  TEXT    PRIMARY KEY,
  sender_id  TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX notify_email_claims_created ON notify_email_claims (created_at);
CREATE INDEX notify_email_claims_sender ON notify_email_claims (sender_id, created_at);

-- ---------------------------------------------------------------------------------------------------------------
-- Teams and the workspace
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE teams (
  id                     TEXT    PRIMARY KEY,
  name                   TEXT    NOT NULL,
  organisation           TEXT    NULL,
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL,
  invite_link_token      TEXT    NULL,
  invite_link_expires_at INTEGER NULL
);
CREATE INDEX teams_invite_link_token_idx ON teams (invite_link_token);

-- A member, or an invitation by email until it is accepted (docs/specs/013-workspace/teams.md).
CREATE TABLE team_members (
  id                   TEXT    PRIMARY KEY,
  team_id              TEXT    NOT NULL,
  user_id              TEXT    NULL,
  email                TEXT    NULL,
  role                 TEXT    NOT NULL,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL,
  status               TEXT    NULL,
  -- Space-separated hashes of the decline links an invitation's emails carried.
  decline_token_hashes TEXT,
  reminder1_sent_at    INTEGER,
  reminder2_sent_at    INTEGER,
  reminder3_sent_at    INTEGER,
  reminder_attempts    INTEGER NOT NULL DEFAULT 0,
  -- When the reminder clock started for a pending invitation.
  clock_started_at     INTEGER,
  FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);
CREATE INDEX team_members_team_idx ON team_members (team_id);
CREATE INDEX team_members_user_idx ON team_members (user_id);
CREATE INDEX team_members_email_idx ON team_members (email);
CREATE INDEX team_members_team_user_idx ON team_members (team_id, user_id);
CREATE UNIQUE INDEX team_members_team_email_uq ON team_members (team_id, email);
CREATE UNIQUE INDEX team_members_team_user_unique ON team_members (team_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX team_members_pending_idx ON team_members (clock_started_at) WHERE status = 'invited';

CREATE TABLE folders (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL,
  parent_id  TEXT    NULL,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  team_id    TEXT    NULL,
  FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE SET NULL
);
CREATE INDEX folders_owner_idx ON folders (owner_id);
CREATE INDEX folders_parent_idx ON folders (parent_id);
CREATE INDEX folders_team_idx ON folders (team_id);

-- A design (docs/specs/006-design/design.md): its name, owner, place, slide deck and Trash state. Its tabs
-- are rows of `tabs`, joined through `design_tabs`.
CREATE TABLE designs (
  id                  TEXT    PRIMARY KEY,
  owner_id            TEXT    NOT NULL,
  name                TEXT    NOT NULL,
  saved_at            INTEGER NOT NULL,
  created_at          INTEGER NOT NULL,
  shareable           INTEGER NOT NULL DEFAULT 0,
  folder_id           TEXT    NULL,
  share_password      TEXT,
  team_id             TEXT    NULL,
  -- What made it ('mcp', 'cli', ...), NULL for a person in the editor: the Explorer's Made by AI filter.
  source              TEXT    NULL,
  comment_notified_at INTEGER,
  thumb_rendered_at   INTEGER,
  -- The slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised JSON, or NULL for none.
  presentation        TEXT    NULL,
  trashed_at          INTEGER NULL,
  trash_reason        TEXT    NULL,
  -- The creation intent (docs/specs/013-workspace/default-folders.md).
  opens_in            TEXT,
  tab_kind            TEXT,
  join_notified_at    INTEGER
);
CREATE INDEX idx_designs_owner_recent ON designs (owner_id, saved_at DESC);
CREATE INDEX designs_folder_idx ON designs (folder_id);
CREATE INDEX designs_team_idx ON designs (team_id);
CREATE INDEX designs_source_idx ON designs (source);
CREATE INDEX designs_trashed_idx ON designs (trashed_at) WHERE trashed_at IS NOT NULL;

-- One tab's body (docs/specs/006-design/per-tab-storage.md): the live app's Tab minus { id, name }, elements and
-- per-tab settings, as JSON. `rev` advances by exactly one on every body write (the trigger below).
CREATE TABLE tabs (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  data          TEXT    NOT NULL,
  updated_at    INTEGER NOT NULL,
  element_count INTEGER NULL,
  rev           INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER tabs_rev_advances BEFORE UPDATE OF data ON tabs
  WHEN NEW.rev IS NOT OLD.rev + 1
  BEGIN SELECT RAISE(ABORT, 'tab_rev_stale'); END;

-- Which tabs a design holds, in order, with each tab's folder in the tab bar.
CREATE TABLE design_tabs (
  design_id TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  folder      TEXT,
  PRIMARY KEY (design_id, tab_id),
  FOREIGN KEY (design_id) REFERENCES designs (id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);
CREATE INDEX design_tabs_by_design ON design_tabs (design_id, order_index);
CREATE INDEX design_tabs_by_tab ON design_tabs (tab_id);

-- Counts written with each tab body, so listings never read a body.
CREATE TABLE tab_stats (
  tab_id        TEXT    PRIMARY KEY REFERENCES tabs (id) ON DELETE CASCADE,
  mode          TEXT    NOT NULL,
  element_count INTEGER NOT NULL,
  comment_count INTEGER NOT NULL,
  data_bytes    INTEGER NOT NULL,
  written_at    INTEGER NOT NULL
);

-- When each person last opened each design (Home's recents, the Explorer's Opened column).
CREATE TABLE design_opens (
  owner_id       TEXT    NOT NULL,
  design_id    TEXT    NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
  last_opened_at INTEGER NOT NULL,
  last_open_day  TEXT    NOT NULL,
  PRIMARY KEY (owner_id, design_id)
);
CREATE INDEX design_opens_design_idx ON design_opens (design_id);
CREATE INDEX design_opens_last_idx ON design_opens (last_opened_at);

CREATE TABLE favourites (
  owner_id    TEXT    NOT NULL,
  design_id TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (owner_id, design_id),
  FOREIGN KEY (design_id) REFERENCES designs (id) ON DELETE CASCADE
);
CREATE INDEX favourites_design_idx ON favourites (design_id);

CREATE TABLE tags (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  colour     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX tags_owner_name ON tags (owner_id, name COLLATE NOCASE);

CREATE TABLE design_tags (
  tag_id      TEXT    NOT NULL,
  design_id TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (tag_id, design_id),
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
  FOREIGN KEY (design_id) REFERENCES designs (id) ON DELETE CASCADE
);
CREATE INDEX design_tags_design_idx ON design_tags (design_id);

-- The folder a person files each kind of new design into (docs/specs/013-workspace/default-folders.md).
CREATE TABLE placement_defaults (
  owner_id    TEXT    NOT NULL,
  default_key TEXT    NOT NULL,
  folder_id   TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (owner_id, default_key)
);

CREATE TABLE custom_themes (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  definition TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX custom_themes_owner_idx ON custom_themes (owner_id);
CREATE INDEX custom_themes_owner_created_idx ON custom_themes (owner_id, created_at DESC);

-- ---------------------------------------------------------------------------------------------------------------
-- Sharing and the realtime room
-- ---------------------------------------------------------------------------------------------------------------

-- A share link (docs/specs/013-workspace/share-roles.md): `level` is the role it grants, `role` the read-or-write
-- bit older readers use; `tab_id` scopes it to one tab.
CREATE TABLE share_links (
  code        TEXT    PRIMARY KEY,
  design_id TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('edit', 'view')),
  created_at  INTEGER NOT NULL,
  expiry      TEXT    NULL,
  expires_at  INTEGER NULL,
  tab_id      TEXT    NULL,
  level       TEXT    NULL CHECK (level IS NULL OR level IN ('view', 'participate', 'edit')),
  FOREIGN KEY (design_id) REFERENCES designs (id) ON DELETE CASCADE
);
CREATE INDEX idx_share_links_design_created ON share_links (design_id, created_at);
CREATE INDEX idx_share_links_design_role_created ON share_links (design_id, role, created_at);

-- The designs shared with a person through a link they opened (the Explorer's Shared with me).
CREATE TABLE shared_with (
  owner_id    TEXT    NOT NULL,
  design_id TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('edit', 'view')),
  last_seen   INTEGER NOT NULL,
  tab_id      TEXT    NULL,
  level       TEXT    NULL CHECK (level IS NULL OR level IN ('view', 'participate', 'edit')),
  share_code  TEXT    NULL,
  PRIMARY KEY (owner_id, design_id),
  FOREIGN KEY (design_id) REFERENCES designs (id) ON DELETE CASCADE
);
CREATE INDEX shared_with_by_owner ON shared_with (owner_id, last_seen DESC);
CREATE INDEX shared_with_design_code_idx ON shared_with (design_id, share_code);

-- Single-use tickets a browser trades for its room WebSocket (docs/specs/015-api/api.md).
CREATE TABLE ws_tickets (
  ticket            TEXT    PRIMARY KEY,
  design_id       TEXT    NOT NULL,
  role              TEXT    NOT NULL,
  expires_at        INTEGER NOT NULL,
  tab_scope         TEXT    NULL,
  share_code        TEXT    NULL,
  account           INTEGER NOT NULL DEFAULT 0,
  person_tag        TEXT,
  workbench_pairing TEXT    NULL,
  adder_key         TEXT    NULL
);
CREATE INDEX ws_tickets_expires_at ON ws_tickets (expires_at);

-- ---------------------------------------------------------------------------------------------------------------
-- Comments, actions and the timeline
-- ---------------------------------------------------------------------------------------------------------------

-- One row per comment thread, kept from the tab bodies for the Inbox (docs/specs/012-collaboration/assigned-actions.md).
CREATE TABLE collab_threads (
  tab_id              TEXT    NOT NULL,
  element_id          TEXT    NOT NULL,
  element_label       TEXT    NOT NULL,
  resolved            INTEGER NOT NULL,
  comment_count       INTEGER NOT NULL,
  -- JSON array of the distinct comment author ids, queried with json_each.
  participant_ids     TEXT    NOT NULL,
  -- What the row shows: the newest comment. No email address ever lands here.
  latest_text         TEXT    NOT NULL,
  latest_author_name  TEXT    NOT NULL,
  latest_author_color TEXT    NOT NULL,
  first_at            INTEGER NOT NULL,
  latest_at           INTEGER NOT NULL,
  mentioned_ids       TEXT    NOT NULL DEFAULT '[]',
  PRIMARY KEY (tab_id, element_id),
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);
CREATE INDEX collab_threads_open_idx ON collab_threads (resolved, latest_at);

-- One row per assigned action.
CREATE TABLE collab_actions (
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
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);
CREATE INDEX collab_actions_assignee_idx ON collab_actions (assignee_user_id, status);
CREATE INDEX collab_actions_assigner_idx ON collab_actions (assigner_id, status);
CREATE INDEX collab_actions_member_idx ON collab_actions (assignee_member_id);

-- When each owner's comment index was last rebuilt from their tab bodies.
CREATE TABLE collab_index_state (
  owner_id      TEXT    PRIMARY KEY,
  backfilled_at INTEGER NOT NULL
);

-- The timeline event store (docs/specs/013-workspace/timeline.md): History, Team Activity and Home's What Happened.
CREATE TABLE timeline_events (
  id          TEXT    PRIMARY KEY,
  -- Who did it; NULL for a system event with no person behind it (a token-expiry warning).
  actor_id    TEXT,
  -- The thing it is about: 'design' | 'team' | 'account'.
  source_type TEXT    NOT NULL,
  source_id   TEXT    NOT NULL,
  event_type  TEXT    NOT NULL,
  -- '' for a one-shot event; '<actorId>:<YYYY-MM-DD>' for the editing event that extends itself through a day.
  dedupe_key  TEXT    NOT NULL DEFAULT '',
  -- Title Case category, never user content ("Comment Added").
  title       TEXT    NOT NULL,
  -- Where user content goes (names, comment text, people).
  description TEXT,
  occurred_at INTEGER NOT NULL,
  -- JSON the renderer needs, captured at emit time so drawing the feed never reads other tables.
  snapshot    TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  -- Emission is idempotent: a retried request updates its row instead of adding one.
  UNIQUE (source_type, source_id, event_type, dedupe_key)
);
CREATE INDEX timeline_events_actor_idx ON timeline_events (actor_id, occurred_at DESC, id DESC);
CREATE INDEX timeline_events_occurred_idx ON timeline_events (occurred_at);

-- Who sees each event: scope_type 'user' with an owner id. The primary key is the feed's read index.
CREATE TABLE timeline_event_scopes (
  event_id   TEXT    NOT NULL REFERENCES timeline_events (id) ON DELETE CASCADE,
  scope_type TEXT    NOT NULL,
  scope_id   TEXT    NOT NULL,
  added_at   INTEGER NOT NULL,
  deleted_at INTEGER,
  PRIMARY KEY (scope_type, scope_id, event_id)
);
CREATE INDEX timeline_event_scopes_event_idx ON timeline_event_scopes (event_id);

-- How far each scope has read its feed (the unread count), and when its one-shot backfill ran.
CREATE TABLE timeline_scope_state (
  scope_type    TEXT    NOT NULL,
  scope_id      TEXT    NOT NULL,
  backfilled_at INTEGER,
  last_seen_at  INTEGER,
  PRIMARY KEY (scope_type, scope_id)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Agent changesets (docs/specs/024-agents/agent-changesets.md)
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE agent_changesets (
  id           TEXT    PRIMARY KEY,
  design_id  TEXT    NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
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
CREATE UNIQUE INDEX agent_changesets_tab_rev ON agent_changesets (tab_id, rev);
CREATE INDEX agent_changesets_design_created ON agent_changesets (design_id, created_at);
CREATE INDEX agent_changesets_created ON agent_changesets (created_at);
CREATE INDEX agent_changesets_author_idx ON agent_changesets (author_id);

-- A changeset's operations, inverse and results, kept apart from its row so listings stay small.
CREATE TABLE agent_changeset_parts (
  changeset_id TEXT NOT NULL REFERENCES agent_changesets (id) ON DELETE CASCADE,
  part         TEXT NOT NULL CHECK (part IN ('ops', 'inverse', 'results')),
  data         TEXT NOT NULL,
  PRIMARY KEY (changeset_id, part)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Images (docs/specs/009-elements/images.md)
-- ---------------------------------------------------------------------------------------------------------------

-- One uploaded image, its bytes in the IMAGES R2 bucket under its id. (owner_id, sha256) dedupes a second upload
-- of the same bytes; (owner_id, created_at) serves the gallery.
CREATE TABLE images (
  id            TEXT    PRIMARY KEY,
  owner_id      TEXT    NOT NULL,
  content_type  TEXT    NOT NULL,
  byte_size     INTEGER NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  sha256        TEXT    NOT NULL,
  original_name TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX images_owner_created_idx ON images (owner_id, created_at DESC);
CREATE UNIQUE INDEX images_owner_sha_idx ON images (owner_id, sha256);

-- Which images each tab places ("Reference index"), kept from the tab bodies in the same batch as each write, so
-- retention, the usage map and share-visitor reads never read a body. No foreign keys: the delete paths prune it.
CREATE TABLE image_refs (
  tab_id   TEXT NOT NULL,
  image_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, image_id)
) WITHOUT ROWID;
CREATE INDEX image_refs_image_idx ON image_refs (image_id);

-- The reference index's backfill over tabs saved before it existed. A new database has none, so it starts complete.
CREATE TABLE image_refs_backfill (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  created_at   INTEGER NOT NULL,
  cursor       INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);
INSERT INTO image_refs_backfill (id, created_at, cursor, completed_at)
VALUES (1, CAST(strftime('%s', 'now') AS INTEGER) * 1000, 0, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

-- The images a design may serve beyond its owner's own ("Placement grants"). No foreign keys, like image_refs:
-- the design-removal batch deletes them.
CREATE TABLE image_grants (
  design_id TEXT    NOT NULL,
  image_id    TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (design_id, image_id)
) WITHOUT ROWID;

-- ---------------------------------------------------------------------------------------------------------------
-- Workbench embeds (docs/specs/013-workspace/workbench-embeds.md)
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE workbench_pairings (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL,
  token_id   TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  origin     TEXT    NOT NULL,
  name       TEXT    NULL,
  created_at INTEGER NOT NULL,
  scope      TEXT    NOT NULL DEFAULT 'design' CHECK (scope IN ('design', 'workspace')),
  UNIQUE (token_id, origin)
);
CREATE INDEX workbench_pairings_owner ON workbench_pairings (owner_id);

CREATE TABLE workbench_pairing_requests (
  id          TEXT    PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE,
  owner_id    TEXT    NOT NULL,
  token_id    TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  origin      TEXT    NOT NULL,
  name        TEXT    NULL,
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  answered_at INTEGER NULL,
  scope       TEXT    NOT NULL DEFAULT 'design' CHECK (scope IN ('design', 'workspace'))
);
CREATE INDEX workbench_pairing_requests_expiry ON workbench_pairing_requests (expires_at);
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin, scope) WHERE status = 'pending';

CREATE TABLE workbench_tickets (
  ticket_hash TEXT    PRIMARY KEY,
  owner_id    TEXT    NOT NULL,
  token_id    TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  pairing_id  TEXT    NOT NULL REFERENCES workbench_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL DEFAULT 'design' CHECK (scope IN ('design', 'workspace')),
  design_id TEXT    NULL REFERENCES designs (id) ON DELETE CASCADE,
  folder_id   TEXT    NULL,
  tab_id      TEXT    NULL,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER NULL,
  CHECK ((scope = 'design') = (design_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX workbench_tickets_design_idx ON workbench_tickets (design_id);
CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);

CREATE TABLE workbench_sessions (
  id          TEXT    PRIMARY KEY,
  secret_hash TEXT    NOT NULL UNIQUE,
  owner_id    TEXT    NOT NULL,
  token_id    TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  pairing_id  TEXT    NOT NULL REFERENCES workbench_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL DEFAULT 'design' CHECK (scope IN ('design', 'workspace')),
  design_id TEXT    NULL REFERENCES designs (id) ON DELETE CASCADE,
  folder_id   TEXT    NULL,
  tab_id      TEXT    NULL,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  CHECK ((scope = 'design') = (design_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX workbench_sessions_design_idx ON workbench_sessions (design_id);
CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);
CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);

-- The designs a workspace-scoped session has opened rooms on, so revoking the session closes them.
CREATE TABLE workbench_session_rooms (
  session_id  TEXT NOT NULL REFERENCES workbench_sessions (id) ON DELETE CASCADE,
  design_id TEXT NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, design_id)
);
CREATE INDEX workbench_session_rooms_design_idx ON workbench_session_rooms (design_id);

-- ---------------------------------------------------------------------------------------------------------------
-- Telemetry (docs/specs/017-telemetry/telemetry.md): anonymous events, never user content.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT    NOT NULL,
  action   TEXT    NOT NULL,
  type     TEXT,
  ts       INTEGER NOT NULL
);
CREATE INDEX events_ts_idx ON events (ts);

-- The photo blob store (docs/specs/031-photo/photo-store.md): a photo page's tiles, sources and
-- previews, stored once by content (R2 key photo/<id> in PHOTO_BLOBS), and the tabs that may read each.
CREATE TABLE photo_blobs (
  id           TEXT PRIMARY KEY,   -- the first 16 bytes of the SHA-256 of the bytes, base64url
  content_type TEXT NOT NULL,      -- image/png, image/jpeg or image/webp, sniffed on upload
  byte_size    INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);

-- A tab may read a blob it holds a ref to: it uploaded the bytes, or a copy carried them.
CREATE TABLE photo_blob_refs (
  tab_id     TEXT NOT NULL,
  blob_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (tab_id, blob_id)
) WITHOUT ROWID;
CREATE INDEX photo_blob_refs_blob_idx ON photo_blob_refs (blob_id);
CREATE INDEX photo_blob_refs_created_idx ON photo_blob_refs (created_at);

-- Images live in liveworkspace's media service (liveworkspace/docs/media.md): the bytes, the gallery, dedupe and
-- the caps are its, and this api keeps what its own access rules need (src/media.ts).
--
-- Whose each image is, as this api names owners (an account id or a guest id), for every image this api has
-- met: one uploaded here, one listed in someone's gallery here, or one a design asked for. The placement grants
-- read it. An owner of '' is an id the service doesn't know, so a design placing it doesn't ask again on every
-- read.
CREATE TABLE media_images (
  id       TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL
) WITHOUT ROWID;

CREATE INDEX media_images_owner_idx ON media_images (owner_id);

-- The designs whose images changed since the service last heard (liveworkspace/docs/media.md "References"):
-- written in the same batch as the change, sent by the every-minute cron. `queued_at` moves on each change, so
-- the cron deletes only the rows it sent.
CREATE TABLE media_ref_outbox (
  design_id TEXT PRIMARY KEY,
  queued_at INTEGER NOT NULL
) WITHOUT ROWID;
