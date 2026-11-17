// The room's link to a project's sheet store (blueprint sheet-store.md "Editor slice"): attached through the bridge
// while anything draws from the store, a Sheet element in the editor or a Sheet in the side by side pane
// (docs/specs/007-editor/split-view.md "The other pane"), so a collaborator's change reaches the cells either shows.
// Counted, so the room stays attached while any of them does, and detached when the last lets go.
import { sheetToJson } from '@liveplanner/sheets';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { registerSheetSource } from '@/lib/sheet-seeds';
import type { SheetStore } from './sheet-store-client';
import { retitleSheets } from './sheet-rename';
import { sheetPresenceFor } from './sheet-presence-store';

// How many draw from each store.
const ATTACHED = new WeakMap<SheetStore, { count: number; detach: () => void }>();

function release(store: SheetStore): void {
  const held = ATTACHED.get(store);
  if (!held) return;
  if (--held.count > 0) return;
  ATTACHED.delete(store);
  held.detach();
  registerSheetSource(null);
}

/** Holds the room's link to `store`; the returned function lets go of it. */
export function attachSheetStore(store: SheetStore, bridge: SheetsBridge): () => void {
  const held = ATTACHED.get(store);
  if (held) {
    held.count++;
    return () => release(store);
  }
  const presence = sheetPresenceFor(store);
  presence.connect((op) => bridge.sendPresence(op));
  registerSheetSource((id) => {
    const sheet = store.sheet(id);
    return sheet ? sheetToJson(sheet) : undefined;
  });
  const detach = bridge.attach({
    receive: (op) => store.receive(op),
    title: (id) => store.sheet(id)?.title,
    release: (ids) => store.release(ids),
    retitle: (ids, from, to) => retitleSheets(store, ids, from, to),
    presence: (from, op) => presence.receive(from, op),
    resync: () => store.resync(),
    reannounce: () => presence.reannounce(),
  });
  ATTACHED.set(store, { count: 1, detach });
  return () => release(store);
}
