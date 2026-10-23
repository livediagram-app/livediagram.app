-- livediagram's D1 baseline: every migration up to 0104 squashed into one, as the schema stood, less the
-- tables of Plan mode (now liveplanner). livediagram ships fresh on new infrastructure, so there is no data to
-- migrate: tables leave this file in place as each capability moves to the liveworkspace index, the canvas's
-- Durable Object or accounts.


CREATE TABLE documents (
  id                  TEXT    PRIMARY KEY,
  owner_id            TEXT    NOT NULL,
  name                TEXT    NOT NULL,
  saved_at            INTEGER NOT NULL,
  created_at          INTEGER NOT NULL,
  shareable           INTEGER NOT NULL DEFAULT 0,
  folder_id           TEXT    NULL,
  share_password      TEXT,
  team_id             TEXT    NULL,
  source              TEXT    NULL,
  comment_notified_at INTEGER,
  thumb_rendered_at   INTEGER,
  trashed_at          INTEGER NULL,
  trash_reason        TEXT    NULL,
  opens_in            TEXT,
  tab_kind            TEXT,
  template_family     TEXT,
  join_notified_at    INTEGER,
  -- What the listings show of the content, pushed by the document's Durable Object
  -- (document-room/document-outbox.ts): JSON. NULL until its first push.
  content_summary     TEXT    NULL
);

CREATE TABLE share_links (
  code        TEXT    PRIMARY KEY,
  document_id  TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('edit', 'view')),
  created_at  INTEGER NOT NULL, expiry TEXT NULL, expires_at INTEGER NULL, tab_id TEXT NULL, purpose TEXT NOT NULL DEFAULT 'share'
  CHECK (purpose IN ('share', 'community')), level TEXT NULL
  CHECK (level IS NULL OR level IN ('view', 'participate', 'edit')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE folders (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  parent_id   TEXT NULL,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL, team_id TEXT NULL,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE TABLE shared_with (
  owner_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('edit', 'view')),
  last_seen INTEGER NOT NULL, tab_id TEXT NULL, level TEXT NULL
  CHECK (level IS NULL OR level IN ('view', 'participate', 'edit')), share_code TEXT NULL,
  PRIMARY KEY (owner_id, document_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  action   TEXT NOT NULL,
  type     TEXT,
  ts       INTEGER NOT NULL
);

CREATE TABLE teams (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  organisation  TEXT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
, invite_link_token TEXT NULL, invite_link_expires_at INTEGER NULL);

CREATE TABLE team_members (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL,
  user_id     TEXT NULL,
  email       TEXT NULL,
  role        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL, status TEXT NULL, invite_token TEXT NULL, decline_token_hashes TEXT, reminder1_sent_at INTEGER, reminder2_sent_at INTEGER, reminder3_sent_at INTEGER, reminder_attempts INTEGER NOT NULL DEFAULT 0, clock_started_at INTEGER,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE api_tokens (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  name         TEXT,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at   INTEGER NOT NULL,
  revoked      INTEGER NOT NULL DEFAULT 0
, expiry_warned_at INTEGER, read_only INTEGER NOT NULL DEFAULT 0);

CREATE TABLE ws_tickets (
  ticket TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at INTEGER NOT NULL
, tab_scope TEXT NULL, share_code TEXT NULL, person_tag TEXT, workbench_pairing TEXT NULL, adder_key TEXT NULL, owner INTEGER NOT NULL DEFAULT 0);

CREATE TABLE favourites (
  owner_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, document_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

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

CREATE TABLE timeline_event_scopes (
  event_id TEXT NOT NULL REFERENCES timeline_events (id) ON DELETE CASCADE,
  -- v1 emits only 'user' (scope_id = an owner id). Free text with no
  -- CHECK on purpose: a later per-diagram or per-team feed is a new
  -- value here plus a renderer, not a migration.
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  added_at INTEGER NOT NULL, deleted_at INTEGER,
  -- Doubles as the read index: the feed query is a prefix scan on
  -- (scope_type, scope_id).
  PRIMARY KEY (scope_type, scope_id, event_id)
);

CREATE TABLE timeline_scope_state (
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  -- NULL until the one-shot backfill has seeded this scope from the
  -- caller's existing diagrams + team memberships (docs/specs/013-workspace/timeline.md §5).
  backfilled_at INTEGER,
  last_seen_at INTEGER,
  PRIMARY KEY (scope_type, scope_id)
);

CREATE TABLE collab_threads (
  document_id         TEXT    NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  tab_id              TEXT    NOT NULL,
  tab_name            TEXT    NOT NULL,
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
  PRIMARY KEY (document_id, tab_id, element_id)
);

CREATE TABLE owner_aliases (
  owner_id   TEXT    NOT NULL,
  alias_id   TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, alias_id)
);

CREATE TABLE collab_actions (
  document_id        TEXT    NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  tab_id             TEXT    NOT NULL,
  tab_name           TEXT    NOT NULL,
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
  PRIMARY KEY (document_id, tab_id, element_id, action_id)
);

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
, google_account_id TEXT, pending_refresh_token_enc TEXT, pending_google_account_id TEXT, pending_expires_at INTEGER);

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

CREATE TABLE shape_libraries (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  source      TEXT NOT NULL,
  items       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE placement_defaults (
  owner_id    TEXT NOT NULL,
  default_key TEXT NOT NULL,
  folder_id   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (owner_id, default_key)
);

CREATE TABLE document_opens (
  owner_id        TEXT NOT NULL,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  last_opened_at  INTEGER NOT NULL,
  last_open_day   TEXT NOT NULL,
  PRIMARY KEY (owner_id, document_id)
);

CREATE TABLE image_grants (
  document_id TEXT NOT NULL,
  image_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;

CREATE TABLE guest_voters (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  network_tag TEXT NOT NULL,
  person_tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (document_id, network_tag, person_tag)
);

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
, scope TEXT NOT NULL DEFAULT 'document'
  CHECK (scope IN ('document', 'workspace')));

CREATE TABLE workbench_pairings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  name TEXT NULL,
  created_at INTEGER NOT NULL, scope TEXT NOT NULL DEFAULT 'document'
  CHECK (scope IN ('document', 'workspace')),
  UNIQUE (token_id, origin)
);

CREATE TABLE notify_email_claims (
  claim_key  TEXT PRIMARY KEY,
  sender_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE workbench_tickets (
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

CREATE TABLE workbench_sessions (
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

CREATE TABLE workbench_session_rooms (
  session_id TEXT NOT NULL REFERENCES workbench_sessions(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, document_id)
);

CREATE TABLE community_links (
  share_code TEXT    PRIMARY KEY,
  document_id TEXT   NOT NULL UNIQUE,
  author_id  TEXT    NOT NULL,
  post_id    TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  anonymous  INTEGER NOT NULL DEFAULT 1,
  hidden_at  INTEGER NULL,
  sent_state TEXT    NULL CHECK (sent_state IN ('public', 'closed', 'away'))
);

CREATE TABLE media_images (
  id       TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE media_ref_outbox (
  document_id TEXT PRIMARY KEY,
  queued_at   INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE team_sync_state (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  cursor    TEXT    NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE INDEX folders_owner_idx ON folders(owner_id);

CREATE INDEX folders_parent_idx ON folders(parent_id);

CREATE INDEX shared_with_by_owner ON shared_with(owner_id, last_seen DESC);

CREATE INDEX events_ts_idx ON events (ts);

CREATE INDEX team_members_team_idx ON team_members(team_id);

CREATE INDEX team_members_user_idx ON team_members(user_id);

CREATE INDEX team_members_email_idx ON team_members(email);

CREATE UNIQUE INDEX team_members_team_email_uq ON team_members(team_id, email);

CREATE INDEX folders_team_idx ON folders(team_id);

CREATE INDEX team_members_invite_token_idx ON team_members(invite_token);

CREATE INDEX team_members_team_user_idx ON team_members (team_id, user_id);

CREATE INDEX teams_invite_link_token_idx ON teams(invite_link_token);

CREATE INDEX api_tokens_owner_idx ON api_tokens (owner_id);

CREATE INDEX timeline_events_occurred_idx ON timeline_events (occurred_at);

CREATE INDEX timeline_event_scopes_event_idx ON timeline_event_scopes (event_id);

CREATE INDEX collab_threads_open_idx ON collab_threads (resolved, latest_at);

CREATE INDEX owner_aliases_alias_idx ON owner_aliases (alias_id);

CREATE INDEX collab_actions_assignee_idx ON collab_actions (assignee_user_id, status);

CREATE INDEX collab_actions_assigner_idx ON collab_actions (assigner_id, status);

CREATE INDEX collab_actions_member_idx   ON collab_actions (assignee_member_id);

CREATE INDEX idx_documents_owner_recent ON documents (owner_id, saved_at DESC);

CREATE INDEX documents_folder_idx ON documents (folder_id);

CREATE INDEX documents_team_idx ON documents (team_id);

CREATE INDEX documents_source_idx ON documents (source);

CREATE INDEX documents_trashed_idx ON documents (trashed_at) WHERE trashed_at IS NOT NULL;

CREATE INDEX idx_share_links_document_created ON share_links (document_id, created_at);

CREATE INDEX idx_share_links_document_role_created ON share_links (document_id, role, created_at);

CREATE INDEX drive_items_ld_idx ON drive_items (item_kind, ld_id);

CREATE INDEX shape_libraries_owner_created_idx ON shape_libraries (owner_id, created_at DESC);

CREATE INDEX document_opens_last_idx ON document_opens (last_opened_at);

CREATE INDEX timeline_events_actor_idx ON timeline_events (actor_id, occurred_at DESC, id DESC);

CREATE INDEX ws_tickets_expires_at ON ws_tickets(expires_at);

CREATE INDEX workbench_pairing_requests_expiry ON workbench_pairing_requests (expires_at);

CREATE INDEX workbench_pairings_owner ON workbench_pairings (owner_id);

CREATE INDEX shared_with_document_code_idx ON shared_with(document_id, share_code);

CREATE UNIQUE INDEX team_members_team_user_unique
  ON team_members (team_id, user_id) WHERE user_id IS NOT NULL;

CREATE INDEX notify_email_claims_sender ON notify_email_claims (sender_id, created_at);

CREATE INDEX notify_email_claims_created ON notify_email_claims (created_at);

CREATE INDEX favourites_document_idx ON favourites (document_id);

CREATE INDEX document_opens_document_idx ON document_opens (document_id);

CREATE INDEX team_members_pending_idx ON team_members (clock_started_at)
  WHERE status = 'invited';

CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin, scope) WHERE status = 'pending';

CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);

CREATE INDEX workbench_tickets_document_idx ON workbench_tickets (document_id);

CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);

CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);

CREATE INDEX workbench_sessions_document_idx ON workbench_sessions (document_id);

CREATE INDEX workbench_session_rooms_document_idx ON workbench_session_rooms (document_id);

CREATE INDEX media_images_owner_idx ON media_images (owner_id);

CREATE TABLE document_images (
  document_id TEXT NOT NULL,
  image_id    TEXT NOT NULL,
  PRIMARY KEY (document_id, image_id)
) WITHOUT ROWID;
CREATE INDEX document_images_image_idx ON document_images (image_id);
