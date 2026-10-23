-- Sign-in moves to the liveworkspace accounts Worker (docs/specs/014-identity/auth-and-guest-access.md). A sign-in is
-- now counted once, at the /api/auth/callback that completes it, so the first sightings of Clerk session ids (0047)
-- have nothing left to dedupe. auth_accounts stays: a sign-in from an account never seen before still counts as a
-- sign-up.
DROP INDEX IF EXISTS auth_sessions_seen_idx;
DROP TABLE IF EXISTS auth_sessions;
