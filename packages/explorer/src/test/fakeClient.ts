// An in-memory index for the Explorer's tests: the client's read and write calls over plain arrays, a log
// of every call (to count requests), refusals on demand, and abort signals honoured like fetch's.

import {
  IndexError,
  type App,
  type Folder,
  type InboxResponse,
  type IndexClient,
  type Item,
  type ItemFilters,
  type ItemListQuery,
  type SharedListQuery,
  type TimelineEvent,
  type TimelineQuery,
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
    lastOpenedAt: null,
    sharedVia: null,
    ...over,
  };
}

export function makeEvent(
  i: number,
  over: Partial<TimelineEvent> = {},
  item: Partial<Item> = {},
): TimelineEvent & { item: Item; itemId: string } {
  const it = makeItem(i, item);
  return {
    id: `ev-${i}`,
    app: it.app,
    type: 'created',
    actorId: 'user_me',
    actorName: null,
    itemId: it.id,
    title: it.title,
    detail: null,
    occurredAt: Date.now() - i * 60_000,
    item: it,
    ...over,
  } as TimelineEvent & { item: Item; itemId: string };
}

export type Call = { method: string; args: unknown[] };

export type FakeIndex = {
  client: IndexClient;
  items: Item[];
  folders: Folder[];
  // The reader's default folders: key to folder id.
  placementDefaults: Map<string, string>;
  inbox: InboxResponse;
  // The Timeline, newest first or not (the fake sorts), and when the person last marked it seen.
  events: TimelineEvent[];
  timelineSeen: { at: number | null };
  calls: Call[];
  // Methods that answer with this refusal until removed.
  fail: Map<string, IndexError>;
  // Holds every call of a method until released.
  hold: Set<string>;
  release: () => void;
  count: (method: string) => number;
};

const abortError = () => new DOMException('The operation was aborted.', 'AbortError');

export function createFakeIndex(
  seed: {
    items?: Item[];
    folders?: Folder[];
    events?: TimelineEvent[];
    seenAt?: number | null;
    defaults?: Record<string, string>;
  } = {},
): FakeIndex {
  const items = seed.items ?? [];
  const events = seed.events ?? [];
  const timelineSeen = { at: seed.seenAt ?? null };
  const folders = seed.folders ?? [];
  const placementDefaults = new Map(Object.entries(seed.defaults ?? {}));
  const calls: Call[] = [];
  const fail = new Map<string, IndexError>();
  const hold = new Set<string>();
  let waiting: (() => void)[] = [];
  const inbox: InboxResponse = { threads: [], actions: [], forms: [], timelineNew: 0 };

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

  // The index's lens filters (one-explorer-contracts.md "The lens's filters"), the asker being user_me.
  function narrow(out: Item[], q: ItemFilters): Item[] {
    const words = q.q ? q.q.toLowerCase().split(/\s+/).filter(Boolean) : [];
    const last = (intent: string | null) =>
      intent ? intent.slice(intent.lastIndexOf(':') + 1) : null;
    return out.filter(
      (i) =>
        words.every((w) => i.title.toLowerCase().includes(w)) &&
        (!q.apps?.length || q.apps.includes(i.app)) &&
        (!q.source?.length || (i.source !== null && q.source.includes(i.source))) &&
        (q.since === undefined || i.updatedAt >= q.since) &&
        (!q.owner || (q.owner === 'me') === (i.ownerId === 'user_me')) &&
        (!q.intent?.length || q.intent.includes(last(i.intent) ?? '')) &&
        (!q.space?.length ||
          q.space.some((s) =>
            s === 'shared'
              ? Boolean(i.sharedVia)
              : s === 'mine'
                ? !i.sharedVia && i.teamId === null
                : !i.sharedVia && i.teamId === s.slice('team:'.length),
          )),
    );
  }

  function subtree(root: string): Set<string> {
    const out = new Set([root]);
    for (let grew = true; grew;) {
      grew = false;
      for (const f of folders) {
        if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
          out.add(f.id);
          grew = true;
        }
      }
    }
    return out;
  }

  function select(q: ItemListQuery): Item[] {
    let out = items.filter((i) => i.trashedAt === null);
    if (q.app) out = out.filter((i) => i.app === q.app);
    if (q.view === 'unsorted') out = out.filter((i) => i.folderId === null);
    if (q.view === 'favourites') out = out.filter((i) => i.favourite);
    if (q.view === 'recent') {
      out = out.filter((i) => i.lastOpenedAt !== null && !i.hiddenFromRecent);
    }
    if (q.team === 'personal') out = out.filter((i) => i.teamId === null && !i.sharedVia);
    else if (q.team) out = out.filter((i) => i.teamId === q.team);
    if (q.folder) {
      const reach = q.deep ? subtree(q.folder) : new Set([q.folder]);
      out = out.filter((i) => i.folderId !== null && reach.has(i.folderId));
    }
    return narrow(out, q);
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
        // A seeded item's `useDays` is the index's use_days for it: only Most Used carries it.
        const bare = ({ useDays: _days, ...i }: Item) => i;
        const result: {
          items: Item[];
          nextCursor: string | null;
          mostUsed?: Item[];
          mine?: { count: number; more: boolean };
          any?: boolean;
        } = {
          items: slice.map(bare),
          nextCursor: next,
        };
        // Home's reads beside a first page: My Work's count (yours, in no team) and whether anything opens.
        if (query.mine && !query.cursor) {
          const own = select({ view: 'all', team: 'personal', app: query.app }).length;
          result.mine = { count: Math.min(own, query.mine), more: own > query.mine };
        }
        if (query.any && !query.cursor)
          result.any = select({ view: 'search', app: query.app }).length > 0;
        if (query.used && query.view === 'recent' && !query.cursor) {
          result.mostUsed = select(query)
            .filter((i) => (i.useDays ?? 0) > 0)
            .sort(
              (a, b) => b.useDays! - a.useDays! || (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0),
            )
            .slice(0, query.used)
            .map((i) => ({ ...i }));
        }
        return result;
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
    listShared: (query: SharedListQuery = {}, options: { signal?: AbortSignal } = {}) =>
      answer('listShared', [query], options.signal, () => {
        const all = narrow(
          items.filter((i) => i.sharedVia && (!query.app || i.app === query.app)),
          query,
        );
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
        forms: inbox.forms.filter((f) => !query.app || f.app === query.app),
        timelineNew: inbox.timelineNew,
      })),
    timeline: (query: TimelineQuery = {}, options: { signal?: AbortSignal } = {}) =>
      answer('timeline', [query], options.signal, () => {
        const mine = events
          .filter((e) => !query.app || e.app === query.app)
          .filter((e) => !query.item || e.itemId === query.item)
          // One team's activity: the events on its items.
          .filter((e) => !query.team || e.item?.teamId === query.team)
          .sort((a, b) => b.occurredAt - a.occurredAt);
        const { slice, next } = page(mine, query.limit ?? 30, query.cursor);
        return { events: slice, nextCursor: next, seenAt: timelineSeen.at };
      }),
    dismissTimelineEvents: (ids: string[]) =>
      answer('dismissTimelineEvents', [ids], undefined, () => {
        for (const id of ids) {
          const at = events.findIndex((e) => e.id === id);
          if (at >= 0) events.splice(at, 1);
        }
      }),
    markTimelineSeen: () =>
      answer('markTimelineSeen', [], undefined, () => {
        timelineSeen.at = Date.now();
        return { seenAt: timelineSeen.at };
      }),
    getItem: (id: string) => answer('getItem', [id], undefined, () => ({ item: { ...find(id) } })),
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
    hideFromRecent: (id: string) =>
      answer('hideFromRecent', [id], undefined, () => {
        find(id).hiddenFromRecent = true;
      }),
    showInRecent: (id: string) =>
      answer('showInRecent', [id], undefined, () => {
        find(id).hiddenFromRecent = false;
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
    emptyTrash: (query: { team?: string; app?: App } = {}) =>
      answer('emptyTrash', [query], undefined, () => {
        const before = items.length;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i]!;
          if (it.trashedAt === null) continue;
          if ((it.teamId ?? undefined) !== query.team) continue;
          if (query.app && it.app !== query.app) continue;
          items.splice(i, 1);
        }
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
        // As the index does: the folder's children (folders and items) move up a level.
        const parentId = folders.find((f) => f.id === id)?.parentId ?? null;
        for (const f of folders) if (f.parentId === id) f.parentId = parentId;
        for (const i of items) if (i.folderId === id) i.folderId = parentId;
        folders.splice(
          folders.findIndex((f) => f.id === id),
          1,
        );
      }),
    listPlacementDefaults: () =>
      answer('listPlacementDefaults', [], undefined, () => ({
        defaults: [...placementDefaults].map(([key, folderId]) => ({ key, folderId })),
      })),
    setPlacementDefault: (key: string, folderId: string) =>
      answer('setPlacementDefault', [key, folderId], undefined, () => {
        placementDefaults.set(key, folderId);
      }),
    clearPlacementDefault: (key: string) =>
      answer('clearPlacementDefault', [key], undefined, () => {
        placementDefaults.delete(key);
      }),
    listShareLinks: (id: string) =>
      answer('listShareLinks', [id], undefined, () => ({ links: [], passwordSet: false })),
  } as unknown as IndexClient;

  return {
    client,
    items,
    folders,
    placementDefaults,
    inbox,
    events,
    timelineSeen,
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
