-- User-built custom themes, per docs/specs/011-theme/custom-themes.md.
--
-- Owner-scoped (Clerk sub or the X-Owner-Id guest id, like folders /
-- diagrams), guests included. `definition` is the JSON-serialised
-- themable payload (CustomThemeDefinition): backdrop + element colours
-- + optional palette / per-shape colours. The id is `custom:<uuid>`,
-- minted client-side, so it never collides with a built-in theme id and
-- can sit on Tab.theme unchanged. The (owner_id, created_at) index
-- serves the newest-first list endpoint.

CREATE TABLE custom_themes (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  definition  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX custom_themes_owner_idx ON custom_themes (owner_id);
CREATE INDEX custom_themes_owner_created_idx ON custom_themes (owner_id, created_at DESC);
