-- livehuddle's Spaces in the index (Work Tracker #286, liveworkspace/docs/specs/004-index/blueprints/items.md
-- "Rebuilding items"): `items.app` takes `livehuddle` and `items.kind` takes `space`. SQLite can't change a CHECK in
-- place, so `items` is rebuilt with the same columns, rows and indexes. Written by hand.
--
-- `items` is the parent of twelve tables that cascade on delete (two more cascade from timeline_events), and D1 keeps
-- foreign keys on inside a migration. Renaming a child aside doesn't help: SQLite rewrites its REFERENCES to follow
-- the rename, so dropping the old `items` would still cascade into it. So each child's rows are copied aside into a
-- plain table (no keys, nothing references it), the children are dropped leaf first, `items` is rebuilt, and the
-- children are made again with the DDL they have today (0001, plus use_days.opens from 0007 and collab_forms.code
-- from 0004, kept last as ALTER TABLE left them) and refilled from the copies, parents before children. Every
-- statement is one plain INSERT ... SELECT: no compound SELECT, no bound parameters. Indexes are made after each
-- refill, which is cheaper than keeping them up row by row. D1 runs the file as one transaction: all of it or none.
--
-- folders, placement_defaults and every table that doesn't reference items are left alone.

-- 1. Copy every child aside.
CREATE TABLE aside_favourites AS SELECT * FROM favourites;
CREATE TABLE aside_opens AS SELECT * FROM opens;
CREATE TABLE aside_use_days AS SELECT * FROM use_days;
CREATE TABLE aside_timeline_events AS SELECT * FROM timeline_events;
CREATE TABLE aside_timeline_event_scopes AS SELECT * FROM timeline_event_scopes;
CREATE TABLE aside_timeline_dismissals AS SELECT * FROM timeline_dismissals;
CREATE TABLE aside_share_links AS SELECT * FROM share_links;
CREATE TABLE aside_share_passwords AS SELECT * FROM share_passwords;
CREATE TABLE aside_shared_with AS SELECT * FROM shared_with;
CREATE TABLE aside_collab_threads AS SELECT * FROM collab_threads;
CREATE TABLE aside_collab_thread_people AS SELECT * FROM collab_thread_people;
CREATE TABLE aside_collab_actions AS SELECT * FROM collab_actions;
CREATE TABLE aside_collab_forms AS SELECT * FROM collab_forms;
CREATE TABLE aside_collab_form_reads AS SELECT * FROM collab_form_reads;

-- 2. Drop the children, leaf first (a drop takes the table's indexes with it). Each drop deletes only its own rows,
-- which are safe in the copies, and nothing references the leaves.
DROP TABLE timeline_event_scopes;
DROP TABLE timeline_dismissals;
DROP TABLE timeline_events;
DROP TABLE favourites;
DROP TABLE opens;
DROP TABLE use_days;
DROP TABLE share_links;
DROP TABLE share_passwords;
DROP TABLE shared_with;
DROP TABLE collab_threads;
DROP TABLE collab_thread_people;
DROP TABLE collab_actions;
DROP TABLE collab_forms;
DROP TABLE collab_form_reads;

-- 3. Rebuild items. Nothing references it now, so dropping the old one cascades nowhere; its own reference to folders
-- is unchanged.
CREATE TABLE items_next (
  id           TEXT    PRIMARY KEY,
  app          TEXT    NOT NULL CHECK (app IN ('livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle')),
  kind         TEXT    NOT NULL CHECK (kind IN ('canvas', 'plan', 'document', 'design', 'space')),
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
);
INSERT INTO items_next (id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary, created_at,
                        updated_at, trashed_at, trash_reason, empty_swept_for)
  SELECT id, app, kind, owner_id, team_id, scope, folder_id, title, source, intent, summary, created_at, updated_at,
         trashed_at, trash_reason, empty_swept_for
  FROM items;
DROP TABLE items;
ALTER TABLE items_next RENAME TO items;
-- The same eight indexes 0001 made (what each serves is said there).
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

-- 4. The children again, as they are today, each refilled from its copy and then indexed.
CREATE TABLE favourites (
  person_id  TEXT    NOT NULL,
  item_id    TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id)
);
INSERT INTO favourites (person_id, item_id, created_at)
  SELECT person_id, item_id, created_at FROM aside_favourites;
CREATE INDEX favourites_person_created ON favourites (person_id, created_at DESC, item_id DESC);
CREATE INDEX favourites_item ON favourites (item_id);

CREATE TABLE opens (
  person_id      TEXT    NOT NULL,
  item_id        TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  last_opened_at INTEGER NOT NULL,
  hidden         INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  PRIMARY KEY (person_id, item_id)
);
INSERT INTO opens (person_id, item_id, last_opened_at, hidden)
  SELECT person_id, item_id, last_opened_at, hidden FROM aside_opens;
CREATE INDEX opens_recent ON opens (person_id, last_opened_at DESC, item_id DESC) WHERE hidden = 0;
CREATE INDEX opens_item ON opens (item_id);

CREATE TABLE use_days (
  person_id TEXT    NOT NULL,
  item_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  day       INTEGER NOT NULL,
  -- How many times the person opened it that day (0007).
  opens     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (person_id, item_id, day)
);
INSERT INTO use_days (person_id, item_id, day, opens)
  SELECT person_id, item_id, day, opens FROM aside_use_days;
CREATE INDEX use_days_person_day ON use_days (person_id, day);
CREATE INDEX use_days_item ON use_days (item_id);

CREATE TABLE timeline_events (
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
INSERT INTO timeline_events (id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at)
  SELECT id, app, item_id, actor_id, actor_name, type, title, detail, occurred_at FROM aside_timeline_events;
CREATE INDEX timeline_events_item ON timeline_events (item_id, occurred_at DESC);
CREATE INDEX timeline_events_actor ON timeline_events (actor_id);

CREATE TABLE timeline_event_scopes (
  scope       TEXT    NOT NULL,
  event_id    TEXT    NOT NULL REFERENCES timeline_events (id) ON DELETE CASCADE,
  app         TEXT    NOT NULL,
  occurred_at INTEGER NOT NULL,
  PRIMARY KEY (scope, event_id)
);
INSERT INTO timeline_event_scopes (scope, event_id, app, occurred_at)
  SELECT scope, event_id, app, occurred_at FROM aside_timeline_event_scopes;
CREATE INDEX timeline_scopes_app ON timeline_event_scopes (scope, app, occurred_at DESC, event_id DESC);
CREATE INDEX timeline_scopes_all ON timeline_event_scopes (scope, occurred_at DESC, event_id DESC);
CREATE INDEX timeline_scopes_event ON timeline_event_scopes (event_id);

CREATE TABLE timeline_dismissals (
  person_id  TEXT    NOT NULL,
  event_id   TEXT    NOT NULL REFERENCES timeline_events (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (person_id, event_id)
);
INSERT INTO timeline_dismissals (person_id, event_id, created_at)
  SELECT person_id, event_id, created_at FROM aside_timeline_dismissals;
CREATE INDEX timeline_dismissals_event ON timeline_dismissals (event_id);

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
  SELECT code, item_id, level, tab_id, expiry, expires_at, created_at, public FROM aside_share_links;
CREATE INDEX share_links_item ON share_links (item_id, created_at);
CREATE INDEX share_links_expires ON share_links (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE share_passwords (
  item_id    TEXT    PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
  hash       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO share_passwords (item_id, hash, updated_at)
  SELECT item_id, hash, updated_at FROM aside_share_passwords;

CREATE TABLE shared_with (
  person_id  TEXT    NOT NULL,
  item_id    TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  share_code TEXT    NOT NULL,
  last_seen  INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id)
);
INSERT INTO shared_with (person_id, item_id, share_code, last_seen)
  SELECT person_id, item_id, share_code, last_seen FROM aside_shared_with;
CREATE INDEX shared_with_person_seen ON shared_with (person_id, last_seen DESC, item_id DESC);
CREATE INDEX shared_with_item_code ON shared_with (item_id, share_code);

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
  latest_at           INTEGER NOT NULL,
  PRIMARY KEY (app, item_id, tab_id, element_id)
);
INSERT INTO collab_threads (app, item_id, tab_id, tab_name, element_id, element_label, resolved, comment_count,
                            participant_ids, mentioned_ids, latest_text, latest_author_name, latest_author_color, card,
                            first_at, latest_at)
  SELECT app, item_id, tab_id, tab_name, element_id, element_label, resolved, comment_count, participant_ids,
         mentioned_ids, latest_text, latest_author_name, latest_author_color, card, first_at, latest_at
  FROM aside_collab_threads;
CREATE INDEX collab_threads_item ON collab_threads (item_id, tab_id, resolved, latest_at DESC);

CREATE TABLE collab_thread_people (
  app        TEXT NOT NULL,
  item_id    TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id     TEXT NOT NULL,
  element_id TEXT NOT NULL,
  person_id  TEXT NOT NULL,
  PRIMARY KEY (person_id, app, item_id, tab_id, element_id)
);
INSERT INTO collab_thread_people (app, item_id, tab_id, element_id, person_id)
  SELECT app, item_id, tab_id, element_id, person_id FROM aside_collab_thread_people;
CREATE INDEX collab_thread_people_item ON collab_thread_people (item_id, tab_id);

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
                            status, assignee_id, assignee_name, assigner_id, assigner_name, team_id, card, created_at,
                            updated_at)
  SELECT app, item_id, tab_id, tab_name, element_id, action_id, element_label, name, description, status, assignee_id,
         assignee_name, assigner_id, assigner_name, team_id, card, created_at, updated_at
  FROM aside_collab_actions;
CREATE INDEX collab_actions_item ON collab_actions (item_id, tab_id);
CREATE INDEX collab_actions_assignee ON collab_actions (assignee_id, status, updated_at DESC);
CREATE INDEX collab_actions_assigner ON collab_actions (assigner_id, status, updated_at DESC);

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
  SELECT app, item_id, tab_id, heading, board_tab_id, responses, latest_at, code FROM aside_collab_forms;
CREATE UNIQUE INDEX collab_forms_code ON collab_forms (code) WHERE code IS NOT NULL;

CREATE TABLE collab_form_reads (
  person_id TEXT    NOT NULL,
  item_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id    TEXT    NOT NULL,
  seen      INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id, tab_id)
);
INSERT INTO collab_form_reads (person_id, item_id, tab_id, seen)
  SELECT person_id, item_id, tab_id, seen FROM aside_collab_form_reads;
CREATE INDEX collab_form_reads_item ON collab_form_reads (item_id);

-- 5. The copies go.
DROP TABLE aside_favourites;
DROP TABLE aside_opens;
DROP TABLE aside_use_days;
DROP TABLE aside_timeline_events;
DROP TABLE aside_timeline_event_scopes;
DROP TABLE aside_timeline_dismissals;
DROP TABLE aside_share_links;
DROP TABLE aside_share_passwords;
DROP TABLE aside_shared_with;
DROP TABLE aside_collab_threads;
DROP TABLE aside_collab_thread_people;
DROP TABLE aside_collab_actions;
DROP TABLE aside_collab_forms;
DROP TABLE aside_collab_form_reads;
