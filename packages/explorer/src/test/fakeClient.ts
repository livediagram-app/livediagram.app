// An in-memory index for the Explorer's tests: the client's read and write calls over plain arrays, a log
// of every call (to count requests), refusals on demand, and abort signals honoured like fetch's.

import {
  IndexError,
  type App,
  type Folder,
  type InboxResponse,
  type IndexClient,
  type Item,
  type ItemListQuery,
} from '@liveworkspace/index-client';

export function makeItem(i: number, over: Partial<Item> = {}): Item {
  return {
    id: `item-${i}`,
    app: 'liveplanner',
    kind: 'plan',
    title: `Item ${i}`,
    ownerId: 'user_me',
    teamId: null,
    folderId: null,
    source: null,
    intent: null,
    createdAt: 1_000_000 + i,
    updatedAt: 2_000_000 - i,
    trashedAt: null,
    trashReason: null,
    summary: {},
    access: 'edit',
    favourite: false,
    tagIds: [],
    lastOpenedAt: null,
    sharedVia: null,
    ...over,
  };
}

export type Call = { method: string; args: unknown[] };

export type FakeIndex = {
  client: IndexClient;
  items: Item[];
  folders: Folder[];
  inbox: InboxResponse;
  calls: Call[];
  // Methods that answer with this refusal until removed.
  fail: Map<string, IndexError>;
  // Holds every call of a method until released.
  hold: Set<string>;
  release: () => void;
  count: (method: string) => number;
};

const abortError = () => new DOMException('The operation was aborted.', 'AbortError');

export function createFakeIndex(seed: { items?: Item[]; folders?: Folder[] } = {}): FakeIndex {
  const items = seed.items ?? [];
  const folders = seed.folders ?? [];
  const calls: Call[] = [];
  const fail = new Map<string, IndexError>();
  const hold = new Set<string>();
  let waiting: (() => void)[] = [];
  const inbox: InboxResponse = { threads: [], actions: [] };

  function answer<T>(
    method: string,
    args: unknown[],
    signal: AbortSignal | undefined,
    value: () => T,
  ): Promise<T> {
    calls.push({ method, args });
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      const go = () => {
        if (signal?.aborted) return;
        const refusal = fail.get(method);
        if (refusal) reject(refusal);
        else
          try {
            resolve(value());
          } catch (e) {
            reject(e);
          }
      };
      if (hold.has(method)) waiting.push(go);
      else queueMicrotask(go);
    });
  }

  function page<T>(all: T[], limit = 50, cursor?: string) {
    const start = cursor ? Number(cursor) : 0;
    const slice = all.slice(start, start + limit);
    const next = start + limit < all.length ? String(start + limit) : null;
    return { slice, next };
  }

  function select(q: ItemListQuery): Item[] {
    let out = items.filter((i) => i.trashedAt === null);
    if (q.app) out = out.filter((i) => i.app === q.app);
    if (q.view === 'unsorted') out = out.filter((i) => i.folderId === null);
    if (q.view === 'favourites') out = out.filter((i) => i.favourite);
    if (q.view === 'recent') out = out.filter((i) => i.lastOpenedAt !== null);
    if (q.team === 'personal') out = out.filter((i) => i.teamId === null);
    else if (q.team) out = out.filter((i) => i.teamId === q.team);
    if (q.folder) out = out.filter((i) => i.folderId === q.folder);
    if (q.q) out = out.filter((i) => i.title.toLowerCase().includes(q.q!.toLowerCase()));
    return out;
  }

  const find = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) throw new IndexError(404, 'not_found');
    return item;
  };

  const client = {
    listItems: (query: ItemListQuery = {}, options: { signal?: AbortSignal } = {}) =>
      answer('listItems', [query], options.signal, () => {
        const { slice, next } = page(select(query), query.limit, query.cursor);
        return { items: slice.map((i) => ({ ...i })), nextCursor: next };
      }),
    listTrash: (
      query: { app?: App; limit?: number; cursor?: string } = {},
      options: { signal?: AbortSignal } = {},
    ) =>
      answer('listTrash', [query], options.signal, () => {
        const all = items.filter(
          (i) => i.trashedAt !== null && (!query.app || i.app === query.app),
        );
        const { slice, next } = page(all, query.limit, query.cursor);
        return { items: slice.map((i) => ({ ...i })), nextCursor: next };
      }),
    listShared: (
      query: { app?: App; limit?: number; cursor?: string } = {},
      options: { signal?: AbortSignal } = {},
    ) =>
      answer('listShared', [query], options.signal, () => {
        const all = items.filter((i) => i.sharedVia && (!query.app || i.app === query.app));
        const { slice, next } = page(all, query.limit, query.cursor);
        return {
          shared: slice.map((i) => ({
            item: { ...i },
            code: i.sharedVia!,
            level: i.access,
            tabId: null,
            lastSeenAt: 1,
          })),
          nextCursor: next,
        };
      }),
    listFolders: (
      query: { limit?: number; cursor?: string } = {},
      options: { signal?: AbortSignal } = {},
    ) =>
      answer('listFolders', [query], options.signal, () => {
        const { slice, next } = page(folders, query.limit, query.cursor);
        return { folders: slice.map((f) => ({ ...f })), nextCursor: next };
      }),
    folderPreviews: (
      ids: readonly string[],
      query: { app?: App } = {},
      options: { signal?: AbortSignal } = {},
    ) =>
      answer('folderPreviews', [ids, query], options.signal, () => ({
        previews: ids
          .filter((id) => folders.some((f) => f.id === id))
          .map((folderId) => {
            const inside = items
              .filter(
                (i) =>
                  i.folderId === folderId &&
                  i.trashedAt === null &&
                  (!query.app || i.app === query.app),
              )
              .sort((a, b) => b.updatedAt - a.updatedAt);
            return {
              folderId,
              itemCount: inside.length,
              items: inside.slice(0, 4).map((i) => ({ ...i })),
            };
          }),
      })),
    inbox: (query: { app?: App } = {}, options: { signal?: AbortSignal } = {}) =>
      answer('inbox', [query], options.signal, () => ({
        threads: inbox.threads.filter((t) => !query.app || t.app === query.app),
        actions: inbox.actions.filter((a) => !query.app || a.app === query.app),
      })),
    updateItem: (id: string, input: Partial<Item>) =>
      answer('updateItem', [id, input], undefined, () => {
        const item = find(id);
        Object.assign(item, input);
        return { item: { ...item } };
      }),
    favourite: (id: string) =>
      answer('favourite', [id], undefined, () => {
        find(id).favourite = true;
      }),
    unfavourite: (id: string) =>
      answer('unfavourite', [id], undefined, () => {
        find(id).favourite = false;
      }),
    deleteItem: (id: string, options: { permanent?: boolean } = {}) =>
      answer('deleteItem', [id, options], undefined, () => {
        if (options.permanent) items.splice(items.indexOf(find(id)), 1);
        else Object.assign(find(id), { trashedAt: Date.now(), trashReason: 'deleted' });
      }),
    restoreItem: (id: string) =>
      answer('restoreItem', [id], undefined, () => {
        const item = find(id);
        Object.assign(item, { trashedAt: null, trashReason: null });
        return { item: { ...item } };
      }),
    copyItem: (id: string, input: { title?: string } = {}) =>
      answer('copyItem', [id, input], undefined, () => {
        const from = find(id);
        const copy = { ...from, id: `${from.id}-copy`, title: input.title ?? from.title };
        items.unshift(copy);
        return { item: { ...copy } };
      }),
    removeShared: (id: string) => answer('removeShared', [id], undefined, () => undefined),
    emptyTrash: () =>
      answer('emptyTrash', [], undefined, () => {
        const before = items.length;
        for (let i = items.length - 1; i >= 0; i--)
          if (items[i]!.trashedAt !== null) items.splice(i, 1);
        return { purged: before - items.length };
      }),
    createFolder: (input: {
      id?: string;
      name: string;
      parentId?: string | null;
      teamId?: string | null;
    }) =>
      answer('createFolder', [input], undefined, () => {
        const folder: Folder = {
          id: input.id ?? `folder-${folders.length}`,
          name: input.name,
          parentId: input.parentId ?? null,
          teamId: input.teamId ?? null,
          ownerId: 'user_me',
          createdAt: 1,
          updatedAt: 1,
        };
        folders.push(folder);
        return { folder: { ...folder } };
      }),
    updateFolder: (id: string, input: Partial<Folder>) =>
      answer('updateFolder', [id, input], undefined, () => {
        const folder = folders.find((f) => f.id === id)!;
        Object.assign(folder, input);
        return { folder: { ...folder } };
      }),
    deleteFolder: (id: string) =>
      answer('deleteFolder', [id], undefined, () => {
        folders.splice(
          folders.findIndex((f) => f.id === id),
          1,
        );
      }),
    listShareLinks: (id: string) =>
      answer('listShareLinks', [id], undefined, () => ({ links: [], passwordSet: false })),
  } as unknown as IndexClient;

  return {
    client,
    items,
    folders,
    inbox,
    calls,
    fail,
    hold,
    release: () => {
      const run = waiting;
      waiting = [];
      hold.clear();
      for (const go of run) go();
    },
    count: (method) => calls.filter((c) => c.method === method).length,
  };
}
