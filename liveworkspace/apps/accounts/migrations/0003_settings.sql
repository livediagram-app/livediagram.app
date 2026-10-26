-- A person's settings (liveworkspace/docs/specs/003-accounts/accounts.md "Settings"), kept with the account rather than in
-- each app, so a setting shared by every app is set once. Written by hand, like 0002.

-- One row per owner per scope: 'all' for what every app shows, or an app's site id
-- ('livediagram.app', ...) for what only that app shows. The owner is an account id (`user_…`) or a
-- guest id (`guest_<uuid>`). Guests aren't rows in "user", so there is no foreign key: closing an
-- account and a guest signing in clear their rows explicitly (src/settings.ts).
CREATE TABLE settings (
  owner_id   TEXT    NOT NULL,
  scope      TEXT    NOT NULL,
  -- A JSON object of setting keys to values, at most 16 KB (SETTINGS_MAX_BYTES in src/settings.ts).
  -- The checks are the last word: a write that would break one fails whole, in the same statement.
  prefs      TEXT    NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, scope),
  CONSTRAINT settings_object CHECK (json_valid(prefs) AND json_type(prefs) = 'object'),
  CONSTRAINT settings_size CHECK (length(CAST(prefs AS BLOB)) <= 16384)
) WITHOUT ROWID;
