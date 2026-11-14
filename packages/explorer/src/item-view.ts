// The place that holds an item, for an editor's door from an open item (liveworkspace/docs/specs/004-index/one-explorer.md
// "Opening from an open item"): the editor hands over only the item's id (`/explorer?item=<id>`) and the Explorer
// works out where it lives, from This Browser's list or the index, the same way for every app.
import type { IndexClient, Item } from '@liveworkspace/index-client';
import type { ThisBrowserItem } from './this-browser';
import type { ExplorerView } from './views';

/** The query key an editor's door names the open item by. */
export const ITEM_PARAM = 'item';

/** What the person is: who they are and the teams they are in. */
export type ItemViewer = { id: string; teamIds: readonly string[] };

type Placed = Pick<Item, 'ownerId' | 'teamId' | 'folderId' | 'trashedAt'> & {
  archivedAt?: number | null;
};

/** The view that holds an item the index answered, for this person. First match wins: the Trash, Archived, a team
 *  they are in (at its folder), their own (its folder, or My Work), and anything else they reach is Shared With Me. */
export function viewOfItem(item: Placed, viewer: ItemViewer): ExplorerView {
  if (item.trashedAt !== null) return { kind: 'trash' };
  if (item.archivedAt != null) return { kind: 'archived' };
  if (item.teamId) {
    if (!viewer.teamIds.includes(item.teamId)) return { kind: 'shared' };
    return item.folderId
      ? { kind: 'team', id: item.teamId, folderId: item.folderId }
      : { kind: 'team', id: item.teamId };
  }
  if (item.ownerId !== viewer.id) return { kind: 'shared' };
  return item.folderId ? { kind: 'folder', id: item.folderId } : { kind: 'all' };
}

/** The view that holds an item kept only in this browser: This Browser, at its local folder. */
export function viewOfLocalItem(item: Pick<ThisBrowserItem, 'folderId'>): ExplorerView {
  return item.folderId ? { kind: 'offline', folder: item.folderId } : { kind: 'offline' };
}

/** The place that holds item `id`: This Browser's when this browser keeps it (no request), else the index's answer;
 *  null when the index can't answer it (gone, or not the person's to reach), so the page opens as it would have. */
export async function resolveItemView(
  id: string,
  {
    client,
    viewer,
    local,
  }: {
    client: Pick<IndexClient, 'getItem'>;
    viewer: ItemViewer;
    local: readonly ThisBrowserItem[];
  },
): Promise<ExplorerView | null> {
  const kept = local.find((item) => item.id === id);
  if (kept) return viewOfLocalItem(kept);
  try {
    const { item } = await client.getItem(id);
    return viewOfItem(item, viewer);
  } catch {
    return null;
  }
}
