// What a folder card shows of what is inside (`GET /folders/previews?ids=…`): for each of up to 60 of the person's
// folders, its newest few items and how many it holds, for the card's mosaic and its "N folders · N plans" line.
// One D1 batch whatever the number of folders: the newest items come from each folder's own index walk (LIMIT 4),
// and the count stops at FOLDER_COUNT_CAP, so a folder of 100,000 items costs what one of a thousand does. Subfolders
// the client already holds (it lists every folder), so they are not counted here. A third statement counts each app's
// items through the folder's whole subtree (the folder badges, liveworkspace/docs/specs/004-index/one-explorer.md
// "What a folder holds, at a glance"): every app whatever the filter, in the folder's scope only, at most
// FOLDER_COUNT_CAP items a folder, so a deep tree costs what one of a thousand items does.

import {
  FOLDER_PREVIEW_COUNT_CAP,
  FOLDER_PREVIEW_IDS_MAX,
  FOLDER_PREVIEW_ITEMS,
  isApp,
  type App,
  type FolderPreview,
} from '@liveworkspace/index-client';
import { scopesOf, type Person } from './auth';
import { isId } from './codec';
import type { PersonContext } from './context';
import type { Env } from './env';
import { badRequest, json } from './http';
import { decorate, ITEM_COLUMNS, type ItemRow } from './rows';

const IN_JSON = 'IN (SELECT value FROM json_each(?))';

export type BuiltQuery = { sql: string; args: unknown[] };

/** The three statements of one previews read: the newest items per folder, each folder's (capped) count, and each
 *  app's count through its subtree. */
export function folderPreviewQueries(
  person: Person,
  folderIds: string[],
  app: App | null,
): { items: BuiltQuery; counts: BuiltQuery; apps: BuiltQuery } {
  const ids = JSON.stringify(folderIds);
  const scopes = JSON.stringify(scopesOf(person));
  const appWhere = app ? 'AND x.app = ?' : '';
  const appArgs = app ? [app] : [];
  // Only the person's own folders and their teams': anything else is answered as empty.
  const folders = `SELECT f.id FROM folders f WHERE f.id ${IN_JSON} AND f.scope ${IN_JSON}`;
  return {
    items: {
      sql: `SELECT ${ITEM_COLUMNS} FROM (${folders}) f JOIN items i ON i.id IN (
          SELECT x.id FROM items x WHERE x.folder_id = f.id AND x.trashed_at IS NULL ${appWhere}
          ORDER BY x.updated_at DESC, x.id DESC LIMIT ${FOLDER_PREVIEW_ITEMS})
        ORDER BY i.folder_id, i.updated_at DESC, i.id DESC`,
      args: [ids, scopes, ...appArgs],
    },
    counts: {
      sql: `SELECT f.id AS folder_id, (SELECT COUNT(*) FROM (
          SELECT 1 FROM items x WHERE x.folder_id = f.id AND x.trashed_at IS NULL ${appWhere}
          LIMIT ${FOLDER_PREVIEW_COUNT_CAP})) AS n
        FROM (${folders}) f`,
      args: [...appArgs, ids, scopes],
    },
    apps: {
      // Each reached folder and every folder under it (folders_parent, a step per level; UNION drops a repeat), then
      // per folder at most the cap of its subtree's live items in its scopes (items_folder), grouped by app. An app
      // acting for a person counts its own app's alone.
      sql: `WITH RECURSIVE roots(id) AS (${folders}),
        tree(root, id) AS (SELECT id, id FROM roots
          UNION SELECT t.root, c.id FROM folders c JOIN tree t ON c.parent_id = t.id)
        SELECT r.id AS folder_id, i.app AS app, COUNT(*) AS n FROM roots r JOIN items i ON i.id IN (
          SELECT x.id FROM tree t CROSS JOIN items x INDEXED BY items_folder ON x.folder_id = t.id
          WHERE t.root = r.id AND x.trashed_at IS NULL AND x.scope ${IN_JSON} ${person.app ? 'AND x.app = ?' : ''}
          LIMIT ${FOLDER_PREVIEW_COUNT_CAP})
        GROUP BY r.id, i.app`,
      args: [ids, scopes, scopes, ...(person.app ? [person.app] : [])],
    },
  };
}

export async function folderPreviews(
  env: Env,
  person: Person,
  folderIds: string[],
  app: App | null,
): Promise<FolderPreview[]> {
  if (folderIds.length === 0) return [];
  const q = folderPreviewQueries(person, folderIds, app);
  const db = env.INDEX_DB;
  const [items, counts, apps] = (await db.batch([
    db.prepare(q.items.sql).bind(...q.items.args),
    db.prepare(q.counts.sql).bind(...q.counts.args),
    db.prepare(q.apps.sql).bind(...q.apps.args),
  ])) as [
    D1Result<ItemRow>,
    D1Result<{ folder_id: string; n: number }>,
    D1Result<{ folder_id: string; app: App; n: number }>,
  ];
  const decorated = await decorate(env, person, items.results);
  const byFolder = new Map<string, FolderPreview>();
  for (const row of counts.results) {
    byFolder.set(row.folder_id, { folderId: row.folder_id, itemCount: row.n, items: [], apps: {} });
  }
  for (const row of apps.results) {
    const preview = byFolder.get(row.folder_id);
    if (preview?.apps) preview.apps[row.app] = row.n;
  }
  for (const item of decorated) {
    if (item.folderId) byFolder.get(item.folderId)?.items.push(item);
  }
  // In the order asked, each folder once.
  return [...new Set(folderIds)].flatMap((id) => {
    const preview = byFolder.get(id);
    return preview ? [preview] : [];
  });
}

export async function handleFolderPreviews(ctx: PersonContext): Promise<Response> {
  const { env, url, person } = ctx;
  const raw = url.searchParams.get('ids') ?? '';
  const ids = raw === '' ? [] : raw.split(',');
  if (ids.length > FOLDER_PREVIEW_IDS_MAX || !ids.every(isId)) return badRequest('invalid_query');
  // An app acting for a person sees only its own items.
  const app = person.app ?? url.searchParams.get('app');
  if (app !== null && !isApp(app)) return badRequest('invalid_app');
  return json({ previews: await folderPreviews(env, person, ids, app) });
}
