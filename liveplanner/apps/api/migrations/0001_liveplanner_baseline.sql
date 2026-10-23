-- liveplanner's baseline schema (docs/specs/015-api/api.md "Storage"): every table the api worker reads and writes,
-- in one migration. It replaces the hundred-odd migrations inherited from livediagram: nothing was deployed, so
-- there is no older database to bring forward. A later change is a new numbered migration after this one.
--
-- Times are epoch milliseconds (INTEGER). JSON lives in TEXT columns. An owner id is a Clerk `sub` or a guest
-- participant id (docs/specs/014-identity/auth-and-guest-access.md).

-- ---------------------------------------------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------------------------------------------

-- A person's display name and presence colour, by owner id.
CREATE TABLE participants (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  color      TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

-- The guest ids a signed-in account was migrated from (POST /api/migrate), so their history still reads as theirs.
CREATE TABLE owner_aliases (
  owner_id   TEXT    NOT NULL,
  alias_id   TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, alias_id)
);
CREATE INDEX owner_aliases_alias_idx ON owner_aliases (alias_id);

-- First sighting of an account: a sign-in from an account never seen before counts as a sign-up.
CREATE TABLE auth_accounts (
  owner_id      TEXT    PRIMARY KEY NOT NULL,
  first_seen_at INTEGER NOT NULL
);


-- Settings that follow a person between browsers: one JSON blob each.
CREATE TABLE user_preferences (
  owner_id   TEXT    PRIMARY KEY NOT NULL,
  prefs      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The liveworkspace account tokens this app has seen (src/db/api-tokens.ts): its mirror, which workbench
-- pairings and sessions hang off. Only the hash is kept.
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

-- Teams are run on liveworkspace.app (liveworkspace/docs/accounts.md): teams and team_members are this
-- app's copy of each team and its joined members, kept by following liveworkspace's change feed from
-- this cursor (src/db/team-sync.ts).
CREATE TABLE team_sync_state (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  cursor    TEXT    NOT NULL,
  synced_at INTEGER NOT NULL
);

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

-- A project (docs/specs/006-project/project.md): its name, owner, place and Trash state. Its content (tabs,
-- items, sheets, changesets) is not here: it lives in the plan's own Durable Object (docs/specs/015-api/api.md
-- "Storage"), which pushes `content_summary` and `saved_at` back for the listings.
CREATE TABLE projects (
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
  trashed_at          INTEGER NULL,
  trash_reason        TEXT    NULL,
  -- The creation intent (docs/specs/013-workspace/default-folders.md).
  opens_in            TEXT,
  tab_kind            TEXT,
  template_family     TEXT,
  join_notified_at    INTEGER,
  -- What the listings show of the content, pushed by the plan's Durable Object (src/plan-room/plan-outbox.ts):
  -- JSON {firstTabCount, tabCounts, stats, hasContent}. NULL until its first push.
  content_summary     TEXT    NULL
);
CREATE INDEX idx_projects_owner_recent ON projects (owner_id, saved_at DESC);
CREATE INDEX projects_folder_idx ON projects (folder_id);
CREATE INDEX projects_team_idx ON projects (team_id);
CREATE INDEX projects_source_idx ON projects (source);
CREATE INDEX projects_trashed_idx ON projects (trashed_at) WHERE trashed_at IS NOT NULL;

-- When each person last opened each project (Home's recents, the Explorer's Opened column).
CREATE TABLE project_opens (
  owner_id       TEXT    NOT NULL,
  project_id    TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  last_opened_at INTEGER NOT NULL,
  last_open_day  TEXT    NOT NULL,
  PRIMARY KEY (owner_id, project_id)
);
CREATE INDEX project_opens_project_idx ON project_opens (project_id);
CREATE INDEX project_opens_last_idx ON project_opens (last_opened_at);

CREATE TABLE favourites (
  owner_id    TEXT    NOT NULL,
  project_id TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (owner_id, project_id),
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX favourites_project_idx ON favourites (project_id);

CREATE TABLE tags (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  colour     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX tags_owner_name ON tags (owner_id, name COLLATE NOCASE);

CREATE TABLE project_tags (
  tag_id      TEXT    NOT NULL,
  project_id TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (tag_id, project_id),
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX project_tags_project_idx ON project_tags (project_id);

-- The folder a person files each kind of new project into (docs/specs/013-workspace/default-folders.md).
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
  project_id TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('edit', 'view')),
  created_at  INTEGER NOT NULL,
  expiry      TEXT    NULL,
  expires_at  INTEGER NULL,
  tab_id      TEXT    NULL,
  level       TEXT    NULL CHECK (level IS NULL OR level IN ('view', 'participate', 'edit')),
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX idx_share_links_project_created ON share_links (project_id, created_at);
CREATE INDEX idx_share_links_project_role_created ON share_links (project_id, role, created_at);

-- The projects shared with a person through a link they opened (the Explorer's Shared with me).
CREATE TABLE shared_with (
  owner_id    TEXT    NOT NULL,
  project_id TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('edit', 'view')),
  last_seen   INTEGER NOT NULL,
  tab_id      TEXT    NULL,
  level       TEXT    NULL CHECK (level IS NULL OR level IN ('view', 'participate', 'edit')),
  share_code  TEXT    NULL,
  PRIMARY KEY (owner_id, project_id),
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
CREATE INDEX shared_with_by_owner ON shared_with (owner_id, last_seen DESC);
CREATE INDEX shared_with_project_code_idx ON shared_with (project_id, share_code);

-- Single-use tickets a browser trades for its room WebSocket (docs/specs/015-api/api.md).
CREATE TABLE ws_tickets (
  ticket            TEXT    PRIMARY KEY,
  project_id       TEXT    NOT NULL,
  role              TEXT    NOT NULL,
  expires_at        INTEGER NOT NULL,
  tab_scope         TEXT    NULL,
  share_code        TEXT    NULL,
  person_tag        TEXT,
  workbench_pairing TEXT    NULL,
  adder_key         TEXT    NULL,
  owner             INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ws_tickets_expires_at ON ws_tickets (expires_at);

-- ---------------------------------------------------------------------------------------------------------------
-- Comments, actions and the timeline
-- ---------------------------------------------------------------------------------------------------------------

-- The Inbox's index of the comment threads and assigned actions inside each plan's tabs
-- (docs/specs/013-workspace/inbox.md §2), one tab's rows replaced at a time by the plan's Durable Object
-- (src/plan-room/plan-outbox.ts `onTabCollabChanged`). It carries the tab's name, as the tab itself is not here.
CREATE TABLE collab_threads (
  project_id          TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
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
  PRIMARY KEY (project_id, tab_id, element_id)
);
CREATE INDEX collab_threads_open_idx ON collab_threads (resolved, latest_at);

-- One row per assigned action.
CREATE TABLE collab_actions (
  project_id         TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
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
  PRIMARY KEY (project_id, tab_id, element_id, action_id)
);
CREATE INDEX collab_actions_assignee_idx ON collab_actions (assignee_user_id, status);
CREATE INDEX collab_actions_assigner_idx ON collab_actions (assigner_id, status);
CREATE INDEX collab_actions_member_idx ON collab_actions (assignee_member_id);

-- The timeline event store (docs/specs/013-workspace/timeline.md): History, Team Activity and Home's What Happened.
CREATE TABLE timeline_events (
  id          TEXT    PRIMARY KEY,
  -- Who did it; NULL for a system event with no person behind it (a token-expiry warning).
  actor_id    TEXT,
  -- The thing it is about: 'diagram' (a project) | 'team' | 'account'.
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

-- How far each scope has read its feed (the unread count).
CREATE TABLE timeline_scope_state (
  scope_type   TEXT    NOT NULL,
  scope_id     TEXT    NOT NULL,
  last_seen_at INTEGER,
  PRIMARY KEY (scope_type, scope_id)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Plan: the Inbox's view of cards and boards (docs/specs/026-plan/items.md, docs/specs/013-workspace/inbox.md §2.4)
-- ---------------------------------------------------------------------------------------------------------------

-- Each board's columns, kept from the tab bodies for the cross-project reads (Home's plans, a card's Done check),
-- pushed by the plan's Durable Object with the tab's name and place.
CREATE TABLE plan_board_statuses (
  project_id  TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  tab_id      TEXT    NOT NULL,
  tab_name    TEXT    NOT NULL,
  tab_order   INTEGER NOT NULL,
  element_id  TEXT    NOT NULL,
  board_title TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  done        INTEGER NOT NULL,
  board_order INTEGER NOT NULL,
  position    INTEGER NOT NULL,
  -- Status before element: the Done check seeks (project_id, status) for every candidate card.
  PRIMARY KEY (project_id, tab_id, status, element_id)
);
CREATE INDEX plan_board_statuses_status ON plan_board_statuses (project_id, status);

-- The cards the Inbox lists (assigned to someone, or holding a comment thread), pushed by the plan's Durable
-- Object from its item store. `fields` keeps only what the Inbox reads: title, status, assignee, archived,
-- linked and the comment thread.
CREATE TABLE plan_cards (
  project_id TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  id         TEXT    NOT NULL,
  item_key   INTEGER NOT NULL,
  type       TEXT    NOT NULL,
  fields     TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, id)
);
CREATE INDEX plan_cards_assignee ON plan_cards (json_extract(fields, '$.assignee.id'));
CREATE INDEX plan_cards_open_threads ON plan_cards (project_id) WHERE json_extract(fields, '$.comments.resolved') = 0;

-- ---------------------------------------------------------------------------------------------------------------
-- Forms (docs/specs/030-forms/forms.md)
-- ---------------------------------------------------------------------------------------------------------------

-- A Form tab's published link.
CREATE TABLE form_links (
  code             TEXT    PRIMARY KEY,
  project_id      TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
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
  -- The form tab's name, heading and response board, for the Inbox, kept by the plan's Durable Object.
  tab_name         TEXT,
  heading          TEXT,
  board_tab_id     TEXT
);
CREATE INDEX form_links_project ON form_links (project_id);
CREATE UNIQUE INDEX form_links_live_tab ON form_links (project_id, tab_id)
  WHERE suspended_at IS NULL AND deleted_at IS NULL;

-- The response number each person has seen up to, for the Inbox's unread count.
CREATE TABLE form_reads (
  code        TEXT    NOT NULL REFERENCES form_links (code) ON DELETE CASCADE,
  owner_id    TEXT    NOT NULL,
  seen_number INTEGER NOT NULL,
  PRIMARY KEY (code, owner_id)
);
CREATE INDEX form_reads_owner ON form_reads (owner_id);

-- Abuse reports against a form, one per browser.
CREATE TABLE form_reports (
  code       TEXT    NOT NULL REFERENCES form_links (code) ON DELETE CASCADE,
  browser    TEXT    NOT NULL,
  network    TEXT    NOT NULL,
  reason     TEXT    NOT NULL,
  note       TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (code, browser)
);

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
  scope      TEXT    NOT NULL DEFAULT 'project' CHECK (scope IN ('project', 'workspace')),
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
  scope       TEXT    NOT NULL DEFAULT 'project' CHECK (scope IN ('project', 'workspace'))
);
CREATE INDEX workbench_pairing_requests_expiry ON workbench_pairing_requests (expires_at);
CREATE UNIQUE INDEX workbench_pairing_requests_live
  ON workbench_pairing_requests (token_id, origin, scope) WHERE status = 'pending';

CREATE TABLE workbench_tickets (
  ticket_hash TEXT    PRIMARY KEY,
  owner_id    TEXT    NOT NULL,
  token_id    TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  pairing_id  TEXT    NOT NULL REFERENCES workbench_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL DEFAULT 'project' CHECK (scope IN ('project', 'workspace')),
  project_id TEXT    NULL REFERENCES projects (id) ON DELETE CASCADE,
  folder_id   TEXT    NULL,
  tab_id      TEXT    NULL,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER NULL,
  CHECK ((scope = 'project') = (project_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX workbench_tickets_project_idx ON workbench_tickets (project_id);
CREATE INDEX workbench_tickets_expiry ON workbench_tickets (expires_at);

CREATE TABLE workbench_sessions (
  id          TEXT    PRIMARY KEY,
  secret_hash TEXT    NOT NULL UNIQUE,
  owner_id    TEXT    NOT NULL,
  token_id    TEXT    NOT NULL REFERENCES api_tokens (id) ON DELETE CASCADE,
  pairing_id  TEXT    NOT NULL REFERENCES workbench_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL DEFAULT 'project' CHECK (scope IN ('project', 'workspace')),
  project_id TEXT    NULL REFERENCES projects (id) ON DELETE CASCADE,
  folder_id   TEXT    NULL,
  tab_id      TEXT    NULL,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('view', 'participate', 'edit')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  CHECK ((scope = 'project') = (project_id IS NOT NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX workbench_sessions_project_idx ON workbench_sessions (project_id);
CREATE INDEX workbench_sessions_expiry ON workbench_sessions (expires_at);
CREATE INDEX workbench_sessions_pairing ON workbench_sessions (pairing_id);

-- The projects a workspace-scoped session has opened rooms on, so revoking the session closes them.
CREATE TABLE workbench_session_rooms (
  session_id  TEXT NOT NULL REFERENCES workbench_sessions (id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, project_id)
);
CREATE INDEX workbench_session_rooms_project_idx ON workbench_session_rooms (project_id);
