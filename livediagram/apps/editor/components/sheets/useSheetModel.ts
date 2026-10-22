'use client';

// One Sheet element's view of the sheet store (blueprint sheet-store.md "Editor slice"): the store of its document
// (attached to the room through the bridge once), its tab loaded, its sheet made when it was just placed or copied,
// and the Plan cards handed to formulas that read them. Re-renders when the store moves on.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  copyTitle,
  emptyLayout,
  isTemplateStart,
  templateSheetWithCharts,
  nextSheetTitle,
  designWrite,
  sheetTemplate,
  sheetToJson,
  TEMPLATE_LOOK,
  uniqueSheetTitle,
  type Sheet,
  type Workbook,
} from '@livediagram/sheets';
import { cardSourceOf } from '@livediagram/items';
import { templateChartElements } from '@livediagram/templates/template-sheets';
import { chartsInSheet, type ShapeElement } from '@livediagram/document';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import {
  registerSheetSource,
  rememberSetupStart,
  sheetSeed,
  takePlacedSheet,
  type PlacedSheet,
} from '@/lib/sheet-seeds';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { sheetStoreOf, type SheetStore, type TabStatus } from './sheet-store-client';
import { useSheetHomeTab } from './sheet-home-tab';
import { retitleSheets } from './sheet-rename';
import { sheetPresenceFor } from './sheet-presence-store';
import { markCardTableSheet } from '@/hooks/sheets/card-table-sheets';
import { CSV_TRUNCATED, csvWrites } from './sheet-csv';

type SheetModel = {
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

// A sheet placed already set up (a Dashboard slot's template Sheet): its template in the Banded look, header frozen,
// as part of placing it (undone by removing it), so never an undo step of its own. Its chart is left out: a slot
// shows the grid, and Insert Chart adds one on the Sheet's own tab.
function setUpNow(
  store: SheetStore,
  tabId: string,
  sheetId: string,
  template: NonNullable<PlacedSheet['setUp']>,
  dark: boolean,
) {
  const made = designWrite(store.workbook(tabId), sheetId, sheetTemplate(template, Date.now()), {
    look: TEMPLATE_LOOK,
    freezeHeader: true,
    size: 'default',
    dark,
  });
  if (made) store.write(sheetId, made.write, { undoable: false });
}

export const SHEET_TOO_BIG_TO_PASTE =
  'Too big to paste into another document. Download it as CSV instead.';

export function useSheetModel(
  element: ShapeElement,
  bridge: SheetsBridge,
  plan: PlanContextValue | undefined,
): SheetModel {
  const store = sheetStoreOf(bridge);
  const dark = useCanvasSurface() === 'dark';
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
      retitle: (ids, from, to) => retitleSheets(store, ids, from, to),
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
  // A sheet already loaded knows its tab; a new or copied one is on the tab it is shown from (a Dashboard slot showing
  // a Sheet tab), else on the tab open now.
  const homeTab = useSheetHomeTab();
  const tabId = known?.tabId ?? homeTab ?? bridge.activeTabId;
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
      // Placed from the palette, it awaits setup (sheet.md "Setup Sheet"); a dropped CSV, or the Plan tour's
      // example sheet, fills it instead.
      const layout = emptyLayout();
      store.create({
        id: sheetId,
        tabId,
        title,
        layout:
          placed.csv || placed.setUp || placed.blank ? layout : { ...layout, setupPending: true },
      });
      if (placed.setUp) setUpNow(store, tabId, sheetId, placed.setUp, dark);
      if (placed.start) rememberSetupStart(sheetId, placed.start);
      // A dropped CSV file: its rows, read as typed, from A1.
      if (placed.csv) fillFromCsv(store, tabId, sheetId, placed.csv, bridge.toast);
      return;
    }
    // A template's Sheet a path left unmade (sheet-store.md "Template starts"): made from its start now, tinted for
    // this canvas, and the mark dropped quietly (saved and sent, no undo step). Someone else making it at the same
    // moment wins: their sheet loads.
    if (ref?.start && isTemplateStart(ref.start)) {
      const built = templateSheetWithCharts({
        id: sheetId,
        tabId,
        start: ref.start,
        now: Date.now(),
        dark,
      });
      if (built) {
        // The template's charts, placed beside the Sheet once the server takes this person's sheet (quietly, no undo
        // step). Two editors drawing it at once both make it; only the one whose sheet was taken adds the charts, so
        // they are never added twice.
        const addCharts = () =>
          bridge.tickElements((els) => {
            const host = els.find(
              (el): el is ShapeElement =>
                el.id === element.id && el.type === 'shape' && el.planSheet?.sheetId === sheetId,
            );
            if (!host || chartsInSheet(els, sheetId).length > 0) return els;
            return [...els, ...templateChartElements(host, sheetId, built.charts)];
          });
        store.create(
          { ...built.sheet, id: sheetId, title: uniqueSheetTitle(built.sheet.title, titles) },
          undefined,
          {
            onRefused: (code) => {
              if (code !== 'sheet_exists') return false;
              store.resync();
              return true;
            },
            ...(built.charts.length ? { onCreated: addCharts } : {}),
          },
        );
      }
      // The mark dropped at once, quietly, so no one else makes it again.
      bridge.tickElements((els) =>
        els.some((el) => el.id === element.id && el.type === 'shape' && !!el.planSheet?.start)
          ? els.map((el) =>
              el.id === element.id && el.type === 'shape' && el.planSheet?.start
                ? { ...el, planSheet: (({ start: _s, ...rest }) => rest)(el.planSheet) }
                : el,
            )
          : els,
      );
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
  }, [sheetId, status, store, tabId, bridge, ref?.copyOf, ref?.start, element.id, dark]);

  // Plan cards for the card functions (formulas.md "Plan cards"), when a formula on the tab reads them.
  const workbook = store.workbook(tabId);
  const items = plan?.items;
  const types = plan?.types;
  const statusNames = plan?.statusNames;
  const usesCards = useMemo(() => workbook.usesCards(), [workbook, version]); // oxlint-disable-line react/exhaustive-deps
  useEffect(() => {
    if (!usesCards || !items || !types) return;
    store.setCards(cardSourceOf(items.values(), types, { statusNames, version: Date.now() }));
  }, [usesCards, items, types, statusNames, store]);

  // Tell the main bundle whether this sheet holds a card table (Plan's strip shows for one).
  const sheet = sheetId ? store.sheet(sheetId) : undefined;
  const hasCardTable = !!sheet?.layout.cardTables?.length;
  useEffect(() => {
    if (sheet) markCardTableSheet(sheetId, hasCardTable);
  }, [sheet, sheetId, hasCardTable]);

  // A Sheet tab and its sheet share one name (docs/specs/026-plan/plan-tabs.md "Names"): when the title changes while
  // drawn (renamed here, by a collaborator or an agent, or undone), the tab it fills follows. Not on first sight, so
  // opening a document never rewrites a tab; only someone who may shape the Sheet.
  const title = sheet?.title;
  const seenTitle = useRef(title);
  useEffect(() => {
    const before = seenTitle.current;
    if (title !== undefined) seenTitle.current = title;
    if (before !== undefined && title && title !== before && bridge.canShape)
      bridge.sheetRetitled(sheetId, title);
  }, [title, sheetId, bridge]);

  return { store, sheet, workbook, status, version };
}
