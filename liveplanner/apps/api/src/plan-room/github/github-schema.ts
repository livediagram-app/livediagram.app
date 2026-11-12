// A plan's GitHub connection in its own SQLite (docs/specs/026-plan/github-pull-requests.md "Storage"; blueprint
// "Part 2" "The plan's object"), the schema's step V21. Every statement is IF NOT EXISTS, so it runs again harmlessly.
//
//   github_connection     the installation, its account, who connected it (a card history's person, JSON) and when,
//                         and the plan's GitHub rules (part 3; null until then)
//   github_repositories   the installation's repositories the person who connected it could reach; `chosen` the
//                         ones connected
//   github_connect_states a connect's one-time state, by its SHA-256 hash, with whoever started it
//   github_deliveries     the delivery ids this plan has acted on, kept DELIVERY_KEEP_MS
export const GITHUB_SCHEMA = `
CREATE TABLE IF NOT EXISTS github_connection (
  plan_id         TEXT    PRIMARY KEY,
  installation_id INTEGER NOT NULL,
  account         TEXT    NOT NULL,
  connected_by    TEXT    NOT NULL,
  connected_at    INTEGER NOT NULL,
  rules           TEXT    NULL
);
CREATE TABLE IF NOT EXISTS github_repositories (
  plan_id   TEXT    NOT NULL,
  repo_id   INTEGER NOT NULL,
  full_name TEXT    NOT NULL,
  private   INTEGER NOT NULL DEFAULT 0,
  chosen    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, repo_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS github_connect_states (
  hash   TEXT    PRIMARY KEY,
  person TEXT    NOT NULL,
  at     INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS github_connect_states_at ON github_connect_states (at);
CREATE TABLE IF NOT EXISTS github_deliveries (
  id TEXT    PRIMARY KEY,
  at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS github_deliveries_at ON github_deliveries (at);
`;
