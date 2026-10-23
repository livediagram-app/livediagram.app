// Filing on create: where a new item lands when it is made without a place. A create that names no folder
// and no team, and carries a creation intent, goes to the person's default folder for it: the template
// family's key first ("liveplanner:template:kanban"), then the app's ("liveplanner"). A default whose folder
// is gone, or is in a team the person has left, is skipped; with none left the item lands at the root of
// their own space. An explicit `folderId: null` is the root chosen on purpose and never consults defaults.

import { placementDefaultKeysFor, type App } from '@liveworkspace/index-client';
import { scopesOf, type Person } from './auth';
import type { Env } from './env';
import type { FolderRow } from './folders';

export type DefaultPlacement = { folderId: string; teamId: string | null; scope: string };

/** The first working default of this create's keys, or null. One read for the defaults and their folders. */
export async function defaultPlacement(
  env: Env,
  person: Person,
  app: App,
  intent: string | null,
): Promise<DefaultPlacement | null> {
  const keys = placementDefaultKeysFor(app, intent);
  const { results } = await env.INDEX_DB.prepare(
    `SELECT d.default_key, f.id, f.team_id, f.scope FROM placement_defaults d
     JOIN folders f ON f.id = d.folder_id
     WHERE d.person_id = ? AND d.default_key IN (${keys.map(() => '?').join(', ')})`,
  )
    .bind(person.id, ...keys)
    .all<{ default_key: string } & Pick<FolderRow, 'id' | 'team_id' | 'scope'>>();
  if (results.length === 0) return null;
  const reach = scopesOf(person);
  for (const key of keys) {
    const row = results.find((r) => r.default_key === key);
    if (row && reach.includes(row.scope)) {
      return { folderId: row.id, teamId: row.team_id, scope: row.scope };
    }
  }
  return null;
}
