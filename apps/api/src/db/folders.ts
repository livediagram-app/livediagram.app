// folders — self-referential tree, personal (owner-scoped, docs/specs/013-workspace/folders.md)
// or team-scoped (docs/specs/013-workspace/team-shared-documents.md) via the nullable team_id column.

import { rowToFolder, type FolderRow } from '../folder-row';
import type { FolderDTO, Runtime } from '../types';

const FOLDER_COLS = 'id, owner_id, parent_id, team_id, name, created_at, updated_at';

// Personal tree only: team folders never bleed into the owner's
// Explorer sidebar (they render on the team page instead — docs/specs/013-workspace/team-shared-documents.md).
export async function listFoldersByOwner(env: Runtime, ownerId: string): Promise<FolderDTO[]> {
  const result = await env.db
    .prepare(
      `SELECT ${FOLDER_COLS} FROM folders WHERE owner_id = ? AND team_id IS NULL ORDER BY name ASC`,
    )
    .bind(ownerId)
    .all<FolderRow>();
  return (result.results ?? []).map(rowToFolder);
}

// One team's shared folder tree (docs/specs/013-workspace/team-shared-documents.md).
export async function listFoldersByTeam(env: Runtime, teamId: string): Promise<FolderDTO[]> {
  const result = await env.db
    .prepare(`SELECT ${FOLDER_COLS} FROM folders WHERE team_id = ? ORDER BY name ASC`)
    .bind(teamId)
    .all<FolderRow>();
  return (result.results ?? []).map(rowToFolder);
}

export async function getFolder(env: Runtime, id: string): Promise<FolderDTO | null> {
  const row = await env.db
    .prepare(`SELECT ${FOLDER_COLS} FROM folders WHERE id = ?`)
    .bind(id)
    .first<FolderRow>();
  return row ? rowToFolder(row) : null;
}

export async function createFolder(
  env: Runtime,
  f: { id: string; ownerId: string; parentId: string | null; name: string; teamId?: string | null },
): Promise<FolderDTO> {
  const now = Date.now();
  const teamId = f.teamId ?? null;
  await env.db
    .prepare(
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
  env: Runtime,
  id: string,
  patch: { name?: string; parentId?: string | null },
): Promise<void> {
  const now = Date.now();
  // Build a partial UPDATE so we never accidentally clear a column the
  // caller didn't touch. `name` and `parentId` are both legal so we
  // can't merge them into one statement without losing the
  // "undefined = leave alone" semantic.
  if (patch.name !== undefined) {
    await env.db
      .prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
      .bind(patch.name, now, id)
      .run();
  }
  if (patch.parentId !== undefined) {
    await env.db
      .prepare('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?')
      .bind(patch.parentId, now, id)
      .run();
  }
}

// Deleting a folder moves its direct subfolders and documents (trashed ones too) up to its parent,
// the space's root for a top-level folder (docs/specs/013-workspace/folders.md "Deleting a folder",
// blueprint folder-delete.md). One batch, one transaction: the parent is read by subquery INSIDE it,
// while the row still exists, so a concurrent move cannot strand the contents, and the folder's
// Drive mirror row (docs/specs/022-drive-mirror/drive-mirror.md, "Data") goes with it. The FKs'
// ON DELETE SET NULL is only a backstop the explicit statements never reach. Answers the parent the
// contents moved to, read beforehand for the caller's log.
export async function deleteFolder(env: Runtime, id: string): Promise<{ parentId: string | null }> {
  const parent = await env.db
    .prepare('SELECT parent_id FROM folders WHERE id = ?')
    .bind(id)
    .first<{ parent_id: string | null }>();
  const parentOf = '(SELECT parent_id FROM folders WHERE id = ?1)';
  await env.db.batch([
    env.db
      .prepare(`UPDATE folders SET parent_id = ${parentOf}, updated_at = ?2 WHERE parent_id = ?1`)
      .bind(id, Date.now()),
    env.db.prepare(`UPDATE documents SET folder_id = ${parentOf} WHERE folder_id = ?1`).bind(id),
    env.db.prepare("DELETE FROM drive_items WHERE item_kind = 'folder' AND ld_id = ?").bind(id),
    env.db.prepare('DELETE FROM folders WHERE id = ?').bind(id),
  ]);
  return { parentId: parent?.parent_id ?? null };
}

// Cycle check for folder moves. Walks the proposed ancestor chain
// from `newParentId` upward; if we hit `folderId` along the way the
// move would form a cycle. Caller rejects with a 409 in that case.
export async function folderMoveWouldCycle(
  env: Runtime,
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
    const row = await env.db
      .prepare('SELECT parent_id FROM folders WHERE id = ?')
      .bind(here)
      .first<{ parent_id: string | null }>();
    cursor = row?.parent_id ?? null;
  }
  return false;
}
