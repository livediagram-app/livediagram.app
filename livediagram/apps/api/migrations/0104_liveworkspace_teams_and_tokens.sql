-- Teams and API tokens belong to the liveworkspace account now (liveworkspace/docs/accounts.md).
--
-- Teams are run on liveworkspace.app: teams and team_members become this app's copy of each team
-- and its joined members, kept by following liveworkspace's change feed from this cursor
-- (src/db/team-sync.ts, docs/specs/013-workspace/teams.md). The rows already here are left as they
-- are; the invite columns stay, unused.
CREATE TABLE team_sync_state (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  cursor    TEXT    NOT NULL,
  synced_at INTEGER NOT NULL
);

-- API tokens are liveworkspace `lwt_` tokens, and api_tokens is the mirror of those this app has
-- seen (src/db/api-tokens.ts). Every row here before this migration is an old `lvd_` token, which
-- the switch revokes: marking it revoked ends the workbench pairings and sessions that hang off it.
UPDATE api_tokens SET revoked = 1 WHERE revoked = 0;
