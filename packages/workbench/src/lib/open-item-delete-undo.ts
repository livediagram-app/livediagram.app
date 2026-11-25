// Deleting the item open in its editor (each product's docs/specs/013-workspace/trash.md "Deleting";
// liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md): from the command palette or any menu in the
// Explorer panel. It asks nothing first, since the item waits in the Trash: it is tombstoned (so neither the autosave
// debounce nor the unload flush can write it back while it goes), the index moves it to the Trash, and the editor
// leaves for the Explorer, which offers the Undo on arrival. The shared Explorer takes the item from its address
// (`?trashed=<id>&title=<name>`, dropped from the address once read); the workbench frame's Explorer takes it from
// sessionStorage, kept for one page load and only for a moment, so a later visit offers nothing.
//
// One module for every editor: each binds its own handoff key, tombstones and telemetry (its lib/*-delete-undo.ts).
import { indexClient } from './index-client';
import { explorerHref } from './explorer-href';

/** How long a handed-over delete may wait for the Explorer to take it. */
export const DELETE_HANDOFF_MAX_AGE_MS = 30_000;

type Handoff = { id: string; name?: string; at: number };

export type TrashedItem = { id: string; title: string | null };

export type OpenItemDeleteUndoConfig = {
  // The sessionStorage key the workbench frame's Explorer reads ("livediagram:deleted-document").
  key: string;
  // The editor's tombstones (lib/document-tombstones.ts, or the product's own).
  markDeleted: (id: string) => void;
  unmarkDeleted: (id: string) => void;
  // Counted once the index has taken it.
  onDeleted: () => void;
  // Whether this editor hosts a workbench frame Explorer that takes the handoff (false: the address alone carries it).
  handOff?: boolean;
};

export type OpenItemDeleteUndo = {
  /** The open item to the Trash, then to the Explorer with its Undo. False, with the item writable again, when the
   *  index refuses; the caller says so. */
  trashOpen: (
    id: string,
    name: string | null | undefined,
    leave?: (href: string) => void,
  ) => Promise<boolean>;
  handOff: (id: string, name?: string | null, now?: number) => void;
  /** The handed-over delete, taken (read once and cleared); null when there is none or it is stale. */
  take: (now?: number) => TrashedItem | null;
  /** The item deleted just before this page opened, for the Explorer's Undo; null on the server or when none. Taken
   *  once per page load and kept, so a remount (or Strict Mode's second call) sees the same answer. */
  arrived: () => TrashedItem | null;
};

export function openItemDeleteUndo(config: OpenItemDeleteUndoConfig): OpenItemDeleteUndo {
  const { key, markDeleted, unmarkDeleted, onDeleted, handOff: hands = true } = config;

  const handOff = (id: string, name?: string | null, now = Date.now()) => {
    try {
      const handoff: Handoff = { id, at: now, ...(name ? { name } : {}) };
      window.sessionStorage.setItem(key, JSON.stringify(handoff));
    } catch {
      // Storage off: the item is still in the Trash.
    }
  };

  const take = (now = Date.now()): TrashedItem | null => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) return null;
      window.sessionStorage.removeItem(key);
      const h = JSON.parse(raw) as Partial<Handoff>;
      if (typeof h.id !== 'string' || typeof h.at !== 'number') return null;
      if (now - h.at > DELETE_HANDOFF_MAX_AGE_MS || now < h.at) return null;
      return { id: h.id, title: typeof h.name === 'string' ? h.name : null };
    } catch {
      return null;
    }
  };

  let arrival: { taken: boolean; item: TrashedItem | null } = { taken: false, item: null };
  const arrived = (): TrashedItem | null => {
    if (typeof window === 'undefined') return null;
    if (!arrival.taken) arrival = { taken: true, item: take() };
    return arrival.item;
  };

  const trashOpen: OpenItemDeleteUndo['trashOpen'] = async (
    id,
    name,
    leave = (href) => window.location.assign(href),
  ) => {
    markDeleted(id);
    try {
      await indexClient.deleteItem(id);
    } catch {
      unmarkDeleted(id);
      return false;
    }
    onDeleted();
    if (hands) handOff(id, name);
    const params = new URLSearchParams({ trashed: id });
    if (name) params.set('title', name);
    leave(explorerHref('', `?${params}`));
    return true;
  };

  return { trashOpen, handOff, take, arrived };
}
