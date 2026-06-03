-- Per-user editor preferences (spec/20). One row per owner, with the
-- preference flags themselves stored as a JSON blob so adding a new
-- flag never requires a schema change. The opaque-blob shape mirrors
-- how spec/22 keeps `events` flexible: each row's content is the
-- client's responsibility, the server just bounds the size.
--
-- Owners are the same hybrid identity the rest of the api uses
-- (spec/04): Clerk userId when the request carries a verified Bearer
-- token, the per-browser `X-Owner-Id` participant id otherwise. Self-
-- hosters without Clerk get the guest path for free.

CREATE TABLE user_preferences (
  owner_id   TEXT PRIMARY KEY NOT NULL,
  prefs      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
