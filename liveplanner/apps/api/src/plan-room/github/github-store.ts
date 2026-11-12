// The plan's GitHub connection, connect states and seen deliveries, on its own SQLite (github-schema.ts;
// docs/specs/026-plan/github-pull-requests.md "Storage"; blueprint "Part 2" "The plan's object"). Plain reads and
// writes; who may make them is the routes' and the room's.
import type { ItemPerson } from '@liveplanner/items';
import type { GithubConnectionView } from '@liveplanner/api-schema';
import type { GithubRepository } from '../../github/github-api';
import {
  CONNECT_STATE_TTL_MS,
  CONNECT_STATES_MAX,
  DELIVERY_KEEP_MS,
} from '../../github/github-config';
import { NO_LINKS, type LinkSet } from '../../github/github-links';

export type StoredRepository = GithubRepository & { chosen: boolean };

export type GithubConnection = {
  installationId: number;
  account: string;
  connectedBy: ItemPerson;
  connectedAt: number;
  repositories: StoredRepository[];
};

type ConnectionRow = {
  installation_id: number;
  account: string;
  connected_by: string;
  connected_at: number;
};
type RepositoryRow = { repo_id: number; full_name: string; private: number; chosen: number };

function personOf(text: string): ItemPerson {
  try {
    const p = JSON.parse(text) as Partial<ItemPerson>;
    return {
      id: typeof p.id === 'string' ? p.id : '',
      name: typeof p.name === 'string' ? p.name : 'Someone',
      ...(typeof p.color === 'string' ? { color: p.color } : {}),
    } as ItemPerson;
  } catch {
    return { id: '', name: 'Someone' } as ItemPerson;
  }
}

/** The plan's connection, or null for none. */
export async function readConnection(
  db: D1Database,
  planId: string,
): Promise<GithubConnection | null> {
  const [conn, repos] = await db.batch([
    db
      .prepare(
        'SELECT installation_id, account, connected_by, connected_at FROM github_connection WHERE plan_id = ?',
      )
      .bind(planId),
    db
      .prepare(
        'SELECT repo_id, full_name, private, chosen FROM github_repositories WHERE plan_id = ? ORDER BY full_name COLLATE NOCASE',
      )
      .bind(planId),
  ]);
  const row = (conn?.results as ConnectionRow[] | undefined)?.[0];
  if (!row) return null;
  return {
    installationId: Number(row.installation_id),
    account: row.account,
    connectedBy: personOf(row.connected_by),
    connectedAt: Number(row.connected_at),
    repositories: ((repos?.results ?? []) as RepositoryRow[]).map((r) => ({
      id: Number(r.repo_id),
      fullName: r.full_name,
      private: Number(r.private) === 1,
      chosen: Number(r.chosen) === 1,
    })),
  };
}

/** What the connection puts in the reverse index. */
export const linksOf = (c: GithubConnection | null): LinkSet =>
  c
    ? {
        installationId: c.installationId,
        repositoryIds: c.repositories.filter((r) => r.chosen).map((r) => r.id),
      }
    : NO_LINKS;

/** The connection as an Editor sees it: the person's name and hashed id, never more. */
export const connectionView = (c: GithubConnection): GithubConnectionView => ({
  installationId: c.installationId,
  account: c.account,
  connectedBy: { id: c.connectedBy.id, name: c.connectedBy.name },
  connectedAt: c.connectedAt,
  repositories: c.repositories.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    private: r.private,
    chosen: r.chosen,
  })),
});

const repoInsert = (db: D1Database, planId: string, r: StoredRepository) =>
  db
    .prepare(
      'INSERT INTO github_repositories (plan_id, repo_id, full_name, private, chosen) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(planId, r.id, r.fullName, r.private ? 1 : 0, r.chosen ? 1 : 0);

/** The connection and its repositories replaced, in one batch. */
export async function saveConnection(
  db: D1Database,
  planId: string,
  c: GithubConnection,
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM github_repositories WHERE plan_id = ?').bind(planId),
    db
      .prepare(
        `INSERT INTO github_connection (plan_id, installation_id, account, connected_by, connected_at, rules)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON CONFLICT (plan_id) DO UPDATE SET installation_id = excluded.installation_id, account = excluded.account,
           connected_by = excluded.connected_by, connected_at = excluded.connected_at, rules = NULL`,
      )
      .bind(planId, c.installationId, c.account, JSON.stringify(c.connectedBy), c.connectedAt),
    ...c.repositories.map((r) => repoInsert(db, planId, r)),
  ]);
}

/** The chosen repositories set to `ids`, every other listed one not chosen. */
export async function chooseRepositories(
  db: D1Database,
  planId: string,
  ids: readonly number[],
): Promise<void> {
  await db
    .prepare(
      `UPDATE github_repositories SET chosen = CASE WHEN repo_id IN (SELECT value FROM json_each(?)) THEN 1 ELSE 0 END
       WHERE plan_id = ?`,
    )
    .bind(JSON.stringify(ids), planId)
    .run();
}

/** Repositories gone from the installation, off the plan's list. */
export async function dropRepositories(
  db: D1Database,
  planId: string,
  ids: readonly number[],
): Promise<void> {
  await db
    .prepare(
      'DELETE FROM github_repositories WHERE plan_id = ? AND repo_id IN (SELECT value FROM json_each(?))',
    )
    .bind(planId, JSON.stringify(ids))
    .run();
}

/** The connection gone, its repositories with it. */
export async function dropConnection(db: D1Database, planId: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM github_repositories WHERE plan_id = ?').bind(planId),
    db.prepare('DELETE FROM github_connection WHERE plan_id = ?').bind(planId),
  ]);
}

/** A connect's state kept, by its hash: expired ones dropped first, then the oldest past CONNECT_STATES_MAX. */
export async function addConnectState(
  db: D1Database,
  hash: string,
  person: string,
  now: number,
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM github_connect_states WHERE at <= ?').bind(now - CONNECT_STATE_TTL_MS),
    db
      .prepare('INSERT OR REPLACE INTO github_connect_states (hash, person, at) VALUES (?, ?, ?)')
      .bind(hash, person, now),
    db
      .prepare(
        `DELETE FROM github_connect_states WHERE hash NOT IN
           (SELECT hash FROM github_connect_states ORDER BY at DESC LIMIT ?)`,
      )
      .bind(CONNECT_STATES_MAX),
  ]);
}

/** The state spent, once: whoever started it while it is live, else null. */
export async function claimConnectState(
  db: D1Database,
  hash: string,
  now: number,
): Promise<string | null> {
  const row = await db
    .prepare('DELETE FROM github_connect_states WHERE hash = ? RETURNING person, at')
    .bind(hash)
    .first<{ person: string; at: number }>();
  if (!row || Number(row.at) <= now - CONNECT_STATE_TTL_MS) return null;
  return row.person;
}

/** Whether this plan sees delivery `id` for the first time (and remembers it); ids past DELIVERY_KEEP_MS go. */
export async function firstSight(db: D1Database, id: string, now: number): Promise<boolean> {
  const [, inserted] = await db.batch([
    db.prepare('DELETE FROM github_deliveries WHERE at <= ?').bind(now - DELIVERY_KEEP_MS),
    db.prepare('INSERT OR IGNORE INTO github_deliveries (id, at) VALUES (?, ?)').bind(id, now),
  ]);
  return Number(inserted?.meta.changes ?? 0) === 1;
}
