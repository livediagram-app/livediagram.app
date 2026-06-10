-- Teams (spec/32): named groups of signed-in users with Admin/Member
-- roles, plus the member link table that doubles as the invite store.
--
-- teams has no owner column: ownership is the 'admin' role on the
-- link rows, so a team survives its creator leaving (the last-admin
-- guard in the API layer keeps at least one admin alive).
--
-- team_members.user_id is the Clerk user id, NULL while the invite
-- is pending; email is the lowercased invite address, NULL only on a
-- creator row minted when the JWT carried no email claim. The API
-- layer guarantees one of the two is always set (SQLite CHECK kept
-- out for parity with the rest of the schema, which enforces shape
-- in the worker).

CREATE TABLE teams (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  organisation  TEXT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE team_members (
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL,
  user_id     TEXT NULL,
  email       TEXT NULL,
  role        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX team_members_team_idx ON team_members(team_id);
-- "Which teams am I in" (the GET /api/teams join).
CREATE INDEX team_members_user_idx ON team_members(user_id);
-- The lazy invite claim ("connect every pending row for this email").
CREATE INDEX team_members_email_idx ON team_members(email);
-- One row per address per team; NULL emails (creator rows without a
-- JWT email claim) are distinct under SQLite's unique semantics so
-- they don't collide.
CREATE UNIQUE INDEX team_members_team_email_uq ON team_members(team_id, email);
