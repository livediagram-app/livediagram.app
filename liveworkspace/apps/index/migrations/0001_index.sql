-- The One Explorer index (liveworkspace/docs/index-service.md, liveworkspace/docs/one-explorer-contracts.md):
-- one row per Canvas, Plan, Document and Design across every app, and everything about it except its
-- content, which stays in the item's own Durable Object in its app. Nothing here keeps a copy of teams:
-- membership comes from the `teams` claim of the caller's access token.
--
-- `scope` is the space an item or folder lives in: `p:<owner id>` for a person's own, `t:<team id>` for a
-- team's. Every Explorer list walks an index that starts with it, so a person's lists cost what they hold
-- whatever the table's size.

CREATE TABLE folders (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  -- NULL: the scope's root. Same scope as this folder, which the service checks.
  parent_id  TEXT    NULL REFERENCES folders (id) ON DELETE SET NULL,
  owner_id   TEXT    NOT NULL,
  team_id    TEXT    NULL,
  scope      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- A scope's tree, paged in the order folders were made; also where folder-name search looks.
CREATE INDEX folders_scope ON folders (scope, created_at, id);
CREATE INDEX folders_parent ON folders (parent_id);
CREATE INDEX folders_owner ON folders (owner_id);

CREATE TABLE items (
  id           TEXT    PRIMARY KEY,
  app          TEXT    NOT NULL CHECK (app IN ('livediagram', 'liveplanner', 'livedocuments', 'livedesign')),
  kind         TEXT    NOT NULL CHECK (kind IN ('canvas', 'plan', 'document', 'design')),
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
  trash_reason TEXT    NULL CHECK (trash_reason IS NULL OR trash_reason IN ('deleted', 'empty'))
);
-- All, Unsorted and a team's list: live items in a scope, newest change first.
CREATE INDEX items_live ON items (scope, updated_at DESC, id DESC) WHERE trashed_at IS NULL;
-- The same, filtered to one app (each app's Explorer opens on its own items).
CREATE INDEX items_live_app ON items (scope, app, updated_at DESC, id DESC) WHERE trashed_at IS NULL;
-- The Trash.
CREATE INDEX items_trash ON items (scope, updated_at DESC, id DESC) WHERE trashed_at IS NOT NULL;
-- Unsorted: live items in no folder.
CREATE INDEX items_unsorted ON items (scope, updated_at DESC, id DESC)
  WHERE trashed_at IS NULL AND folder_id IS NULL;
-- A folder's items, and moving them up when it is deleted. Partial, so Unsorted (folder_id IS NULL, most
-- items) can never walk it across every person.
CREATE INDEX items_folder ON items (folder_id, updated_at DESC, id DESC) WHERE folder_id IS NOT NULL;
-- The daily sweep of items 30 days in the Trash.
CREATE INDEX items_trashed_at ON items (trashed_at) WHERE trashed_at IS NOT NULL;
-- A guest's items on merge, and the Inbox's "threads on my items".
CREATE INDEX items_owner ON items (owner_id);

-- Personal tags: a person's own labels, on any item they can reach.
CREATE TABLE tags (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  colour     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX tags_owner_name ON tags (owner_id, name COLLATE NOCASE);

CREATE TABLE item_tags (
  tag_id     TEXT    NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  item_id    TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (tag_id, item_id)
);
CREATE INDEX item_tags_item ON item_tags (item_id);

CREATE TABLE favourites (
  person_id  TEXT    NOT NULL,
  item_id    TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id)
);
CREATE INDEX favourites_person_created ON favourites (person_id, created_at DESC, item_id DESC);
CREATE INDEX favourites_item ON favourites (item_id);

-- When each person last opened each item: Recent. Written at most once a minute per pair.
CREATE TABLE opens (
  person_id      TEXT    NOT NULL,
  item_id        TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  last_opened_at INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id)
);
CREATE INDEX opens_recent ON opens (person_id, last_opened_at DESC, item_id DESC);
CREATE INDEX opens_item ON opens (item_id);

-- Share links, as the apps have them today. A link whose `expires_at` has passed opens nothing but stays
-- listed for its owner to extend or delete.
CREATE TABLE share_links (
  code       TEXT    PRIMARY KEY,
  item_id    TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  level      TEXT    NOT NULL CHECK (level IN ('view', 'participate', 'edit')),
  tab_id     TEXT    NULL,
  expiry     TEXT    NOT NULL DEFAULT 'never' CHECK (expiry IN ('never', 'week', 'month', 'sixMonths')),
  expires_at INTEGER NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX share_links_item ON share_links (item_id, created_at);

-- An item's share password: only its PBKDF2 hash (`pbkdf2-sha256$<iterations>$<salt>$<hash>`, as
-- liveplanner stores it).
CREATE TABLE share_passwords (
  item_id    TEXT    PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
  hash       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The items shared with a person through a link they opened: Shared with me. Reaching the item still
-- needs that link to be live.
CREATE TABLE shared_with (
  person_id  TEXT    NOT NULL,
  item_id    TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  share_code TEXT    NOT NULL,
  last_seen  INTEGER NOT NULL,
  PRIMARY KEY (person_id, item_id)
);
CREATE INDEX shared_with_person_seen ON shared_with (person_id, last_seen DESC, item_id DESC);
CREATE INDEX shared_with_item_code ON shared_with (item_id, share_code);

-- The folder a person files each kind of new item into, by a key the apps define (e.g. `mode:plan`).
CREATE TABLE placement_defaults (
  person_id   TEXT    NOT NULL,
  default_key TEXT    NOT NULL,
  folder_id   TEXT    NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (person_id, default_key)
);
CREATE INDEX placement_defaults_folder ON placement_defaults (folder_id);

-- What the Inbox needs about each comment thread, pushed by the item per tab. The comments themselves stay
-- in the item's content.
CREATE TABLE collab_threads (
  app                TEXT    NOT NULL,
  item_id            TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id             TEXT    NOT NULL,
  element_id         TEXT    NOT NULL,
  element_label      TEXT    NOT NULL,
  resolved           INTEGER NOT NULL,
  comment_count      INTEGER NOT NULL,
  participant_ids    TEXT    NOT NULL DEFAULT '[]',
  mentioned_ids      TEXT    NOT NULL DEFAULT '[]',
  latest_text        TEXT    NOT NULL,
  latest_author_name TEXT    NOT NULL,
  first_at           INTEGER NOT NULL,
  latest_at          INTEGER NOT NULL,
  PRIMARY KEY (app, item_id, tab_id, element_id)
);
CREATE INDEX collab_threads_item ON collab_threads (item_id, tab_id, resolved, latest_at DESC);

-- Who commented on or is mentioned in each thread, one row each, so "threads I am in" walks an index
-- rather than every thread's JSON.
CREATE TABLE collab_thread_people (
  app        TEXT NOT NULL,
  item_id    TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id     TEXT NOT NULL,
  element_id TEXT NOT NULL,
  person_id  TEXT NOT NULL,
  PRIMARY KEY (person_id, app, item_id, tab_id, element_id)
);
CREATE INDEX collab_thread_people_item ON collab_thread_people (item_id, tab_id);

CREATE TABLE collab_actions (
  app           TEXT    NOT NULL,
  item_id       TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  tab_id        TEXT    NOT NULL,
  element_id    TEXT    NOT NULL,
  action_id     TEXT    NOT NULL,
  element_label TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  status        TEXT    NOT NULL CHECK (status IN ('open', 'done', 'wont-do')),
  assignee_id   TEXT    NULL,
  assigner_id   TEXT    NOT NULL,
  team_id       TEXT    NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (app, item_id, tab_id, element_id, action_id)
);
CREATE INDEX collab_actions_item ON collab_actions (item_id, tab_id);
CREATE INDEX collab_actions_assignee ON collab_actions (assignee_id, status, updated_at DESC);
CREATE INDEX collab_actions_assigner ON collab_actions (assigner_id, status, updated_at DESC);

-- An item purged from the index whose app has not yet confirmed dropping its content. The daily run
-- retries each until the app answers.
CREATE TABLE purge_tombstones (
  item_id         TEXT    PRIMARY KEY,
  app             TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER NULL,
  last_error      TEXT    NULL
);
CREATE INDEX purge_tombstones_due ON purge_tombstones (last_attempt_at);
