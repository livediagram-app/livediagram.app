-- liveplanner's baseline schema (docs/specs/015-api/api.md "Storage"): every table the api worker reads and writes,
-- in one migration. It replaces the hundred-odd migrations inherited from livediagram: nothing was deployed, so
-- there is no older database to bring forward. A later change is a new numbered migration after this one.
--
-- Times are epoch milliseconds (INTEGER). JSON lives in TEXT columns. An owner id is a liveworkspace account id
-- (`user_…`) or guest id (`guest_…`, docs/specs/014-identity/auth-and-guest-access.md).
--
-- Where a plan is and who may reach it (its title, folder, team, Trash state, share links, favourites, tags, opens,
-- and the Inbox's comments and actions) is liveworkspace's index (liveworkspace/docs/one-explorer.md), never here;
-- a plan's content is its own Durable Object (src/plan-room/plan-schema.ts). What is left is people and their
-- settings, form links and workbench embeds.

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
  send_attempts       INTEGER NOT NULL DEFAULT 0,
  last_attempt_at     INTEGER,
  -- The newest save on any plan the person owns (epoch ms), stamped by the plan's summary push (at most once a
  -- minute a plan): NULL until they first make something. The activation nudge and win-back read it.
  active_at           INTEGER
);
CREATE INDEX idx_email_lifecycle_due ON email_lifecycle (created_at);


-- ---------------------------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------------------------

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
-- Forms (docs/specs/030-forms/forms.md)
-- ---------------------------------------------------------------------------------------------------------------

-- A Form tab's published link. A purged plan's links go with it (routes/internal-items.ts).
CREATE TABLE form_links (
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
  project_id  TEXT    NULL,
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
  project_id  TEXT    NULL,
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
  project_id TEXT NOT NULL,
  PRIMARY KEY (session_id, project_id)
);
CREATE INDEX workbench_session_rooms_project_idx ON workbench_session_rooms (project_id);
