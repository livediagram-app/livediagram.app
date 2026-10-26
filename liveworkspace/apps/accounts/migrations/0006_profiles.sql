-- A person's display name and presence colour, the ones collaborators see in every app
-- (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"), and when each guest id was last handed to an app, which
-- is how a guest who can never come back is told apart (src/guest-sweep.ts). Written by hand, like 0002.

-- One row per owner: an account id (`user_…`) or a guest id (`guest_<uuid>`). Guests aren't rows in
-- "user", so there is no foreign key: closing an account and a guest signing in clear their rows
-- explicitly (src/profiles.ts). An account with no row, or no name in it, shows its account name.
CREATE TABLE profile (
  owner_id   TEXT    NOT NULL PRIMARY KEY,
  -- The display name, or null for none of its own (an account then shows "user".name).
  name       TEXT    CHECK (name IS NULL OR length(name) BETWEEN 1 AND 120),
  -- A CSS colour, or null for the app's own pick.
  color      TEXT    CHECK (color IS NULL OR length(color) BETWEEN 1 AND 64),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

-- When liveworkspace.app last handed a guest id to an app (GET /api/auth/guest), stamped at most once
-- a day. A guest id unseen for longer than its token and its cookie can last can't be used again, and
-- what is kept against it here is swept (settings and profile; its items stay in the index).
CREATE TABLE guest_seen (
  guest_id TEXT    NOT NULL PRIMARY KEY,
  seen_at  INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX guest_seen_at ON guest_seen (seen_at);
