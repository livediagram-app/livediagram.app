import type { SqliteD1 } from '../test-sqlite-d1';

// Shared seeding for the placement route tests (docs/specs/013-workspace/folders.md "Placement on
// create", docs/specs/013-workspace/default-folders.md): teams with joined or invited members,
// personal and team folders, and the two caller shapes. Not a `.test.ts` file, so vitest does not
// collect it; only tests import it.

export const PLACEMENT_T0 = 1_700_000_000_000;

/** A signed-in caller: the hybrid owner and the verified id are the same Clerk id. */
export const asUser = (userId: string) => ({ owner: userId, clerkUserId: userId });
/** A guest: only the X-Owner-Id identity, nothing verified. */
export const asGuest = (guestId: string) => ({ owner: guestId, clerkUserId: null });

export function seedTeam(
  db: SqliteD1,
  id: string,
  members: Array<{ userId: string; status: 'joined' | 'invited' }>,
): void {
  db.sql
    .prepare('INSERT INTO teams (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(id, `Team ${id}`, PLACEMENT_T0, PLACEMENT_T0);
  for (const m of members) {
    db.sql
      .prepare(
        `INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at)
         VALUES (?, ?, ?, 'member', ?, ?, ?)`,
      )
      .run(`${id}-${m.userId}`, id, m.userId, m.status, PLACEMENT_T0, PLACEMENT_T0);
  }
}

export function seedFolder(
  db: SqliteD1,
  id: string,
  ownerId: string,
  teamId: string | null = null,
): void {
  db.sql
    .prepare(
      `INSERT INTO folders (id, owner_id, parent_id, team_id, name, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`,
    )
    .run(id, ownerId, teamId, `Folder ${id}`, PLACEMENT_T0, PLACEMENT_T0);
}

/** Where a document was filed, or undefined when nothing was written. */
export function storedPlacement(db: SqliteD1, id = 'd1') {
  return db.sql
    .prepare('SELECT owner_id, folder_id, team_id FROM documents WHERE id = ?')
    .get(id) as { owner_id: string; folder_id: string | null; team_id: string | null } | undefined;
}

export async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}
