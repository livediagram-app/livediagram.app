'use client';

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { SheetRenderModel, Tab } from '@liveplanner/project';
import { useSheetsBridgeContext } from '@/hooks/sheets/useSheetsBridge';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { SheetStore } from '@/components/sheets/sheet-store-client';

type SheetsChunk = {
  store: SheetStore;
  drawing: typeof import('@/lib/export-plan/plan-export-sheets').sheetDrawingFor;
};

export type TabSheets = {
  // The tab as drawn: a Sheet tab grown to its filled cells, any other tab as it is.
  tab: Tab;
  // Each Sheet's window of cells, by sheet id.
  sheets?: ReadonlyMap<string, SheetRenderModel>;
};

const NO_STORE = () => () => {};
const NO_VERSION = () => 0;

// The ids of the sheets a tab's Sheet elements show, joined: what the store is read for.
export function framedSheetKey(tab: Tab | undefined): string {
  if (!tab) return '';
  const ids: string[] = [];
  for (const el of tab.elements) {
    const id = (el as { planSheet?: { sheetId?: string } }).planSheet?.sheetId;
    if (el.type === 'shape' && el.shape === 'plan-sheet' && id && !ids.includes(id)) ids.push(id);
  }
  return ids.join(',');
}

// The Sheets of a tab drawn away from its editor (docs/specs/007-editor/split-view.md "The other pane"), with their
// cells: the sheet store and the sheets engine load once a tab with a Sheet is shown (a project never split, or
// split over tabs without one, pays nothing), its sheets' tabs are read, and the room stays attached so a
// collaborator's change lands. The cells are read again when the sheets shown move on, at a deferred priority, so
// typing in the editor beside never waits on this pane. Without a store (outside the editor), or until it loads, the tab is
// drawn as it is: its Sheets as their frames.
export function useTabSheets(tab: Tab | undefined): TabSheets | null {
  const bridge = useSheetsBridgeContext();
  const { tabs } = useEditorContext();
  const key = framedSheetKey(tab);
  const wanted = !!key && !!bridge;
  const [chunk, setChunk] = useState<SheetsChunk | null>(null);

  // The store and the drawing load, and the room attaches, while a Sheet is shown.
  useEffect(() => {
    if (!wanted || !bridge) return;
    let live = true;
    let detach: (() => void) | null = null;
    void Promise.all([
      import('@/components/sheets/sheet-store-client'),
      import('@/components/sheets/sheet-store-attach'),
      import('@/lib/export-plan/plan-export-sheets'),
    ]).then(
      ([{ sheetStoreOf }, { attachSheetStore }, { sheetDrawingFor }]) => {
        if (!live) return;
        const store = sheetStoreOf(bridge);
        detach = attachSheetStore(store, bridge);
        setChunk({ store, drawing: sheetDrawingFor });
      },
      (e: unknown) =>
        debugLog('[split] sheets.load.failed', { error: e instanceof Error ? e.name : 'unknown' }),
    );
    return () => {
      live = false;
      detach?.();
    };
  }, [wanted, bridge]);

  // The tabs holding the sheets shown are read (a tab already read is not read again).
  const store = wanted ? chunk?.store : undefined;
  const homeKey = useMemo(() => {
    if (!key) return '';
    const ids = new Set(key.split(','));
    const out: string[] = [];
    for (const t of tabs)
      for (const el of t.elements) {
        const id = (el as { planSheet?: { sheetId?: string } }).planSheet?.sheetId;
        if (id && ids.has(id) && !out.includes(t.id)) out.push(t.id);
      }
    return out.join(',');
  }, [key, tabs]);
  useEffect(() => {
    if (!store || !homeKey) return;
    for (const id of homeKey.split(',')) void store.loadTab(id);
  }, [store, homeKey]);

  const version = useSyncExternalStore(
    store ? store.subscribe : NO_STORE,
    store ? store.getVersion : NO_VERSION,
    NO_VERSION,
  );
  const shownVersion = useDeferredValue(version);
  // What the drawing reads, as a key: every sheet on the tabs holding the sheets shown (a write gives its sheet a new
  // object), and the store's version where a formula reads Plan cards. A change to any other tab's sheets (typing in
  // a Sheet tab beside this one) leaves it as it was, so the cells here are not worked out again for it.
  const readKey = useMemo(() => {
    if (!store || !homeKey) return '';
    const parts: string[] = [];
    for (const id of homeKey.split(',')) {
      const wb = store.workbook(id);
      for (const sheet of wb.sheetList()) parts.push(String(objectId(sheet)));
      if (wb.usesCards()) parts.push(`v${shownVersion}`);
    }
    return parts.join(',');
  }, [store, homeKey, shownVersion]);

  return useMemo(() => {
    if (!tab) return null;
    if (!store || !chunk) return { tab };
    // `readKey` re-reads the cells once the sheets shown move on.
    void readKey;
    return chunk.drawing(tab, store);
  }, [tab, store, chunk, readKey]);
}

// A number per object, so a list of objects can be a memo key.
const OBJECT_IDS = new WeakMap<object, number>();
let nextObjectId = 0;
function objectId(o: object): number {
  let id = OBJECT_IDS.get(o);
  if (id === undefined) {
    id = ++nextObjectId;
    OBJECT_IDS.set(o, id);
  }
  return id;
}
