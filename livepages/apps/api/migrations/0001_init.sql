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

-- Participants: one row per local identity. Mirrors the
-- `Participant` type in apps/live/lib/identity.ts (id, name, color).
-- Status is volatile (online/away/stale) and stays client-side until
-- websockets propagate it, so it's not stored here.
CREATE TABLE participants (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);
