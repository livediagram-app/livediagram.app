'use client';

// What a person does to an item from the Explorer. Each change shows at once through the overlay (rename,
// favourite, hide from Recent, move, Trash, restore, dismiss) and is taken back, with a toast saying why, when
// the index refuses. A copy or an emptied Trash cannot be guessed, so those reload the lists instead. Every
// action is a stable function, so memoised rows keep their props.

import { useMemo } from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import type { ItemOverlay, ItemPatch } from './overlay';
import { failureText } from './errors';
import type { ToastApi } from '../ui/Toasts';
import type { OrganiseTelemetry } from '../types';

// Whose Trash an item sits in, as Trash events report it.
const trashOf = (item: { teamId: string | null }) => (item.teamId ? 'Team' : 'Personal');

export type ItemActions = {
  rename: (item: Item, title: string) => Promise<boolean>;
  setFavourite: (item: Item, favourite: boolean) => Promise<boolean>;
  /** Hide from Recent / Show in Recent: the person's own Recent and Jump Back In. */
  setHiddenFromRecent: (item: Item, hidden: boolean) => Promise<boolean>;
  move: (item: Item, to: { folderId: string | null; teamId: string | null }) => Promise<boolean>;
  trash: (item: Item) => Promise<boolean>;
  restore: (item: Item) => Promise<boolean>;
  purge: (item: Item) => Promise<boolean>;
  duplicate: (item: Item, title: string) => Promise<Item | null>;
  dismissShared: (item: Item) => Promise<boolean>;
  /** Empties one Trash: the person's own or a team's, of one app or (`app` null) every app's. */
  emptyTrash: (where: { teamId: string | null; app: App | null }) => Promise<boolean>;
};

// The host's own Trash for an item it handles itself (the plan open in the editor, which must stop saving before it
// goes): its promise settles the action. null lets the Explorer trash it.
export type HostTrash = (item: Item) => Promise<boolean> | null;

export function createItemActions({
  client,
  overlay,
  toast,
  reloadLists,
  hostTrash,
  onPlaced,
  onRenamed,
  placeName,
  onOrganise,
}: {
  client: IndexClient;
  overlay: ItemOverlay;
  toast: ToastApi;
  reloadLists: () => void;
  hostTrash?: HostTrash;
  // After an item changed place (moved, to the Trash, back, gone): what folders hold has changed.
  onPlaced?: () => void;
  // After the index took a new title.
  onRenamed?: (item: Item, title: string) => void;
  // A place's name for "moved to" ("My Work", a folder's, a team's). Without it, a move says nothing.
  placeName?: (to: { folderId: string | null; teamId: string | null }) => string;
  // Trash and team-library events, once the index took the change (OrganiseTelemetry).
  onOrganise?: OrganiseTelemetry;
}): ItemActions {
  // Every toast names what it acted on.
  const named = (item: Item) => `“${item.title || 'Untitled'}”`;
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
      if ('folderId' in patch || 'trashedAt' in patch || 'gone' in patch) onPlaced?.();
      return true;
    } catch (e) {
      undo();
      toast.error(failureText(e, fallback));
      return false;
    }
  }

  const actions: ItemActions = {
    rename: async (item, title) => {
      const next = title.trim();
      if (!next || next === item.title) return true;
      const ok = await optimistic(
        item,
        { title: next },
        () => client.updateItem(item.id, { title: next }),
        'Couldn’t rename it. Try again.',
      );
      if (ok) onRenamed?.(item, next);
      return ok;
    },
    setFavourite: (item, favourite) =>
      optimistic(
        item,
        { favourite },
        () => (favourite ? client.favourite(item.id) : client.unfavourite(item.id)),
        favourite ? 'Couldn’t add it to Favourites.' : 'Couldn’t remove it from Favourites.',
      ),
    setHiddenFromRecent: (item, hidden) =>
      optimistic(
        item,
        { hiddenFromRecent: hidden },
        () => (hidden ? client.hideFromRecent(item.id) : client.showInRecent(item.id)),
        hidden ? 'Couldn’t hide it from Recent.' : 'Couldn’t show it in Recent again.',
      ),
    move: async (item, to) => {
      // The index drops the folder when an item changes team; send the team only when it changes.
      const input =
        to.teamId === item.teamId
          ? { folderId: to.folderId }
          : { folderId: to.folderId, teamId: to.teamId };
      const from = { folderId: item.folderId, teamId: item.teamId };
      const ok = await optimistic(
        item,
        { folderId: to.folderId, teamId: to.teamId },
        () => client.updateItem(item.id, input),
        `Couldn’t move ${named(item)}. Try again.`,
      );
      // Into a team, within or between teams, or out of one to My Work.
      if (ok && (item.teamId || to.teamId)) {
        onOrganise?.(
          item.teamId === null ? 'Team·Added' : to.teamId === null ? 'Team·Removed' : 'Team·Moved',
          null,
          item.app,
        );
      }
      // Said with an Undo that moves it back, from Change Folder and a drop alike.
      if (ok && placeName) {
        toast.show(`Moved ${named(item)} to ${placeName(to)}.`, {
          tone: 'success',
          action: {
            label: 'Undo',
            run: () => void actions.move({ ...item, ...to }, from),
          },
        });
      }
      return ok;
    },
    trash: async (item) => {
      const hosted = hostTrash?.(item);
      if (hosted) {
        const done = await hosted;
        if (!done) toast.error(`Couldn’t delete ${named(item)}. Try again.`);
        return done;
      }
      const ok = await optimistic(
        item,
        { trashedAt: Date.now(), trashReason: 'deleted' },
        () => client.deleteItem(item.id),
        `Couldn’t delete ${named(item)}. Try again.`,
      );
      if (ok) {
        toast.show(`Moved ${named(item)} to the Trash.`, {
          action: { label: 'Undo', run: () => void actions.restore(item) },
        });
      }
      return ok;
    },
    restore: async (item) => {
      const ok = await optimistic(
        item,
        { trashedAt: null, trashReason: null },
        () => client.restoreItem(item.id),
        `Couldn’t restore ${named(item)}. It is still in the Trash.`,
      );
      if (ok) onOrganise?.('Trash·Restored', trashOf(item), item.app);
      if (ok) toast.show(`${named(item)} restored.`, { tone: 'success' });
      return ok;
    },
    purge: async (item) => {
      const ok = await optimistic(
        item,
        { gone: true },
        () => client.deleteItem(item.id, { permanent: true }),
        `Couldn’t delete ${named(item)}. Try again.`,
      );
      if (ok) {
        onOrganise?.('Trash·Deleted', trashOf(item), item.app);
        toast.show(`${named(item)} deleted for good.`);
      }
      return ok;
    },
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
    emptyTrash: async ({ teamId, app }) => {
      try {
        const query: { team?: string; app?: App } = {};
        if (teamId) query.team = teamId;
        if (app) query.app = app;
        const { purged } = await client.emptyTrash(query);
        onOrganise?.('Trash·Cleared', teamId ? 'Team' : 'Personal', app ?? undefined);
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
  const {
    client,
    overlay,
    toast,
    reloadLists,
    hostTrash,
    onPlaced,
    onRenamed,
    placeName,
    onOrganise,
  } = deps;
  return useMemo(
    () =>
      createItemActions({
        client,
        overlay,
        toast,
        reloadLists,
        hostTrash,
        onPlaced,
        onRenamed,
        placeName,
        onOrganise,
      }),
    [client, overlay, toast, reloadLists, hostTrash, onPlaced, onRenamed, placeName, onOrganise],
  );
}
