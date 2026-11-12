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

// Step V23 (part 3; spec "Pull request state on cards"): the latest state of each pull request a connected repository
// reported, and the check suites of the commits they stand at.
//
//   github_pull_requests  by its key (`owner/repo#n`, lower case): its canonical address, title, state (draft, open,
//                         merged, closed), newest commit, the cards its title or body names (JSON ids), GitHub's
//                         updated_at (what an older delivery is checked against) and when the plan heard it
//   github_check_suites   one suite's result (running, passing, failing) for its repository's commit, and its
//                         updated_at
export const GITHUB_PULLS_SCHEMA = `
CREATE TABLE IF NOT EXISTS github_pull_requests (
  key        TEXT    PRIMARY KEY,
  repo_id    INTEGER NOT NULL,
  url        TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  state      TEXT    NOT NULL,
  head_sha   TEXT    NOT NULL,
  cards      TEXT    NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  seen_at    INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS github_pull_requests_head ON github_pull_requests (repo_id, head_sha);
CREATE INDEX IF NOT EXISTS github_pull_requests_seen ON github_pull_requests (seen_at);
CREATE TABLE IF NOT EXISTS github_check_suites (
  suite_id   INTEGER PRIMARY KEY,
  repo_id    INTEGER NOT NULL,
  head_sha   TEXT    NOT NULL,
  checks     TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS github_check_suites_head ON github_check_suites (repo_id, head_sha);
CREATE INDEX IF NOT EXISTS github_check_suites_updated ON github_check_suites (updated_at);
`;
