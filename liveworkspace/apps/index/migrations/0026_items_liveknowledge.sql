-- liveknowledge's Knowledgebases in the index (liveknowledge/docs/specs/016-platform/platform-registration.md,
-- liveworkspace/docs/specs/004-index/blueprints/items.md "Rebuilding items"): `items.app` takes `liveknowledge` and
-- `items.kind` takes `knowledgebase`. SQLite can't change a CHECK in place, so `items` is rebuilt with the same
-- columns, rows and indexes, the way 0009_items_livehuddle.sql did it.
--
-- `items` is the parent of 17 tables that cascade on delete, directly or through another of them
-- (access_requests, approvals, collab_actions, collab_form_reads, collab_forms, collab_thread_people, collab_threads,
-- events, opens, share_links, share_passwords, shared_with, use_days, webhooks, approval_people, connections,
-- webhook_deliveries),
-- and D1 keeps foreign keys on inside a migration. So each child's rows are copied aside into a plain table (no keys,
-- nothing references it), the children are dropped leaf first, `items` is rebuilt, and the children are made again
-- with the DDL they have today (columns a later ALTER TABLE added kept last, where they are) and refilled from the
-- copies, parents before children. Every statement is one plain INSERT ... SELECT or DDL: no compound SELECT, no bound
-- parameters. Indexes are made after each refill. D1 runs the file as one transaction: all of it or none.
--
-- Every table that doesn't reference items is left alone. Rehearse on a copy of production before this deploys
-- (items.md "Rebuilding items": node scripts/items-rebuild-counts.ts rehearse prod.sql).

-- 1. Copy every child aside.
CREATE TABLE aside_access_requests AS SELECT * FROM access_requests;
CREATE TABLE aside_approvals AS SELECT * FROM approvals;
CREATE TABLE aside_collab_actions AS SELECT * FROM collab_actions;
CREATE TABLE aside_collab_form_reads AS SELECT * FROM collab_form_reads;
CREATE TABLE aside_collab_forms AS SELECT * FROM collab_forms;
CREATE TABLE aside_collab_thread_people AS SELECT * FROM collab_thread_people;
CREATE TABLE aside_collab_threads AS SELECT * FROM collab_threads;
CREATE TABLE aside_events AS SELECT * FROM events;
CREATE TABLE aside_opens AS SELECT * FROM opens;
CREATE TABLE aside_share_links AS SELECT * FROM share_links;
CREATE TABLE aside_share_passwords AS SELECT * FROM share_passwords;
CREATE TABLE aside_shared_with AS SELECT * FROM shared_with;
CREATE TABLE aside_use_days AS SELECT * FROM use_days;
CREATE TABLE aside_webhooks AS SELECT * FROM webhooks;
CREATE TABLE aside_approval_people AS SELECT * FROM approval_people;
CREATE TABLE aside_connections AS SELECT * FROM connections;
CREATE TABLE aside_webhook_deliveries AS SELECT * FROM webhook_deliveries;

-- 2. Drop the children, leaf first (a drop takes the table's indexes with it). Each drop deletes only its own rows,
-- which are safe in the copies.
DROP TABLE webhook_deliveries;
DROP TABLE connections;
DROP TABLE approval_people;
DROP TABLE webhooks;
DROP TABLE use_days;
DROP TABLE shared_with;
DROP TABLE share_passwords;
DROP TABLE share_links;
DROP TABLE opens;
DROP TABLE events;
DROP TABLE collab_threads;
DROP TABLE collab_thread_people;
DROP TABLE collab_forms;
DROP TABLE collab_form_reads;
DROP TABLE collab_actions;
DROP TABLE approvals;
DROP TABLE access_requests;

-- 3. Rebuild items. Nothing references it now, so dropping the old one cascades nowhere; its own reference to folders
-- is unchanged.
CREATE TABLE items_next (
  id           TEXT    PRIMARY KEY,
  app          TEXT    NOT NULL CHECK (app IN ('livediagram', 'liveplanner', 'livedocuments', 'livedesign',
                                               'livehuddle', 'liveknowledge')),
  kind         TEXT    NOT NULL CHECK (kind IN ('canvas', 'plan', 'document', 'design', 'space', 'knowledgebase')),
  owner_id     TEXT    NOT NULL,
  team_id      TEXT    NULL,
  scope        TEXT    NOT NULL,
  -- Deleting a folder moves its items up a level first; SET NULL only guards the root.
  folder_id    TEXT    NULL REFERENCES folders (id) ON DELETE SET NULL,
  title        TEXT    NOT NULL,
  source       TEXT    NULL CHECK (source IS NULL OR source IN ('person', 'ai', 'import', 'template')),
  intent       TEXT    NULL,
  -- What the item last pushed about its content (JSON, at most 2 KB): counts, mode, thumbnail key.
  summary      TEXT    NOT NULL DEFAULT '{}',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  -- In the Trash since; the daily sweep purges it 30 days on.
  trashed_at   INTEGER NULL,
  trash_reason TEXT    NULL CHECK (trash_reason IS NULL OR trash_reason IN ('deleted', 'empty')),
  -- The updated_at the empty clean-up last moved it to the Trash for: restored unchanged, it is not moved again.
  empty_swept_for INTEGER NULL
, archived_at INTEGER NULL, content_at INTEGER NULL);
INSERT INTO items_next (id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary,
                        created_at, updated_at, trashed_at, trash_reason, empty_swept_for, archived_at, content_at)
  SELECT id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary, created_at, updated_at,
         trashed_at, trash_reason, empty_swept_for, archived_at, content_at
  FROM items;
DROP TABLE items;
ALTER TABLE items_next RENAME TO items;
CREATE INDEX items_live ON items (scope, updated_at DESC, id DESC) WHERE trashed_at IS NULL;
CREATE INDEX items_live_app ON items (scope, app, updated_at DESC, id DESC) WHERE trashed_at IS NULL;
CREATE INDEX items_trash ON items (scope, updated_at DESC, id DESC) WHERE trashed_at IS NOT NULL;
CREATE INDEX items_unsorted ON items (scope, updated_at DESC, id DESC)
  WHERE trashed_at IS NULL AND folder_id IS NULL;
CREATE INDEX items_folder ON items (folder_id, updated_at DESC, id DESC) WHERE folder_id IS NOT NULL;
CREATE INDEX items_trashed_at ON items (trashed_at) WHERE trashed_at IS NOT NULL;
CREATE INDEX items_empty ON items (updated_at)
  WHERE trashed_at IS NULL AND (summary = '{}' OR json_extract(summary, '$.hasContent') = 0);
CREATE INDEX items_owner ON items (owner_id);
CREATE INDEX items_new ON items (scope, created_at DESC, id DESC) WHERE trashed_at IS NULL;
CREATE INDEX items_new_app ON items (scope, app, created_at DESC, id DESC) WHERE trashed_at IS NULL;

-- 4. Make each child again, as it stands today, and refill it from its copy: parents before children.

CREATE TABLE access_requests (
  id             TEXT    PRIMARY KEY,
  item_id        TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  -- The account asking; its rows go when it closes.
  requester_id   TEXT    NOT NULL,
  -- Their name as accounts gave it when they asked, for the Inbox; null when it couldn't say.
  requester_name TEXT    NULL,
  note           TEXT    NULL,
  state          TEXT    NOT NULL CHECK (state IN ('open', 'granted', 'declined')),
  asked_at       INTEGER NOT NULL,
  -- When the managers were last emailed about it: the item's day's email limit counts these.
  emailed_at     INTEGER NULL,
  closed_at      INTEGER NULL,
  -- The share link a grant made (no key: a deleted link leaves the row as it was).
  share_code     TEXT    NULL
);
INSERT INTO access_requests (id, item_id, requester_id, requester_name, note, state, asked_at, emailed_at, closed_at,
                             share_code)
  SELECT id, item_id, requester_id, requester_name, note, state, asked_at, emailed_at, closed_at, share_code
  FROM aside_access_requests;
CREATE UNIQUE INDEX access_requests_person_item ON access_requests (requester_id, item_id);
CREATE INDEX access_requests_item ON access_requests (item_id, state, asked_at DESC);
CREATE INDEX access_requests_item_emailed ON access_requests (item_id, emailed_at) WHERE emailed_at IS NOT NULL;

CREATE TABLE approvals (
  id           TEXT    PRIMARY KEY,
  item_id      TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  -- Who asked; `deleted` once their account closes.
  requested_by TEXT    NOT NULL,
  note         TEXT    NULL,
  -- The day hoped for, YYYY-MM-DD.
  due_day      TEXT    NULL,
  -- The snapshot the editor took of the item as it was asked about (the item's own, 014-snapshots).
  snapshot_id  TEXT    NULL,
  -- open, approved or cancelled.
  state        TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  -- When it was approved (the last approval) or cancelled.
  closed_at    INTEGER NULL
);
INSERT INTO approvals (id, item_id, requested_by, note, due_day, snapshot_id, state, created_at, closed_at)
  SELECT id, item_id, requested_by, note, due_day, snapshot_id, state, created_at, closed_at
  FROM aside_approvals;
CREATE INDEX approvals_item ON approvals (item_id, created_at DESC);
CREATE UNIQUE INDEX approvals_open ON approvals (item_id) WHERE state = 'open';
CREATE INDEX approvals_requester ON approvals (requested_by);

CREATE TABLE collab_actions (
  app           TEXT    NOT NULL,
  item_id       TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id        TEXT    NOT NULL,
  tab_name      TEXT    NOT NULL DEFAULT '',
  element_id    TEXT    NOT NULL,
  action_id     TEXT    NOT NULL,
  element_label TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  status        TEXT    NOT NULL CHECK (status IN ('open', 'done', 'wont-do')),
  assignee_id   TEXT    NULL,
  assignee_name TEXT    NULL,
  assigner_id   TEXT    NOT NULL,
  assigner_name TEXT    NULL,
  team_id       TEXT    NULL,
  card          TEXT    NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (app, item_id, tab_id, element_id, action_id)
);
INSERT INTO collab_actions (app, item_id, tab_id, tab_name, element_id, action_id, element_label, name, description,
                            status, assignee_id, assignee_name, assigner_id, assigner_name, team_id, card,
                            created_at, updated_at)
  SELECT app, item_id, tab_id, tab_name, element_id, action_id, element_label, name, description, status,
         assignee_id, assignee_name, assigner_id, assigner_name, team_id, card, created_at, updated_at
  FROM aside_collab_actions;
CREATE INDEX collab_actions_item ON collab_actions (item_id, tab_id);
CREATE INDEX collab_actions_assignee ON collab_actions (assignee_id, status, updated_at DESC);
CREATE INDEX collab_actions_assigner ON collab_actions (assigner_id, status, updated_at DESC);

CREATE TABLE collab_form_reads (
  person_id TEXT    NOT NULL,
  item_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id    TEXT    NOT NULL,
  seen      INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id, tab_id)
);
INSERT INTO collab_form_reads (person_id, item_id, tab_id, seen)
  SELECT person_id, item_id, tab_id, seen
  FROM aside_collab_form_reads;
CREATE INDEX collab_form_reads_item ON collab_form_reads (item_id);

CREATE TABLE collab_forms (
  app          TEXT    NOT NULL,
  item_id      TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id       TEXT    NOT NULL,
  heading      TEXT    NOT NULL,
  board_tab_id TEXT    NULL,
  responses    INTEGER NOT NULL,
  latest_at    INTEGER NOT NULL,
  -- A live form's public code (0004).
  code         TEXT    NULL,
  PRIMARY KEY (item_id, tab_id)
);
INSERT INTO collab_forms (app, item_id, tab_id, heading, board_tab_id, responses, latest_at, code)
  SELECT app, item_id, tab_id, heading, board_tab_id, responses, latest_at, code
  FROM aside_collab_forms;
CREATE UNIQUE INDEX collab_forms_code ON collab_forms (code) WHERE code IS NOT NULL;

CREATE TABLE collab_thread_people (
  app        TEXT NOT NULL,
  item_id    TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id     TEXT NOT NULL,
  element_id TEXT NOT NULL,
  person_id  TEXT NOT NULL,
  PRIMARY KEY (person_id, app, item_id, tab_id, element_id)
);
INSERT INTO collab_thread_people (app, item_id, tab_id, element_id, person_id)
  SELECT app, item_id, tab_id, element_id, person_id
  FROM aside_collab_thread_people;
CREATE INDEX collab_thread_people_item ON collab_thread_people (item_id, tab_id);

CREATE TABLE collab_threads (
  app                 TEXT    NOT NULL,
  item_id             TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id              TEXT    NOT NULL,
  tab_name            TEXT    NOT NULL DEFAULT '',
  element_id          TEXT    NOT NULL,
  element_label       TEXT    NOT NULL,
  resolved            INTEGER NOT NULL,
  comment_count       INTEGER NOT NULL,
  participant_ids     TEXT    NOT NULL DEFAULT '[]',
  mentioned_ids       TEXT    NOT NULL DEFAULT '[]',
  latest_text         TEXT    NOT NULL,
  latest_author_name  TEXT    NOT NULL,
  latest_author_color TEXT    NOT NULL DEFAULT '',
  card                TEXT    NULL,
  first_at            INTEGER NOT NULL,
  latest_at           INTEGER NOT NULL, latest_author_id TEXT NULL, mentioned_by TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (app, item_id, tab_id, element_id)
);
INSERT INTO collab_threads (app, item_id, tab_id, tab_name, element_id, element_label, resolved, comment_count,
                            participant_ids, mentioned_ids, latest_text, latest_author_name, latest_author_color,
                            card, first_at, latest_at, latest_author_id, mentioned_by)
  SELECT app, item_id, tab_id, tab_name, element_id, element_label, resolved, comment_count, participant_ids,
         mentioned_ids, latest_text, latest_author_name, latest_author_color, card, first_at, latest_at,
         latest_author_id, mentioned_by
  FROM aside_collab_threads;
CREATE INDEX collab_threads_item ON collab_threads (item_id, tab_id, resolved, latest_at DESC);

CREATE TABLE events (
  id          TEXT    PRIMARY KEY,
  app         TEXT    NOT NULL,
  item_id     TEXT    NULL REFERENCES items (id) ON DELETE CASCADE,
  -- An account or guest id, or 'deleted' once their account is closed.
  actor_id    TEXT,
  actor_name  TEXT,
  type        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  detail      TEXT,
  occurred_at INTEGER NOT NULL
);
INSERT INTO events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at)
  SELECT id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at
  FROM aside_events;
CREATE INDEX events_item ON events (item_id, occurred_at DESC, id DESC);
CREATE INDEX events_actor ON events (actor_id);
CREATE INDEX events_occurred ON events (occurred_at);

CREATE TABLE opens (
  person_id      TEXT    NOT NULL,
  item_id        TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  last_opened_at INTEGER NOT NULL,
  hidden         INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  PRIMARY KEY (person_id, item_id)
);
INSERT INTO opens (person_id, item_id, last_opened_at, hidden)
  SELECT person_id, item_id, last_opened_at, hidden
  FROM aside_opens;
CREATE INDEX opens_recent ON opens (person_id, last_opened_at DESC, item_id DESC) WHERE hidden = 0;
CREATE INDEX opens_item ON opens (item_id);

CREATE TABLE share_links (
  code       TEXT    PRIMARY KEY,
  item_id    TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  level      TEXT    NOT NULL CHECK (level IN ('view', 'participate', 'edit')),
  tab_id     TEXT    NULL,
  expiry     TEXT    NOT NULL DEFAULT 'never' CHECK (expiry IN ('never', 'week', 'month', 'sixMonths')),
  expires_at INTEGER NULL,
  created_at INTEGER NOT NULL,
  -- A public link (a Community post's): it never asks for the item's share password, and while one is set it
  -- opens nothing, as if closed.
  public     INTEGER NOT NULL DEFAULT 0 CHECK (public IN (0, 1))
);
INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at, public)
  SELECT code, item_id, level, tab_id, expiry, expires_at, created_at, public
  FROM aside_share_links;
CREATE INDEX share_links_item ON share_links (item_id, created_at);
CREATE INDEX share_links_expires ON share_links (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE share_passwords (
  item_id    TEXT    PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
  hash       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO share_passwords (item_id, hash, updated_at)
  SELECT item_id, hash, updated_at
  FROM aside_share_passwords;

CREATE TABLE shared_with (
  person_id  TEXT    NOT NULL,
  item_id    TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  share_code TEXT    NOT NULL,
  last_seen  INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id)
);
INSERT INTO shared_with (person_id, item_id, share_code, last_seen)
  SELECT person_id, item_id, share_code, last_seen
  FROM aside_shared_with;
CREATE INDEX shared_with_person_seen ON shared_with (person_id, last_seen DESC, item_id DESC);
CREATE INDEX shared_with_item_code ON shared_with (item_id, share_code);

CREATE TABLE use_days (
  person_id TEXT    NOT NULL,
  item_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  day       INTEGER NOT NULL,
  -- How many times the person opened it that day (0007).
  opens     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (person_id, item_id, day)
);
INSERT INTO use_days (person_id, item_id, day, opens)
  SELECT person_id, item_id, day, opens
  FROM aside_use_days;
CREATE INDEX use_days_person_day ON use_days (person_id, day);
CREATE INDEX use_days_item ON use_days (item_id);

CREATE TABLE webhooks (
  id            TEXT    PRIMARY KEY,
  item_id       TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL CHECK (kind IN ('json', 'slack', 'teams')),
  name          TEXT    NOT NULL,
  url_sealed    TEXT    NOT NULL,
  host          TEXT    NOT NULL,
  secret_sealed TEXT,
  events        TEXT    NOT NULL,
  who           TEXT    NOT NULL DEFAULT 'anyone' CHECK (who IN ('anyone', 'me')),
  created_by    TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  paused_at     INTEGER,
  paused_reason TEXT,
  -- Deliveries given up in a row; 20 pauses it.
  failures      INTEGER NOT NULL DEFAULT 0
);
INSERT INTO webhooks (id, item_id, kind, name, url_sealed, host, secret_sealed, events, who, created_by, created_at,
                      paused_at, paused_reason, failures)
  SELECT id, item_id, kind, name, url_sealed, host, secret_sealed, events, who, created_by, created_at, paused_at,
         paused_reason, failures
  FROM aside_webhooks;
CREATE INDEX webhooks_item_live ON webhooks (item_id) WHERE paused_at IS NULL;
CREATE INDEX webhooks_item ON webhooks (item_id, created_at);
CREATE INDEX webhooks_creator ON webhooks (created_by);

CREATE TABLE approval_people (
  approval_id TEXT    NOT NULL REFERENCES approvals (id) ON DELETE CASCADE,
  -- An account; `deleted` once it closes.
  person_id   TEXT    NOT NULL,
  position    INTEGER NOT NULL,
  -- pending, approved or changes_requested.
  decision    TEXT    NOT NULL DEFAULT 'pending',
  note        TEXT    NULL,
  decided_at  INTEGER NULL,
  PRIMARY KEY (approval_id, person_id)
);
INSERT INTO approval_people (approval_id, person_id, position, decision, note, decided_at)
  SELECT approval_id, person_id, position, decision, note, decided_at
  FROM aside_approval_people;
CREATE INDEX approval_people_person ON approval_people (person_id);

CREATE TABLE connections (
  -- `cn_` and 24 random letters and digits (IDX22).
  id             TEXT    PRIMARY KEY,
  -- The host goes, its connected tabs go.
  host_item_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  -- The tab in the host holding it. Null only while a reverse (both ways) waits for the target app's answer.
  host_tab_id    TEXT    NULL,
  -- Null once the target is purged: the row stays so its tab says the file is no longer there.
  target_item_id TEXT    NULL REFERENCES items (id) ON DELETE SET NULL,
  -- The pass: a share link on the target. Null once it is deleted (from Share, or with the target), so the tab offers
  -- Connect Again.
  share_code     TEXT    NULL REFERENCES share_links (code) ON DELETE SET NULL,
  -- The other connection made with it both ways; null when there is none or it went.
  pair_id        TEXT    NULL REFERENCES connections (id) ON DELETE SET NULL,
  created_at     INTEGER NOT NULL,
  -- When the host app said the tab is in; still null an hour on, the sweep takes it and its pass back (IDX27).
  confirmed_at   INTEGER NULL
);
INSERT INTO connections (id, host_item_id, host_tab_id, target_item_id, share_code, pair_id, created_at,
                         confirmed_at)
  SELECT id, host_item_id, host_tab_id, target_item_id, share_code, pair_id, created_at, confirmed_at
  FROM aside_connections;
CREATE INDEX connections_host ON connections (host_item_id, host_tab_id);
CREATE INDEX connections_target ON connections (target_item_id);
CREATE INDEX connections_code ON connections (share_code);
CREATE INDEX connections_pair ON connections (pair_id);
CREATE INDEX connections_unconfirmed ON connections (created_at) WHERE confirmed_at IS NULL;

CREATE TABLE webhook_deliveries (
  id           INTEGER PRIMARY KEY,
  webhook_id   TEXT    NOT NULL REFERENCES webhooks (id) ON DELETE CASCADE,
  event_id     TEXT    NOT NULL,
  type         TEXT    NOT NULL,
  app          TEXT    NOT NULL,
  item_id      TEXT,
  title        TEXT    NOT NULL,
  actor_id     TEXT,
  actor_name   TEXT,
  detail       TEXT,
  occurred_at  INTEGER NOT NULL,
  state        TEXT    NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'delivered', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  next_at      INTEGER NOT NULL,
  status       INTEGER,
  error        TEXT,
  last_at      INTEGER,
  UNIQUE (webhook_id, event_id)
);
INSERT INTO webhook_deliveries (id, webhook_id, event_id, type, app, item_id, title, actor_id, actor_name, detail,
                                occurred_at, state, attempts, next_at, status, error, last_at)
  SELECT id, webhook_id, event_id, type, app, item_id, title, actor_id, actor_name, detail, occurred_at, state,
         attempts, next_at, status, error, last_at
  FROM aside_webhook_deliveries;
CREATE INDEX webhook_deliveries_due ON webhook_deliveries (next_at) WHERE state = 'pending';
CREATE INDEX webhook_deliveries_webhook ON webhook_deliveries (webhook_id, state, id);

-- 5. Drop the copies.
DROP TABLE aside_access_requests;
DROP TABLE aside_approvals;
DROP TABLE aside_collab_actions;
DROP TABLE aside_collab_form_reads;
DROP TABLE aside_collab_forms;
DROP TABLE aside_collab_thread_people;
DROP TABLE aside_collab_threads;
DROP TABLE aside_events;
DROP TABLE aside_opens;
DROP TABLE aside_share_links;
DROP TABLE aside_share_passwords;
DROP TABLE aside_shared_with;
DROP TABLE aside_use_days;
DROP TABLE aside_webhooks;
DROP TABLE aside_approval_people;
DROP TABLE aside_connections;
DROP TABLE aside_webhook_deliveries;
