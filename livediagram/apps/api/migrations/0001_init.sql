-- Diagrams: one row per saved diagram. `data` is the full JSON payload
-- of `tabs[]` (same shape the frontend persists today via localStorage),
-- stored as TEXT and parsed at the boundary. Document-store pattern
-- because every read/write hits the whole document anyway and the
-- frontend already round-trips JSON.
CREATE TABLE diagrams (
  id           TEXT    PRIMARY KEY,
  owner_id     TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  data         TEXT    NOT NULL,
  saved_at     INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);

-- Owner-scoped list queries are the only multi-row pattern today.
CREATE INDEX idx_diagrams_owner_recent ON diagrams (owner_id, saved_at DESC);
