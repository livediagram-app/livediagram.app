// What a folder card shows of what is inside (`GET /folders/previews?ids=…`): for each of up to 60 of the person's
// folders, its newest few items and how many it holds, for the card's mosaic and its "N folders · N plans" line.
// One D1 batch whatever the number of folders: the newest items come from each folder's own index walk (LIMIT 4),
// and the count stops at FOLDER_COUNT_CAP, so a folder of 100,000 items costs what one of a thousand does. Subfolders
// the client already holds (it lists every folder), so they are not counted here.

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

/** The two statements of one previews read: the newest items per folder, and each folder's (capped) count. */
export function folderPreviewQueries(
  person: Person,
  folderIds: string[],
  app: App | null,
): { items: BuiltQuery; counts: BuiltQuery } {
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
  const [items, counts] = (await db.batch([
    db.prepare(q.items.sql).bind(...q.items.args),
    db.prepare(q.counts.sql).bind(...q.counts.args),
  ])) as [D1Result<ItemRow>, D1Result<{ folder_id: string; n: number }>];
  const decorated = await decorate(env, person, items.results);
  const byFolder = new Map<string, FolderPreview>();
  for (const row of counts.results) {
    byFolder.set(row.folder_id, { folderId: row.folder_id, itemCount: row.n, items: [] });
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
