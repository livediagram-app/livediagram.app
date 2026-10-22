'use client';

// A Dashboard slot's way into the document's Sheets (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet"): which
// Sheets the document holds (by the tabs whose elements place one), and one sheet with its tab's workbook, kept
// current as the sheet store moves on (an edit, a collaborator's op). Its tab's sheets are fetched as it is asked for.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Tab } from '@livediagram/document';
import type { Sheet, Workbook } from '@livediagram/sheets';
import { useSheetsBridgeContext } from '@/hooks/sheets/useSheetsBridge';
import { sheetStoreOf, type SheetStore } from '@/components/sheets/sheet-store-client';
import type { TabsState } from './dashboard-context';

type DocumentSheet = { sheetId: string; tabId: string; tabName: string };

// Every Sheet the document's tabs place, in tab order.
export function documentSheets(tabs: readonly Tab[]): DocumentSheet[] {
  return tabs.flatMap((t) =>
    t.elements.flatMap((el) =>
      el.type === 'shape' && el.shape === 'plan-sheet' && el.planSheet?.sheetId
        ? [{ sheetId: el.planSheet.sheetId, tabId: t.id, tabName: t.name }]
        : [],
    ),
  );
}

const noop = () => () => {};
const zero = () => 0;

// The document's sheet store (null outside the editor's sheets bridge), its version, and the locale figures read in.
export function useSheetStore(): { store: SheetStore | null; version: number; locale: string } {
  const bridge = useSheetsBridgeContext();
  const store = useMemo(() => (bridge ? sheetStoreOf(bridge) : null), [bridge]);
  const version = useSyncExternalStore(store?.subscribe ?? noop, store?.getVersion ?? zero, zero);
  return { store, version, locale: bridge?.locale ?? 'en-GB' };
}

export type SheetRead =
  | { state: 'none' }
  | { state: 'gone' }
  | { state: 'loading'; name: string }
  // Its fetch failed: said so, with a Retry that fetches it again.
  | { state: 'failed'; name: string; retry: () => void }
  | { state: 'ready'; sheet: Sheet; wb: Workbook; locale: string; version: number };

// One sheet, read live: its tab's sheets fetched as it is first asked for. `tabsState`: where the document's tabs are
// (tabsStateOf); once every one has arrived a sheet no tab places is gone rather than on its way, and once they have
// settled with some failed it may be on one of those, so the read failed too (`retryTabs` fetches them again).
export function useSheetRead(
  sheetId: string,
  tabs: readonly Tab[],
  tabsState: TabsState,
  retryTabs?: () => void,
): SheetRead {
  const { store, version, locale } = useSheetStore();
  const placed = useMemo(
    () => (sheetId ? documentSheets(tabs).find((s) => s.sheetId === sheetId) : undefined),
    [sheetId, tabs],
  );
  const tabId = placed?.tabId ?? null;
  useEffect(() => {
    if (store && tabId) void store.loadTab(tabId);
  }, [store, tabId]);
  if (!sheetId) return { state: 'none' };
  if (!store) return { state: 'loading', name: placed?.tabName ?? 'the sheet' };
  const sheet = store.sheet(sheetId);
  if (sheet) return { state: 'ready', sheet, wb: store.workbook(sheet.tabId), locale, version };
  // Not loaded: on its way while its tab holds it and is loading; gone once no tab places it, or its tab has loaded
  // without it.
  if (!placed) {
    if (tabsState === 'loaded') return { state: 'gone' };
    if (tabsState === 'failed' && retryTabs)
      return { state: 'failed', name: 'the sheet', retry: retryTabs };
    return { state: 'loading', name: 'the sheet' };
  }
  const status = tabId ? store.status(tabId) : undefined;
  if (status === 'ready') return { state: 'gone' };
  if (status === 'error' && tabId)
    return { state: 'failed', name: placed.tabName, retry: () => void store.loadTab(tabId, true) };
  return { state: 'loading', name: placed.tabName };
}
