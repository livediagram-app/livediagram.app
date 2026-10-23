'use client';

// What a person does to an item from the Explorer. Each change shows at once through the overlay (rename,
// favourite, move, Trash, restore, dismiss) and is taken back, with a toast saying why, when the index
// refuses. A copy or an emptied Trash cannot be guessed, so those reload the lists instead. Every action is
// a stable function, so memoised rows keep their props.

import { useMemo } from 'react';
import type { IndexClient, Item } from '@liveworkspace/index-client';
import type { ItemOverlay, ItemPatch } from './overlay';
import { failureText } from './errors';
import type { ToastApi } from '../ui/Toasts';

export type ItemActions = {
  rename: (item: Item, title: string) => Promise<boolean>;
  setFavourite: (item: Item, favourite: boolean) => Promise<boolean>;
  move: (item: Item, to: { folderId: string | null; teamId: string | null }) => Promise<boolean>;
  trash: (item: Item) => Promise<boolean>;
  restore: (item: Item) => Promise<boolean>;
  purge: (item: Item) => Promise<boolean>;
  duplicate: (item: Item, title: string) => Promise<Item | null>;
  dismissShared: (item: Item) => Promise<boolean>;
  emptyTrash: () => Promise<boolean>;
};

export function createItemActions({
  client,
  overlay,
  toast,
  reloadLists,
}: {
  client: IndexClient;
  overlay: ItemOverlay;
  toast: ToastApi;
  reloadLists: () => void;
}): ItemActions {
  // Patch, call, and on a refusal take the patch back and say why.
  async function optimistic(
    item: Item,
    patch: ItemPatch,
    call: () => Promise<unknown>,
    fallback: string,
  ): Promise<boolean> {
    const undo = overlay.patch(item.id, patch);
    try {
      await call();
      return true;
    } catch (e) {
      undo();
      toast.error(failureText(e, fallback));
      return false;
    }
  }

  const actions: ItemActions = {
    rename: (item, title) => {
      const next = title.trim();
      if (!next || next === item.title) return Promise.resolve(true);
      return optimistic(
        item,
        { title: next },
        () => client.updateItem(item.id, { title: next }),
        'Couldn’t rename it. Try again.',
      );
    },
    setFavourite: (item, favourite) =>
      optimistic(
        item,
        { favourite },
        () => (favourite ? client.favourite(item.id) : client.unfavourite(item.id)),
        favourite ? 'Couldn’t add it to Favourites.' : 'Couldn’t remove it from Favourites.',
      ),
    move: (item, to) => {
      // The index drops the folder when an item changes team; send the team only when it changes.
      const input =
        to.teamId === item.teamId
          ? { folderId: to.folderId }
          : { folderId: to.folderId, teamId: to.teamId };
      return optimistic(
        item,
        { folderId: to.folderId, teamId: to.teamId },
        () => client.updateItem(item.id, input),
        'Couldn’t move it. Try again.',
      );
    },
    trash: async (item) => {
      const ok = await optimistic(
        item,
        { trashedAt: Date.now(), trashReason: 'deleted' },
        () => client.deleteItem(item.id),
        'Couldn’t move it to the Trash. Try again.',
      );
      if (ok) {
        toast.show(`Moved “${item.title || 'Untitled'}” to the Trash.`, {
          action: { label: 'Undo', run: () => void actions.restore(item) },
        });
      }
      return ok;
    },
    restore: (item) =>
      optimistic(
        item,
        { trashedAt: null, trashReason: null },
        () => client.restoreItem(item.id),
        'Couldn’t restore it. Try again.',
      ),
    purge: (item) =>
      optimistic(
        item,
        { gone: true },
        () => client.deleteItem(item.id, { permanent: true }),
        'Couldn’t delete it. Try again.',
      ),
    duplicate: async (item, title) => {
      try {
        const { item: copy } = await client.copyItem(item.id, { title }, sharedAccess(item));
        reloadLists();
        toast.show(`Made “${copy.title}”.`, { tone: 'success' });
        return copy;
      } catch (e) {
        toast.error(failureText(e, 'Couldn’t duplicate it. Try again.'));
        return null;
      }
    },
    dismissShared: (item) =>
      optimistic(
        item,
        { gone: true },
        () => client.removeShared(item.id),
        'Couldn’t remove it from Shared With Me.',
      ),
    emptyTrash: async () => {
      try {
        const { purged } = await client.emptyTrash();
        reloadLists();
        toast.show(purged === 1 ? 'Deleted 1 item for good.' : `Deleted ${purged} items for good.`);
        return true;
      } catch (e) {
        toast.error(failureText(e, 'Couldn’t empty the Trash. Try again.'));
        return false;
      }
    },
  };
  return actions;
}

function sharedAccess(item: Item) {
  return item.sharedVia ? { code: item.sharedVia } : null;
}

export function useItemActions(deps: Parameters<typeof createItemActions>[0]): ItemActions {
  const { client, overlay, toast, reloadLists } = deps;
  return useMemo(
    () => createItemActions({ client, overlay, toast, reloadLists }),
    [client, overlay, toast, reloadLists],
  );
}
