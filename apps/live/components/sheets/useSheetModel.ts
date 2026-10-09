'use client';

// One Sheet element's view of the sheet store (blueprint sheet-store.md "Editor slice"): the store of its document
// (attached to the room through the bridge once), its tab loaded, its sheet made when it was just placed or copied,
// and the Plan cards handed to formulas that read them. Re-renders when the store moves on.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  copyTitle,
  emptyLayout,
  nextSheetTitle,
  sheetToJson,
  uniqueSheetTitle,
  type Sheet,
  type Workbook,
} from '@livediagram/sheets';
import { cardSourceOf } from '@livediagram/items';
import type { ShapeElement } from '@livediagram/document';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import {
  registerSheetSource,
  rememberSetupStart,
  sheetSeed,
  takePlacedSheet,
} from '@/lib/sheet-seeds';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { sheetStoreOf, type SheetStore, type TabStatus } from './sheet-store-client';
import { sheetPresenceFor } from './sheet-presence-store';
import { CSV_TRUNCATED, csvWrites } from './sheet-csv';

export type SheetModel = {
  store: SheetStore;
  sheet: Sheet | undefined;
  workbook: Workbook;
  status: TabStatus | undefined;
  version: number;
};

// How many Sheets draw from each store, so the room stays attached while any does.
const ATTACHED = new WeakMap<SheetStore, { count: number; detach: () => void }>();

function release(store: SheetStore): void {
  const held = ATTACHED.get(store);
  if (!held) return;
  if (--held.count > 0) return;
  ATTACHED.delete(store);
  held.detach();
  registerSheetSource(null);
}

function fillFromCsv(
  store: SheetStore,
  tabId: string,
  sheetId: string,
  text: string,
  toast: (m: string) => void,
) {
  const made = csvWrites(store.workbook(tabId), sheetId, { r: 0, c: 0 }, text);
  if (!made) return;
  // Part of placing the Sheet (undone by removing it), not a change of its own.
  store.writeAll(
    made.writes.map((write) => ({ sheetId, write })),
    { undoable: false },
  );
  if (made.truncated) toast(CSV_TRUNCATED);
}

export const SHEET_TOO_BIG_TO_PASTE =
  'This sheet is too big to paste into another document; download it as CSV instead';

export function useSheetModel(
  element: ShapeElement,
  bridge: SheetsBridge,
  plan: PlanContextValue | undefined,
): SheetModel {
  const store = sheetStoreOf(bridge);
  // The room reaches this document's store once, whichever Sheet draws first.
  useEffect(() => {
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
      presence: (from, op) => presence.receive(from, op),
      resync: () => store.resync(),
      reannounce: () => presence.reannounce(),
    });
    ATTACHED.set(store, { count: 1, detach });
    return () => release(store);
  }, [store, bridge]);

  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  // Someone new in the room hears this person's selection (as a Plan card hold is said again).
  const peerIds = bridge.peers.map((p) => p.id).join(',');
  useEffect(() => {
    if (peerIds) sheetPresenceFor(store).reannounce();
  }, [peerIds, store]);
  const ref = element.planSheet;
  const sheetId = ref?.sheetId ?? '';
  const known = sheetId ? store.sheet(sheetId) : undefined;
  // A sheet already loaded knows its tab; a new or copied one is on the tab open now.
  const tabId = known?.tabId ?? bridge.activeTabId;
  const status = store.status(tabId);

  useEffect(() => {
    if (tabId) void store.loadTab(tabId);
  }, [store, tabId]);

  // Make the sheet a placed or copied Sheet names, once the tab has loaded and it is not there.
  useEffect(() => {
    if (!sheetId || status !== 'ready' || store.sheet(sheetId) || !bridge.canEdit) return;
    // Undo brought back a Sheet this person deleted with its sheet: the sheet comes back as it was.
    if (store.restoreReleased(sheetId)) return;
    const titles = store.titlesOn(tabId);
    const placed = takePlacedSheet(sheetId);
    if (placed) {
      const title = placed.title ? uniqueSheetTitle(placed.title, titles) : nextSheetTitle(titles);
      // Placed from the palette, it awaits setup (sheet.md "Setup Sheet"); a dropped CSV fills it instead.
      const layout = emptyLayout();
      store.create({
        id: sheetId,
        tabId,
        title,
        layout: placed.csv ? layout : { ...layout, setupPending: true },
      });
      if (placed.start) rememberSetupStart(sheetId, placed.start);
      // A dropped CSV file: its rows, read as typed, from A1.
      if (placed.csv) fillFromCsv(store, tabId, sheetId, placed.csv, bridge.toast);
      return;
    }
    const from = ref?.copyOf;
    if (!from) return;
    const source = store.sheet(from);
    const seed = sheetSeed(from);
    const title = copyTitle(source?.title ?? seed?.title ?? 'Sheet', titles);
    if (source) {
      store.create(
        { id: sheetId, tabId, title, copyOf: from },
        { ...sheetToJson(source), id: sheetId, tabId, title, rev: 0 },
      );
    } else if (seed) {
      store.create(
        { id: sheetId, tabId, title, layout: seed.layout, cells: seed.cells },
        { ...seed, id: sheetId, tabId, title, rev: 0 },
      );
    } else {
      // The source is in this document but on a tab not loaded: the server copies it. Not there (a paste from
      // another document of a sheet too big to travel on the clipboard): the paste is refused.
      store.create({ id: sheetId, tabId, title, copyOf: from }, undefined, {
        onRefused: (code) => {
          if (code !== 'sheet_not_found') return false;
          bridge.toast(SHEET_TOO_BIG_TO_PASTE);
          bridge.commitElements((els) => els.filter((el) => el.id !== element.id));
          return true;
        },
      });
    }
    // The copy is made: drop the mark, so copying this Sheet copies it and not the original.
    bridge.commitElements((els) =>
      els.map((el) =>
        el.id === element.id && el.type === 'shape' && el.planSheet?.copyOf
          ? { ...el, planSheet: { sheetId: el.planSheet.sheetId } }
          : el,
      ),
    );
  }, [sheetId, status, store, tabId, bridge, ref?.copyOf, element.id]);

  // Plan cards for the card functions (formulas.md "Plan cards"), when a formula on the tab reads them.
  const workbook = store.workbook(tabId);
  const items = plan?.items;
  const types = plan?.types;
  const statusNames = plan?.statusNames;
  const usesCards = useMemo(() => workbook.usesCards(), [workbook, version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!usesCards || !items || !types) return;
    store.setCards(cardSourceOf(items.values(), types, { statusNames, version: Date.now() }));
  }, [usesCards, items, types, statusNames, store]);

  return { store, sheet: sheetId ? store.sheet(sheetId) : undefined, workbook, status, version };
}
