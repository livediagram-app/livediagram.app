-- Per-user diagram favourites (spec/95).
--
-- Each row says "owner OWNER_ID starred diagram DIAGRAM_ID at CREATED_AT".
-- Primary key on (owner_id, diagram_id) makes starring idempotent.
--
-- A TABLE rather than a flag on `diagrams`, because favouriting is
-- PER-USER: starring a diagram in a shared team folder must not star it
-- for the rest of the team. It's also a table rather than a key in the
-- user_preferences blob (which is how spec/93 stores hidden-from-Recent
-- ids) because that blob is capped at 4 KB server-side — roughly 100
-- 36-char UUIDs — and favourites are meant to be unlimited. Blowing that
-- cap would start failing EVERY preference write, not just this one.
--
-- Cascades through diagrams: deleting a diagram drops everyone's star on
-- it for free, so the Favourites view can never list a dead id.
CREATE TABLE favourites (
  owner_id TEXT NOT NULL,
  diagram_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, diagram_id),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

-- The only read pattern: "every diagram this owner starred".
CREATE INDEX idx_favourites_owner ON favourites(owner_id);
