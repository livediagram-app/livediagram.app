// Each pull request's latest state and its commits' check suites, on the plan's own SQLite (github-schema.ts V22;
// docs/specs/026-plan/github-pull-requests.md "Pull request state on cards"; blueprint "Part 3"). Plain reads and
// writes: an older delivery than the one kept writes nothing, and both tables are trimmed to their caps.
import {
  CHECK_SUITES_KEPT,
  PULL_REQUESTS_KEPT,
  checksOf,
  pullRequestKey,
  pullRequestUrl,
  type PullRequestChecks,
  type PullRequestState,
  type PullRequestStatus,
} from '@liveplanner/items';
import type { DeliveredCheckSuite, DeliveredPullRequest } from '../../github/github-payloads';

type PullRow = {
  key: string;
  url: string;
  title: string;
  state: string;
  cards: string;
  updated_at: number;
  checks: string | null;
};

const STATES = new Set<string>(['draft', 'open', 'merged', 'closed']);
const CHECKS = new Set<string>(['running', 'passing', 'failing']);

function cardsOf(text: string): string[] {
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// Each row's head commit's suites, folded: the checks of every suite at (repo, commit), joined into one text.
const STATUS_SELECT = `SELECT p.key, p.url, p.title, p.state, p.cards, p.updated_at,
    (SELECT group_concat(s.checks) FROM github_check_suites s
      WHERE s.repo_id = p.repo_id AND s.head_sha = p.head_sha) AS checks
  FROM github_pull_requests p`;

function statusOf(row: PullRow): PullRequestStatus | null {
  if (!STATES.has(row.state)) return null;
  const checks = checksOf(
    (row.checks ?? '').split(',').filter((c): c is PullRequestChecks => CHECKS.has(c)),
  );
  const cards = cardsOf(row.cards);
  return {
    key: row.key,
    url: row.url,
    title: row.title,
    state: row.state as PullRequestState,
    ...(checks ? { checks } : {}),
    ...(cards.length ? { cards } : {}),
    updatedAt: Number(row.updated_at),
  };
}

/** The states of `keys` (null: every one kept), in no set order. */
export async function statusesOf(
  db: D1Database,
  keys: readonly string[] | null,
): Promise<PullRequestStatus[]> {
  if (keys !== null && keys.length === 0) return [];
  const res =
    keys === null
      ? await db.prepare(STATUS_SELECT).all<PullRow>()
      : await db
          .prepare(`${STATUS_SELECT} WHERE p.key IN (SELECT value FROM json_each(?))`)
          .bind(JSON.stringify(keys))
          .all<PullRow>();
  return (res.results ?? []).flatMap((r) => statusOf(r) ?? []);
}

/** The keys of the pull requests standing at `sha` in the repository. */
export async function keysAtHead(db: D1Database, repoId: number, sha: string): Promise<string[]> {
  const res = await db
    .prepare('SELECT key FROM github_pull_requests WHERE repo_id = ? AND head_sha = ?')
    .bind(repoId, sha)
    .all<{ key: string }>();
  return (res.results ?? []).map((r) => r.key);
}

/** The pull request kept, unless the plan holds a newer delivery of it; whether it wrote. Trims to PULL_REQUESTS_KEPT. */
export async function upsertPull(
  db: D1Database,
  pr: DeliveredPullRequest,
  cards: readonly string[],
  now: number,
): Promise<boolean> {
  const [written] = await db.batch([
    db
      .prepare(
        `INSERT INTO github_pull_requests (key, repo_id, url, title, state, head_sha, cards, updated_at, seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET repo_id = excluded.repo_id, url = excluded.url, title = excluded.title,
           state = excluded.state, head_sha = excluded.head_sha, cards = excluded.cards,
           updated_at = excluded.updated_at, seen_at = excluded.seen_at
         WHERE excluded.updated_at >= github_pull_requests.updated_at`,
      )
      .bind(
        pullRequestKey(pr.ref),
        pr.repoId,
        pullRequestUrl(pr.ref),
        pr.title,
        pr.state,
        pr.headSha,
        JSON.stringify(cards),
        pr.updatedAt,
        now,
      ),
    db
      .prepare(
        `DELETE FROM github_pull_requests WHERE key NOT IN
           (SELECT key FROM github_pull_requests ORDER BY seen_at DESC LIMIT ?)`,
      )
      .bind(PULL_REQUESTS_KEPT),
  ]);
  return Number(written?.meta.changes ?? 0) === 1;
}

/** The suite kept, unless the plan holds a newer delivery of it; whether it wrote. Trims to CHECK_SUITES_KEPT. */
export async function upsertSuite(db: D1Database, suite: DeliveredCheckSuite): Promise<boolean> {
  const [written] = await db.batch([
    db
      .prepare(
        `INSERT INTO github_check_suites (suite_id, repo_id, head_sha, checks, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (suite_id) DO UPDATE SET repo_id = excluded.repo_id, head_sha = excluded.head_sha,
           checks = excluded.checks, updated_at = excluded.updated_at
         WHERE excluded.updated_at >= github_check_suites.updated_at`,
      )
      .bind(suite.suiteId, suite.repoId, suite.headSha, suite.checks, suite.updatedAt),
    db
      .prepare(
        `DELETE FROM github_check_suites WHERE suite_id NOT IN
           (SELECT suite_id FROM github_check_suites ORDER BY updated_at DESC LIMIT ?)`,
      )
      .bind(CHECK_SUITES_KEPT),
  ]);
  return Number(written?.meta.changes ?? 0) === 1;
}

/** The states (and suites) of `repoIds`' pull requests dropped (null: every one); answers the keys that went. */
export async function dropPulls(
  db: D1Database,
  repoIds: readonly number[] | null,
): Promise<string[]> {
  if (repoIds === null) {
    const [gone] = await db.batch([
      db.prepare('DELETE FROM github_pull_requests RETURNING key'),
      db.prepare('DELETE FROM github_check_suites'),
    ]);
    return ((gone?.results ?? []) as { key: string }[]).map((r) => r.key);
  }
  const ids = JSON.stringify(repoIds);
  const [gone] = await db.batch([
    db
      .prepare(
        'DELETE FROM github_pull_requests WHERE repo_id IN (SELECT value FROM json_each(?)) RETURNING key',
      )
      .bind(ids),
    db
      .prepare('DELETE FROM github_check_suites WHERE repo_id IN (SELECT value FROM json_each(?))')
      .bind(ids),
  ]);
  return ((gone?.results ?? []) as { key: string }[]).map((r) => r.key);
}
