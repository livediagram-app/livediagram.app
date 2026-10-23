-- liveplanner's baseline schema (docs/specs/015-api/api.md "Storage"): every table the api worker reads and writes,
-- in one migration. It replaces the hundred-odd migrations inherited from livediagram: nothing was deployed, so
-- there is no older database to bring forward. A later change is a new numbered migration after this one.
--
-- Times are epoch milliseconds (INTEGER). JSON lives in TEXT columns. An owner id is a liveworkspace account id
-- (`user_…`) or guest id (`guest_…`, docs/specs/014-identity/auth-and-guest-access.md).
--
-- Where a plan is and who may reach it (its title, folder, team, Trash state, share links, favourites, tags, opens,
-- and the Inbox's comments and actions) is liveworkspace's index (liveworkspace/docs/one-explorer.md), never here;
-- a plan's content is its own Durable Object (src/plan-room/plan-schema.ts). A person's settings, name and colour,
-- sign-ups, onboarding emails and API tokens are the liveworkspace accounts Worker's (liveworkspace/docs/accounts.md),
-- and a person's workbench is their own Durable Object (src/workbench-store.ts). What is left is form links.

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
