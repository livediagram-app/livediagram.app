// folders — self-referential tree, personal (owner-scoped, spec/15)
// or team-scoped (spec/35) via the nullable team_id column.

import { rowToFolder, type FolderRow } from '../folder-row';
import type { Env, FolderDTO } from '../types';

const FOLDER_COLS = 'id, owner_id, parent_id, team_id, name, created_at, updated_at';

// Personal tree only: team folders never bleed into the owner's
// Explorer sidebar (they render on the team page instead — spec/35).
export async function listFoldersByOwner(env: Env, ownerId: string): Promise<FolderDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${FOLDER_COLS} FROM folders WHERE owner_id = ? AND team_id IS NULL ORDER BY name ASC`,
  )
    .bind(ownerId)
    .all<FolderRow>();
  return (result.results ?? []).map(rowToFolder);
}

// One team's shared folder tree (spec/35).
export async function listFoldersByTeam(env: Env, teamId: string): Promise<FolderDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${FOLDER_COLS} FROM folders WHERE team_id = ? ORDER BY name ASC`,
  )
    .bind(teamId)
    .all<FolderRow>();
  return (result.results ?? []).map(rowToFolder);
}

export async function getFolder(env: Env, id: string): Promise<FolderDTO | null> {
  const row = await env.DB.prepare(`SELECT ${FOLDER_COLS} FROM folders WHERE id = ?`)
    .bind(id)
    .first<FolderRow>();
  return row ? rowToFolder(row) : null;
}

export async function createFolder(
  env: Env,
  f: { id: string; ownerId: string; parentId: string | null; name: string; teamId?: string | null },
): Promise<FolderDTO> {
  const now = Date.now();
  const teamId = f.teamId ?? null;
  await env.DB.prepare(
    `INSERT INTO folders (id, owner_id, parent_id, team_id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(f.id, f.ownerId, f.parentId, teamId, f.name, now, now)
    .run();
  return {
    id: f.id,
    ownerId: f.ownerId,
    parentId: f.parentId,
    teamId,
    name: f.name,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateFolder(
  env: Env,
  id: string,
  patch: { name?: string; parentId?: string | null },
): Promise<void> {
  const now = Date.now();
  // Build a partial UPDATE so we never accidentally clear a column the
  // caller didn't touch. `name` and `parentId` are both legal so we
  // can't merge them into one statement without losing the
  // "undefined = leave alone" semantic.
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
      .bind(patch.name, now, id)
      .run();
  }
  if (patch.parentId !== undefined) {
    await env.DB.prepare('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?')
      .bind(patch.parentId, now, id)
      .run();
  }
}

export async function deleteFolder(env: Env, id: string): Promise<void> {
  // Promote direct children before deleting: subfolders become root,
  // diagrams fall to Unsorted. ON DELETE SET NULL on both FKs would
  // do the same thing, but we run it explicitly so the behaviour is
  // visible in code (and not dependent on SQLite enforcing the FK,
  // which is opt-in via PRAGMA).
  await env.DB.prepare('UPDATE folders SET parent_id = NULL WHERE parent_id = ?').bind(id).run();
  await env.DB.prepare('UPDATE diagrams SET folder_id = NULL WHERE folder_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(id).run();
}

// Cycle check for folder moves. Walks the proposed ancestor chain
// from `newParentId` upward; if we hit `folderId` along the way the
// move would form a cycle. Caller rejects with a 409 in that case.
export async function folderMoveWouldCycle(
  env: Env,
  folderId: string,
  newParentId: string,
): Promise<boolean> {
  let cursor: string | null = newParentId;
  const seen = new Set<string>();
  while (cursor !== null) {
    const here: string = cursor;
    if (here === folderId) return true;
    if (seen.has(here)) return true; // defensive — corrupt graph
    seen.add(here);
    const row = await env.DB.prepare('SELECT parent_id FROM folders WHERE id = ?')
      .bind(here)
      .first<{ parent_id: string | null }>();
    cursor = row?.parent_id ?? null;
  }
  return false;
}
