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
