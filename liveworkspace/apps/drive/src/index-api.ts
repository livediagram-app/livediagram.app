// The index as the mirror reaches it (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The index"), through the INDEX
// binding: acting as one person on their personal items and folders (INDEX_KEY_DRIVE, X-Index-App: drive,
// X-Index-Person), and the person's drive_mirrored flag. An inbound change goes through the index's ordinary routes,
// so authorisation, the Timeline, the Explorer and open rooms behave as if the person had done it in an app.

import {
  DRIVE_LIST_PAGES_MAX,
  isAppName,
  type MirrorFolder,
  type MirrorItem,
  type MirrorTrashed,
} from '@liveworkspace/drive';
import {
  createIndexClient,
  INDEX_API_PATH,
  INDEX_APP_HEADER,
  INDEX_PERSON_HEADER,
  IndexError,
  LIST_LIMIT_MAX,
  type Item,
  type Page,
} from '@liveworkspace/index-client';
import { setting, type Env } from './env';
import { meteredFetch, type Charge } from './mirror/meter';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';

/** The person's own work, as one pass reads it. */
export type Picture = { items: MirrorItem[]; folders: MirrorFolder[]; trash: MirrorTrashed[] };

export interface PersonIndex {
  // The whole picture. Through the mirror's runtime (mirror/picture.ts), `full: false` may read only what changed.
  picture(options?: { full?: boolean }): Promise<Picture>;
  // The live items changed at or after `since` (epoch ms), with every folder and the whole Trash.
  changedSince(since: number): Promise<Picture>;
  // One item as the picture holds it (live, personal, unshared, of a mirrored app), else null.
  readItem(id: string): Promise<MirrorItem | null>;
  renameItem(id: string, name: string): Promise<void>;
  moveItem(id: string, folderId: string | null): Promise<void>;
  trashItem(id: string): Promise<void>;
  restoreItem(id: string): Promise<void>;
  purgeItem(id: string): Promise<void>;
  createFolder(id: string, name: string, parentId: string | null): Promise<void>;
  renameFolder(id: string, name: string): Promise<void>;
  moveFolder(id: string, parentId: string | null): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  // Whether the person reaches this item as their own, live (Open with): its app, or null.
  ownItem(id: string): Promise<{ app: string } | null>;
}

export interface IndexApi {
  // Each request charged to `meter`, when given (a pass's subrequest budget).
  forPerson(personId: string, meter?: Charge): PersonIndex;
  setMirrored(personId: string, mirrored: boolean): Promise<void>;
  // Null when the index couldn't say.
  isMirrored(personId: string): Promise<boolean | null>;
}

// The name the service goes by when it acts for a person (the index's DRIVE_DELEGATE).
const DRIVE_DELEGATE = 'drive';
// A service binding never looks the host up.
const BOUND_BASE = `https://index${INDEX_API_PATH}`;

/** Every page of an index list, or a throw when there are more than a pass may read: the mirror takes an item or
 *  folder missing from a list as gone, so a list cut short must stop the pass rather than bin files. */
export async function everyPage<T, K extends string>(
  read: (cursor: string | undefined) => Promise<Page<T, K>>,
  key: K,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < DRIVE_LIST_PAGES_MAX; page++) {
    const answer = await read(cursor);
    out.push(...(answer[key] as T[]));
    if (!answer.nextCursor) return out;
    cursor = answer.nextCursor;
  }
  throw new Error('drive: picture too large to read in one pass');
}

// The items the mirror writes files for: the person's own, live and unshared, of every registered app (held
// livehuddle included).
function mirrorItems(items: readonly Item[]): MirrorItem[] {
  return items.flatMap((i) =>
    i.teamId === null && i.trashedAt === null && i.sharedVia === null && isAppName(i.app)
      ? [
          {
            id: i.id,
            app: i.app,
            name: i.title,
            folderId: i.folderId,
            updatedAt: i.updatedAt,
            createdAt: i.createdAt,
          },
        ]
      : [],
  );
}

export function createIndexApi(env: Env): IndexApi {
  const key = setting(env.INDEX_KEY_DRIVE) ?? '';
  const binding = env.INDEX;
  const base = binding ? BOUND_BASE : withoutTrailingSlashes(setting(env.INDEX_URL) ?? BOUND_BASE);
  const doFetch: typeof fetch = binding
    ? (input, init) => binding.fetch(input instanceof URL ? input.toString() : input, init)
    : (input, init) => fetch(input, init);

  async function flag(personId: string, method: 'GET' | 'PUT' | 'DELETE'): Promise<Response> {
    return doFetch(`${base}/app/people/${encodeURIComponent(personId)}/drive`, {
      method,
      headers: { Authorization: `Bearer ${key}` },
    });
  }

  return {
    forPerson(personId, meter) {
      const client = createIndexClient({
        baseUrl: base,
        getToken: () => key,
        headers: { [INDEX_APP_HEADER]: DRIVE_DELEGATE, [INDEX_PERSON_HEADER]: personId },
        fetch: meter ? meteredFetch(doFetch, meter) : doFetch,
      });
      // Every folder and the whole Trash, with every live item or those changed at or after `since`.
      async function read(since?: number): Promise<Picture> {
        const [items, folders, trash] = await Promise.all([
          everyPage(
            (cursor) =>
              client.listItems({
                team: 'personal',
                limit: LIST_LIMIT_MAX,
                ...(since !== undefined ? { since } : {}),
                ...(cursor ? { cursor } : {}),
              }),
            'items',
          ),
          everyPage(
            (cursor) =>
              client.listFolders({
                team: 'personal',
                limit: LIST_LIMIT_MAX,
                ...(cursor ? { cursor } : {}),
              }),
            'folders',
          ),
          everyPage(
            (cursor) =>
              client.listTrash({
                team: 'personal',
                limit: LIST_LIMIT_MAX,
                ...(cursor ? { cursor } : {}),
              }),
            'items',
          ),
        ]);
        return {
          items: mirrorItems(items),
          folders: folders
            .filter((f) => f.teamId === null)
            .map((f) => ({
              id: f.id,
              name: f.name,
              parentId: f.parentId,
              updatedAt: f.updatedAt,
            })),
          trash: trash.flatMap((i) =>
            i.teamId === null && i.trashedAt !== null && isAppName(i.app)
              ? [{ id: i.id, app: i.app, name: i.title, trashedAt: i.trashedAt ?? 0 }]
              : [],
          ),
        };
      }
      return {
        picture: () => read(),
        changedSince: (since) => read(since),
        async readItem(id) {
          try {
            const { item } = await client.getItem(id);
            return mirrorItems([item])[0] ?? null;
          } catch (err) {
            // Gone, or no longer theirs (moved into a team): not in the picture.
            if (err instanceof IndexError && (err.status === 404 || err.status === 403))
              return null;
            throw err;
          }
        },
        renameItem: async (id, name) => void (await client.updateItem(id, { title: name })),
        moveItem: async (id, folderId) => void (await client.updateItem(id, { folderId })),
        trashItem: (id) => client.deleteItem(id),
        restoreItem: async (id) => void (await client.restoreItem(id)),
        purgeItem: (id) => client.deleteItem(id, { permanent: true }),
        createFolder: async (id, name, parentId) =>
          void (await client.createFolder({ id, name, parentId, teamId: null })),
        renameFolder: async (id, name) => void (await client.updateFolder(id, { name })),
        moveFolder: async (id, parentId) => void (await client.updateFolder(id, { parentId })),
        deleteFolder: (id) => client.deleteFolder(id),
        async ownItem(id) {
          try {
            const { item } = await client.getItem(id);
            return item.trashedAt === null && item.teamId === null ? { app: item.app } : null;
          } catch (err) {
            // Not theirs (a team's, someone else's) or gone: answered as missing.
            if (err instanceof IndexError && (err.status === 404 || err.status === 403))
              return null;
            throw err;
          }
        },
      };
    },

    async setMirrored(personId, mirrored) {
      const res = await flag(personId, mirrored ? 'PUT' : 'DELETE');
      await res.body?.cancel();
      if (!res.ok) throw new Error(`drive: index flag ${res.status}`);
    },

    async isMirrored(personId) {
      try {
        const res = await flag(personId, 'GET');
        if (!res.ok) {
          await res.body?.cancel();
          return null;
        }
        const body = (await res.json()) as { mirrored?: unknown };
        return typeof body.mirrored === 'boolean' ? body.mirrored : null;
      } catch {
        return null;
      }
    },
  };
}
