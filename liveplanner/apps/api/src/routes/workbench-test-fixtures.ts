// Shared arrangement for the workbench route suites: a real SQLite D1 with one project owned by `user_1`, and
// each person's workbench store in memory (test-sqlite-d1.ts). `user_1` has a live edit token `tok1` and a
// read-only token `tok_ro`; `tok2` is another account's. Not a `.test.ts` file, so vitest never collects it as a
// suite.

import type { WorkbenchToken } from '@liveworkspace/index-app';
import type { memoryWorkbenchNamespace } from '@liveworkspace/index-app/testing';
import { upsertTab } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import type { RouteContext } from './context';

export const NOW = 1_800_000_000_000;
export const ORIGIN = 'https://127.0.0.1:5175';

// The tokens as liveworkspace describes them when the api checks them.
export const TOKENS: Record<string, WorkbenchToken> = {
  tok1: { id: 'tok1', name: 'liveplanner CLI', readOnly: false, expiresAt: NOW + 1e9 },
  tok_ro: { id: 'tok_ro', name: 'Reader', readOnly: true, expiresAt: NOW + 1e9 },
  tok2: { id: 'tok2', name: null, readOnly: false, expiresAt: NOW + 1e9 },
};

// A route context's `token` for one of them.
export const tokenOf = (id: string): NonNullable<RouteContext['token']> => ({ ...TOKENS[id]! });

export async function workbenchDb(base: Partial<Env> = {}): Promise<SqliteD1> {
  const db = sqliteD1({ APP_BASE_URL: 'https://app.test', ...base });
  db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('doc1', 'user_1', 'Home screen', 0, 1, 1),
                      ('doc2', 'user_2', 'Not yours', 0, 1, 1)`);
  await upsertTab(db.env, 'doc1', { id: 't1', name: 'Wireframe', elements: [] }, 0);
  return db;
}

type Stores = ReturnType<typeof memoryWorkbenchNamespace<'project'>>;

// A person's workbench store's own SQLite (its tables are `wb_*`), for arranging and reading rows.
export function storeSql(db: SqliteD1, ownerId = 'user_1') {
  const stores = db.env.WORKBENCH as unknown as Stores;
  stores.storeOf(ownerId);
  return stores.stores.get(stores.idFromName(ownerId).toString())!.storage.sql;
}

export async function pairToken(
  db: SqliteD1,
  tokenId = 'tok1',
  ownerId = 'user_1',
  id = 'pair1',
  scope: 'project' | 'workspace' = 'project',
): Promise<void> {
  const stores = db.env.WORKBENCH as unknown as Stores;
  // A request notes the token (and makes the store); the pairing is then written as approving one would.
  const { code } = await stores.storeOf(ownerId).openPairingRequest({
    personId: ownerId,
    token: TOKENS[tokenId]!,
    origin: ORIGIN,
    scope,
    name: null,
    now: NOW,
  });
  const sql = storeSql(db, ownerId);
  sql.exec('DELETE FROM wb_pairing_requests WHERE code = ?', code);
  sql.exec(
    `INSERT INTO wb_pairings (id, token_id, origin, name, scope, created_at) VALUES (?, ?, ?, 'Acme Editor', ?, ?)`,
    id,
    tokenId,
    ORIGIN,
    scope,
    NOW,
  );
}

// Folders for a workspace ticket to start on (the index's, test-sqlite-d1.ts `test_folders`): `f-own` (user_1's),
// `f-team` (team1's, which user_1's token says they joined), `f-left` (team2's, which it does not) and `f-other`
// (user_2's).
export const USER_1_TEAMS = [{ id: 'team1', name: 'T', role: 'member' as const }];

export function arrangeFolders(db: SqliteD1): void {
  db.sql.exec(`INSERT INTO test_folders (id, owner_id, team_id, parent_id, name)
      VALUES ('f-own', 'user_1', NULL, NULL, 'Minigames'),
             ('f-team', 'user_9', 'team1', NULL, 'Shared'),
             ('f-left', 'user_9', 'team2', NULL, 'Gone'),
             ('f-other', 'user_2', NULL, NULL, 'Theirs');`);
}

// The workbench suites reach the index through the test harness's fake (test-sqlite-d1.ts).
export async function indexServiceWithTestIndex(
  original: () => Promise<typeof import('../index-service')>,
): Promise<typeof import('../index-service')> {
  const { testIndexFor, testRequestGrant } = await import('../test-sqlite-d1');
  return { ...(await original()), indexFor: testIndexFor, requestGrant: testRequestGrant };
}

// Rows of a person's workbench store (none before it is first written).
export function rows(db: SqliteD1, query: string, ownerId = 'user_1'): Record<string, unknown>[] {
  const sql = storeSql(db, ownerId);
  const started =
    sql.exec("SELECT 1 FROM sqlite_master WHERE name = 'wb_pairings'").toArray().length > 0;
  return started ? sql.exec(query).toArray() : [];
}
