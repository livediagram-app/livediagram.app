-- Collaboration index (docs/specs/013-workspace/activity-page.md) — what the Activity page reads.
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
-- (docs/specs/006-diagram/tab-diagram-many-to-many.md), so the diagram is resolved at read time through
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
-- reader's own library (docs/specs/013-workspace/activity-page.md §4).
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

-- Identities an owner USED TO BE (docs/specs/013-workspace/activity-page.md §2.2). Comment author ids and
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
-- tabs (docs/specs/013-workspace/activity-page.md §2.3). Tabs saved after this migration index
-- themselves; this is for the dormant ones.
CREATE TABLE collab_index_state (
  owner_id      TEXT    PRIMARY KEY,
  backfilled_at INTEGER NOT NULL
);
