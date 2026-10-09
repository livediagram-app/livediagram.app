// placement_defaults: per-person default folders (migration 0061,
// docs/specs/013-workspace/default-folders.md). Rows are keyed on the resolved owner and a default
// key; the folder is checked by the caller, on write and on every use, never by a foreign key.

import {
  PLACEMENT_DEFAULT_KEYS,
  legacyPlacementDefaultKeys,
  parsePlacementDefaultKey,
  type PlacementDefault,
  type PlacementDefaultKey,
} from '@livediagram/api-schema';
import type { Runtime } from '../types';

/** This owner's defaults for the keys in force, in key order. A row under a retired name reads as
 *  its key today (a row under today's name wins over it); a row whose key is no longer in force is
 *  left out. */
export async function listPlacementDefaults(
  env: Runtime,
  ownerId: string,
): Promise<PlacementDefault[]> {
  const res = await env.db
    .prepare('SELECT default_key, folder_id FROM placement_defaults WHERE owner_id = ?')
    .bind(ownerId)
    .all<{ default_key: string; folder_id: string }>();
  const byKey = new Map<PlacementDefaultKey, string>();
  for (const row of res.results ?? []) {
    const key = parsePlacementDefaultKey(row.default_key);
    if (!key) continue;
    if (key === row.default_key || !byKey.has(key)) byKey.set(key, row.folder_id);
  }
  return PLACEMENT_DEFAULT_KEYS.flatMap((key) => {
    const folderId = byKey.get(key);
    return folderId === undefined ? [] : [{ key, folderId }];
  });
}

/** Set this owner's default for a key; a repeat replaces the folder. */
export async function setPlacementDefault(
  env: Runtime,
  ownerId: string,
  key: PlacementDefaultKey,
  folderId: string,
): Promise<void> {
  await env.db
    .prepare(
      `INSERT INTO placement_defaults (owner_id, default_key, folder_id, updated_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (owner_id, default_key)
       DO UPDATE SET folder_id = excluded.folder_id, updated_at = excluded.updated_at`,
    )
    .bind(ownerId, key, folderId, Date.now())
    .run();
}

/** Clear this owner's default for a key, under its retired names too. Silent when there was none. */
export async function clearPlacementDefault(
  env: Runtime,
  ownerId: string,
  key: PlacementDefaultKey,
): Promise<void> {
  for (const k of [key, ...legacyPlacementDefaultKeys(key)]) {
    await env.db
      .prepare('DELETE FROM placement_defaults WHERE owner_id = ? AND default_key = ?')
      .bind(ownerId, k)
      .run();
  }
}
