// Which index list each Explorer view reads, and which items still belong in it once a change is laid over
// them. One request a page, at most LIST_PAGE items; never a request per row or folder.

import type { App, IndexClient, Item, Level } from '@liveworkspace/index-client';
import type { ExplorerView } from '../views';
import type { AppFilter } from '../words';
import type { ShownItem } from './overlay';
import { LIST_PAGE, type ListLoader } from './useItemList';

export type SharedMeta = { level: Level; tabId: string | null; lastSeenAt: number };

export type ViewList = {
  key: string;
  load: ListLoader;
  belongs: (item: ShownItem) => boolean;
  enabled: boolean;
};

const live = (i: ShownItem) => i.trashedAt === null;

/** The list behind a view, or null for a view with no item list (Home, Inbox). */
export function viewList(
  client: IndexClient,
  view: ExplorerView,
  app: App,
  filter: AppFilter,
  // Filled by the Shared list with each row's link details.
  sharedMeta?: Map<string, SharedMeta>,
): ViewList | null {
  const only = filter === 'app' ? app : undefined;
  const ofApp = (i: ShownItem) => only === undefined || i.app === only;
  const page = (cursor: string | null) => ({
    limit: LIST_PAGE,
    ...(cursor ? { cursor } : {}),
    ...(only ? { app: only } : {}),
  });
  const items =
    (query: Parameters<IndexClient['listItems']>[0]): ListLoader =>
    async (cursor, signal) => {
      const res = await client.listItems({ ...query, ...page(cursor) }, { signal });
      return { items: res.items, nextCursor: res.nextCursor };
    };
  const key = (...parts: (string | undefined)[]) => [only ?? 'all', ...parts].join(':');

  switch (view.kind) {
    case 'home':
    case 'inbox':
      return null;
    case 'all':
      // My Work: my own items in no folder (its folders are rows from the folder tree).
      return {
        key: key('mine'),
        load: items({ view: 'unsorted', team: 'personal' }),
        belongs: (i) => live(i) && ofApp(i) && i.folderId === null && i.teamId === null,
        enabled: true,
      };
    case 'unsorted':
      return {
        key: key('unsorted'),
        load: items({ view: 'unsorted' }),
        belongs: (i) => live(i) && ofApp(i) && i.folderId === null,
        enabled: true,
      };
    case 'recent':
      return {
        key: key('recent'),
        load: items({ view: 'recent' }),
        belongs: (i) => live(i) && ofApp(i),
        enabled: true,
      };
    case 'favourites':
      return {
        key: key('favourites'),
        load: items({ view: 'favourites' }),
        belongs: (i) => live(i) && ofApp(i) && i.favourite,
        enabled: true,
      };
    case 'shared':
      return {
        key: key('shared'),
        load: async (cursor, signal) => {
          const res = await client.listShared(page(cursor), { signal });
          for (const s of res.shared) {
            sharedMeta?.set(s.item.id, {
              level: s.level,
              tabId: s.tabId,
              lastSeenAt: s.lastSeenAt,
            });
          }
          return {
            items: res.shared.map((s) =>
              s.item.sharedVia ? s.item : { ...s.item, sharedVia: s.code },
            ),
            nextCursor: res.nextCursor,
          };
        },
        belongs: (i) => live(i) && ofApp(i),
        enabled: true,
      };
    case 'trash':
      return {
        key: key('trash'),
        load: async (cursor, signal) => {
          const res = await client.listTrash(page(cursor), { signal });
          return { items: res.items, nextCursor: res.nextCursor };
        },
        belongs: (i) => i.trashedAt !== null && ofApp(i),
        enabled: true,
      };
    case 'search': {
      const q = view.q.trim();
      return {
        key: key('search', q),
        load: items({ view: 'all', q }),
        belongs: (i) => live(i) && ofApp(i),
        enabled: q.length > 0,
      };
    }
    case 'folder': {
      const folder = view.id;
      return {
        key: key('folder', folder),
        load: items({ view: 'all', folder }),
        belongs: (i) => live(i) && ofApp(i) && i.folderId === folder,
        enabled: true,
      };
    }
    case 'team': {
      const { id: team, folderId } = view;
      if (folderId) {
        return {
          key: key('team', team, folderId),
          load: items({ view: 'all', folder: folderId }),
          belongs: (i) => live(i) && ofApp(i) && i.folderId === folderId,
          enabled: true,
        };
      }
      return {
        key: key('team', team),
        load: items({ view: 'unsorted', team }),
        belongs: (i) => live(i) && ofApp(i) && i.teamId === team && i.folderId === null,
        enabled: true,
      };
    }
  }
}

/** The person's Recent, newest first, for Home's Jump back in (one request, no paging). */
export function recentLoader(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  limit: number,
): ListLoader {
  return async (_cursor, signal) => {
    const res = await client.listItems(
      { view: 'recent', limit, ...(filter === 'app' ? { app } : {}) },
      { signal },
    );
    return { items: res.items, nextCursor: null };
  };
}

/** What was shared with the person lately, for Home (one request, no paging). */
export function sharedRecentlyLoader(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  limit: number,
): ListLoader {
  return async (_cursor, signal) => {
    const res = await client.listShared(
      { limit, ...(filter === 'app' ? { app } : {}) },
      { signal },
    );
    return {
      items: res.shared.map((s) => (s.item.sharedVia ? s.item : { ...s.item, sharedVia: s.code })),
      nextCursor: null,
    };
  };
}

export type { Item };
