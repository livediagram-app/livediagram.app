// Shared row builders for the Trash's tests (db/trash.test.ts,
// db/empty-document-sweep.test.ts): plain INSERTs on a real SQLite with every
// migration applied. Not a `.test.ts` file, so vitest doesn't collect it.

import type { DatabaseSync } from 'node:sqlite';

export const T0 = 1_700_000_000_000;
export const DAY = 24 * 60 * 60 * 1000;

export function insert(
  sql: DatabaseSync,
  table: string,
  row: Record<string, string | number | null>,
) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

export function liveDoc(
  sql: DatabaseSync,
  id: string,
  opts: { owner?: string; team?: string | null; folder?: string | null; savedAt?: number } = {},
) {
  insert(sql, 'documents', {
    id,
    owner_id: opts.owner ?? 'owner',
    name: `Diagram ${id}`,
    shareable: 0,
    team_id: opts.team ?? null,
    folder_id: opts.folder ?? null,
    saved_at: opts.savedAt ?? T0,
    created_at: opts.savedAt ?? T0,
  });
}

export function team(sql: DatabaseSync, id: string, members: [string, 'joined' | 'pending'][]) {
  insert(sql, 'teams', { id, name: `Team ${id}`, created_at: T0, updated_at: T0 });
  for (const [user, status] of members) {
    insert(sql, 'team_members', {
      id: `m-${id}-${user}`,
      team_id: id,
      user_id: user,
      role: 'member',
      status,
      created_at: T0,
      updated_at: T0,
    });
  }
}
