// folders — self-referential tree, personal (owner-scoped, docs/specs/013-workspace/folders.md)
// or team-scoped (docs/specs/013-workspace/team-shared-documents.md) via the nullable team_id column.

import { rowToFolder, type FolderRow } from '../folder-row';
import type { Env, FolderDTO } from '../types';

const FOLDER_COLS = 'id, owner_id, parent_id, team_id, name, created_at, updated_at';

// Personal tree only: team folders never bleed into the owner's
// Explorer sidebar (they render on the team page instead — docs/specs/013-workspace/team-shared-documents.md).
export async function listFoldersByOwner(env: Env, ownerId: string): Promise<FolderDTO[]> {
  const result = await env.DB.prepare(
    `SELECT ${FOLDER_COLS} FROM folders WHERE owner_id = ? AND team_id IS NULL ORDER BY name ASC`,
  )
    .bind(ownerId)
    .all<FolderRow>();
  return (result.results ?? []).map(rowToFolder);
}

// One team's shared folder tree (docs/specs/013-workspace/team-shared-documents.md).
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

export async function renameFolder(env: Env, id: string, name: string): Promise<void> {
  await env.DB.prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
    .bind(name, Date.now(), id)
    .run();
}

// Deleting a folder moves its direct subfolders and documents (trashed ones too) up to its parent,
// the space's root for a top-level folder (docs/specs/013-workspace/folders.md "Deleting a folder",
// blueprint folder-delete.md). One batch, one transaction: the parent is read by subquery INSIDE it,
// while the row still exists, so a concurrent move cannot strand the contents, and the folder's
// Drive mirror row (docs/specs/022-drive-mirror/drive-mirror.md, "Data") goes with it. The FKs'
// ON DELETE SET NULL is only a backstop the explicit statements never reach. Answers the parent the
// contents moved to, read beforehand for the caller's log.
export async function deleteFolder(env: Env, id: string): Promise<{ parentId: string | null }> {
  const parent = await env.DB.prepare('SELECT parent_id FROM folders WHERE id = ?')
    .bind(id)
    .first<{ parent_id: string | null }>();
  const parentOf = '(SELECT parent_id FROM folders WHERE id = ?1)';
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE folders SET parent_id = ${parentOf}, updated_at = ?2 WHERE parent_id = ?1`,
    ).bind(id, Date.now()),
    env.DB.prepare(`UPDATE documents SET folder_id = ${parentOf} WHERE folder_id = ?1`).bind(id),
    env.DB.prepare("DELETE FROM drive_items WHERE item_kind = 'folder' AND ld_id = ?").bind(id),
    env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(id),
  ]);
  return { parentId: parent?.parent_id ?? null };
}

// Reparents a folder in ONE statement that refuses a cycle (docs/specs/013-workspace/folders.md):
// the recursive CTE walks the ancestors of the proposed parent, and the row only changes when the
// folder is not among them and the parent still exists. Checking first and writing second left a
// window in which two crossing moves (A into B, B into A) each passed the check and together made
// a loop. UNION, not UNION ALL, so the walk ends even on an already corrupt chain. Answers whether
// the folder moved; false means a cycle, or a parent deleted meanwhile, and the caller answers 409.
export async function moveFolder(env: Env, id: string, parentId: string | null): Promise<boolean> {
  const now = Date.now();
  if (parentId === null) {
    const res = await env.DB.prepare(
      'UPDATE folders SET parent_id = NULL, updated_at = ? WHERE id = ?',
    )
      .bind(now, id)
      .run();
    return (res.meta.changes ?? 0) > 0;
  }
  const res = await env.DB.prepare(
    `UPDATE folders SET parent_id = ?2, updated_at = ?3
     WHERE id = ?1
       AND EXISTS (SELECT 1 FROM folders WHERE id = ?2)
       AND NOT EXISTS (
         WITH RECURSIVE ancestors(id) AS (
           SELECT ?2
           UNION
           SELECT f.parent_id FROM folders f JOIN ancestors a ON f.id = a.id
           WHERE f.parent_id IS NOT NULL
         )
         SELECT 1 FROM ancestors WHERE id = ?1
       )`,
  )
    .bind(id, parentId, now)
    .run();
  return (res.meta.changes ?? 0) > 0;
}
