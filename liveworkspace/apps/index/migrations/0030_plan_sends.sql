-- Send to Plan (liveworkspace/docs/specs/004-index/send-to-plan.md, blueprint send-to-plan.md, Work Tracker 1365): one
-- row a place a liveplanner card was made from. `ref` names the place (`kind:tab:element:part`); the card's title, column
-- and done state are as the plan last said, and `gone` marks a card in the Trash or deleted. The rows cascade from both
-- the source item and the plan, so a purge of either takes them, and they hold no person.
CREATE TABLE plan_sends (
  id          TEXT    PRIMARY KEY,
  source_id   TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  ref         TEXT    NOT NULL,
  kind        TEXT    NOT NULL,
  plan_id     TEXT    NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  card_id     TEXT    NOT NULL,
  card_title  TEXT    NOT NULL,
  column_name TEXT    NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  gone        INTEGER NOT NULL DEFAULT 0,
  at          INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
-- A source's read, newest first.
CREATE INDEX plan_sends_source ON plan_sends (source_id, at DESC);
-- The plan's change call and a send's duplicate check.
CREATE INDEX plan_sends_card ON plan_sends (plan_id, card_id);
