// Shared arrangement for the workbench route suites: a real SQLite D1 with one project owned by `user_1`, a
// live edit token `tok1` of theirs, a read-only token `tok_ro`, and another account's token `tok2`. Not a
// `.test.ts` file, so vitest never collects it as a suite.

import { upsertTab } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';

export const NOW = 1_800_000_000_000;
export const ORIGIN = 'https://127.0.0.1:5175';

export async function workbenchDb(base: Partial<Env> = {}): Promise<SqliteD1> {
  const db = sqliteD1({ APP_BASE_URL: 'https://app.test', ...base });
  db.sql.exec(`INSERT INTO projects (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('doc1', 'user_1', 'Home screen', 0, 1, 1),
                      ('doc2', 'user_2', 'Not yours', 0, 1, 1)`);
  await upsertTab(db.env, 'doc1', { id: 't1', name: 'Wireframe', elements: [] }, 0);
  db.sql
    .exec(`INSERT INTO api_tokens (id, owner_id, token_hash, name, created_at, expires_at, revoked, read_only)
               VALUES ('tok1', 'user_1', 'h1', 'liveplanner CLI', 1, ${NOW + 1e9}, 0, 0),
                      ('tok_ro', 'user_1', 'h3', 'Reader', 1, ${NOW + 1e9}, 0, 1),
                      ('tok2', 'user_2', 'h2', NULL, 1, ${NOW + 1e9}, 0, 0)`);
  return db;
}

export function pairToken(
  db: SqliteD1,
  tokenId = 'tok1',
  ownerId = 'user_1',
  id = 'pair1',
  scope: 'project' | 'workspace' = 'project',
): void {
  db.sql
    .exec(`INSERT INTO workbench_pairings (id, owner_id, token_id, origin, name, scope, created_at)
               VALUES ('${id}', '${ownerId}', '${tokenId}', '${ORIGIN}', 'Acme Editor', '${scope}', ${NOW})`);
}

// Folders for a workspace ticket to start on: `f-own` (user_1's), `f-team` (a team user_1 joined), `f-left` (a
// team user_1 left) and `f-other` (user_2's).
export function arrangeFolders(db: SqliteD1): void {
  db.sql
    .exec(`INSERT INTO teams (id, name, created_at, updated_at) VALUES ('team1', 'T', 0, 0), ('team2', 'U', 0, 0);
    INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at)
      VALUES ('m1', 'team1', 'user_1', 'member', 'joined', 0, 0),
             ('m2', 'team2', 'user_1', 'member', 'left', 0, 0);
    INSERT INTO folders (id, owner_id, team_id, parent_id, name, created_at, updated_at)
      VALUES ('f-own', 'user_1', NULL, NULL, 'Minigames', 0, 0),
             ('f-team', 'user_9', 'team1', NULL, 'Shared', 0, 0),
             ('f-left', 'user_9', 'team2', NULL, 'Gone', 0, 0),
             ('f-other', 'user_2', NULL, NULL, 'Theirs', 0, 0);`);
}

export const rows = (db: SqliteD1, sql: string) =>
  db.sql.prepare(sql).all() as Record<string, unknown>[];
