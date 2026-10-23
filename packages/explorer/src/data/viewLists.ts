// Which index list each Explorer view reads, and which items still belong in it once a change is laid over
// them. One request a page, at most LIST_PAGE items; never a request per row or folder.

import type { App, IndexClient, Item, Level } from '@liveworkspace/index-client';
import type { ExplorerView } from '../views';
import type { AppFilter } from '../words';
import type { ShownItem } from './overlay';
import { relativeSince } from '../time';
import { LIST_PAGE, type ListLoader } from './useItemList';

export type SharedMeta = { level: Level; tabId: string | null; lastSeenAt: number };

export type ViewList = {
  key: string;
  load: ListLoader;
  belongs: (item: ShownItem) => boolean;
  enabled: boolean;
};

const live = (i: ShownItem) => i.trashedAt === null;

/** The list behind a view, or null for a view with no item list (Home, Inbox, Timeline). */
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
    case 'timeline':
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

// Jump Back In's groups: this many most used, then this many recent not among them (liveplanner's Within reach).
export const JUMP_BACK_IN_PER_GROUP = 4;

/** Whether an item came to Jump Back In as one of the most used (only those carry their use days). */
export const isMostUsed = (item: Pick<Item, 'useDays'>) => typeof item.useDays === 'number';

/**
 * Jump Back In's set: the `n` most used (used on at least one day), then the `n + extra` most recent not among
 * them. Nothing is padded. Most used first, in their order (days, then the latest open), then recent.
 */
export function jumpBackInSet<T extends Pick<Item, 'id' | 'useDays'>>(
  mostUsed: readonly T[],
  recent: readonly T[],
  n = JUMP_BACK_IN_PER_GROUP,
  extra = 0,
): T[] {
  const used = mostUsed.filter((i) => (i.useDays ?? 0) > 0).slice(0, n);
  const taken = new Set(used.map((i) => i.id));
  return [...used, ...recent.filter((i) => !taken.has(i.id)).slice(0, n + extra)];
}

/**
 * Jump Back In for Home and the panel: one request, Recent's first page carrying the Most Used items beside it
 * (the index's `used`). Asks for enough recent ones that `n + extra` remain once the most used are taken out.
 */
export function jumpBackInLoader(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  n = JUMP_BACK_IN_PER_GROUP,
  extra = 0,
): ListLoader {
  return async (_cursor, signal) => {
    const res = await client.listItems(
      { view: 'recent', limit: 2 * n + extra, used: n, ...(filter === 'app' ? { app } : {}) },
      { signal },
    );
    return { items: jumpBackInSet(res.mostUsed ?? [], res.items, n, extra), nextCursor: null };
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

/** Why a card is there: "Used on 5 days" for a most used one; otherwise "Opened 2 hours ago" (or when it last
 * changed, for one never opened). */
export function jumpBackInLine(
  item: Pick<Item, 'useDays' | 'lastOpenedAt' | 'updatedAt'>,
  now: number,
): string {
  if (typeof item.useDays === 'number')
    return item.useDays === 1 ? 'Used on 1 day' : `Used on ${item.useDays} days`;
  const at = item.lastOpenedAt ?? item.updatedAt;
  return `${item.lastOpenedAt ? 'Opened' : 'Changed'} ${relativeSince(at, now)}`;
}
