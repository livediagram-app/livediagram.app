// Tab import, lifted out of useTabActions: the id re-mint imported elements go through, the single-undo-step
// content replace, and the JSON importer with its lazy-loaded parser.

import {
  copiedSheetId,
  freshCopyFields,
  readDashboard,
  relinkCopiedCharts,
  remapDashboardElements,
  remintDashboardIds,
  remapElementRefs,
  savableElements,
  type Element,
  type Tab,
} from '@liveplanner/project';
import { mergeImportedTab } from '@/lib/import-merge';
import type { ImportedPlanItems, ImportOutcome } from '@/lib/import-tab';
import type { PlanTabImportResult } from '@/hooks/plan/usePlanTabImport';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

// Re-mint element ids (and remap pinned-arrow endpoints) so imported elements can't collide with anything already on
// the project, with the old-to-new maps of the element ids and of the Sheets copied with them. Shared with
// remintTabElements, which a Duplicate goes through too.
export function remintElements(elements: Element[]): {
  elements: Element[];
  ids: Map<string, string>;
  sheetIds: Map<string, string>;
} {
  const ids = new Map<string, string>();
  const sheetIds = new Map<string, string>();
  const minted = elements.map((el) => {
    const id = crypto.randomUUID();
    ids.set(el.id, id);
    // A Sheet's copy frames a new sheet made from the original's (freshCopyFields).
    const sheet = el.type === 'shape' && el.shape === 'plan-sheet' ? freshCopyFields(el) : {};
    const copy = { ...el, id, ...sheet } as Element;
    const pair = copiedSheetId(el, copy as { planSheet?: { sheetId: string } });
    if (pair) sheetIds.set(pair[0], pair[1]);
    return copy;
  });
  // A chart on the tab reads the tab's copy of its Sheet (docs/specs/029-sheets/sheet.md "Charts").
  const next = relinkCopiedCharts(minted, sheetIds);
  // Arrow endpoints, mind-map parents (docs/specs/009-elements/mind-node.md) and portal partners
  // (docs/specs/009-elements/portal-element.md) follow the new ids. Missed, a duplicated tab's mind-map
  // nodes named parents on the SOURCE tab and paired portals lost their
  // partner. Element links are left alone: a link names its tab too, and
  // that is still the source tab, where the original element still is.
  return { elements: remapElementRefs(next, ids), ids, sheetIds };
}

// A tab's elements re-minted as above, its Dashboard layout (if any) following them: each element slot names its
// element's new id, each figure from a Sheet the Sheet copied with it, and every row and slot takes a new id of its
// own (docs/specs/026-plan/plan-tabs.md "Import and Export of a Dashboard"). The layout is read safely first, as a
// file's is never trusted. Shared with useTabActions' Duplicate.
export function remintTabElements<T extends Pick<Tab, 'elements' | 'dashboard'>>(tab: T): T {
  const { elements, ids, sheetIds } = remintElements(tab.elements);
  const layout = tab.dashboard === undefined ? undefined : readDashboard(tab.dashboard);
  if (!layout) {
    const { dashboard: _drop, ...rest } = tab;
    return { ...rest, elements } as T;
  }
  const dashboard = remintDashboardIds(remapDashboardElements(layout, ids, sheetIds), () =>
    crypto.randomUUID(),
  );
  return { ...tab, elements, dashboard };
}

// What a Dashboard tab refuses to import (null: it may): only a Dashboard tab's own JSON export replaces it.
export const NOT_A_DASHBOARD =
  "This file isn't a Dashboard. Export a Dashboard tab as JSON, then import that.";

type TabImportDeps = {
  tabs: Tab[];
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  // Surfaces an import parse error in the header (null clears it).
  setImportError: (message: string | null) => void;
  // Frames the tab once the imported content has rendered (useTabEntryEffects).
  requestFit: () => void;
  // Adds a JSON export's Plan items to the project (usePlanTabImport, docs/specs/026-plan/items.md).
  importPlanItems: (plan: ImportedPlanItems) => Promise<PlanTabImportResult>;
};

// The import report's line when the store refused a file's cards.
export function planCardsFailure(failed: number): { title: string; message: string } {
  return {
    title: 'Plan Cards',
    message: `${failed === 1 ? '1 card' : `${failed} cards`} couldn't be added to this plan. The tab was imported without them.`,
  };
}

export function useTabImport({
  tabs,
  activeId,
  commitTabs,
  setSelectedId,
  setEditingId,
  setImportError,
  requestFit,
  importPlanItems,
}: TabImportDeps) {
  // Replace the ACTIVE tab's content with an imported tab — its
  // elements + theme/background, keeping the tab's own id and name.
  // Goes through `commitTabs` so the whole replace is a single undo
  // step (the warning in the Import dialog promises this). Selection /
  // edit state is cleared so nothing dangles over the new content.
  const replaceActiveTabContent = (raw: Tab) => {
    setImportError(null);
    // Only what the api will save lands: an element the validator refuses would make every later save of this tab
    // fail.
    const { elements, dropped } = savableElements(raw.elements);
    if (dropped > 0) debugLog('[import] dropped unsavable elements', { dropped });
    const imported = { ...raw, elements };
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? mergeImportedTab(t, imported) : t)));
    setSelectedId(null);
    setEditingId(null);
    // The import replaced the tab's content, so frame it.
    if (imported.elements.length > 0) requestFit();
  };

  // Import a tab's JSON export into the active tab. Shared by the Import dialog's paste-editor path and the file
  // path (which reads the file then hands the text here), so both routes run the exact same parse + replace. The
  // parser is lazy-loaded so its code stays out of the editor's initial bundle. Never throws — returns the
  // outcome the dialog renders (close / stay / show error).
  const importTextIntoActiveTab = async (text: string): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }

    const { parseImportedTab } = await import('@/lib/import-tab');
    const result = parseImportedTab(text);
    if (!result.ok) return { status: 'error', error: result.error };
    // A Dashboard takes only a Dashboard's JSON (docs/specs/026-plan/plan-tabs.md "Import and Export of a Dashboard").
    if (active?.kind === 'dashboard' && result.tab.kind !== 'dashboard') {
      return { status: 'error', error: NOT_A_DASHBOARD };
    }
    replaceActiveTabContent(remintTabElements(result.tab));
    track('Tab', 'Imported', 'JSON');
    // The tab's boards and cards draw from the project's items: the file's come in after the tab.
    const landed = result.plan ? await importPlanItems(result.plan) : null;
    if (landed && landed.failed > 0) {
      return { status: 'done', failures: [planCardsFailure(landed.failed)] };
    }
    return { status: 'done' };
  };

  // Import a FILE into the active tab: picks a .json, then hands its text to importTextIntoActiveTab so the file
  // and paste paths converge on one parser. Returns the dialog outcome; 'cancelled' when the file picker is
  // dismissed.
  const importIntoActiveTab = async (): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }
    const { pickTabFile } = await import('@/lib/import-tab');
    const picked = await pickTabFile();
    if (!picked) return { status: 'cancelled' };
    return importTextIntoActiveTab(picked.text);
  };

  return { replaceActiveTabContent, importIntoActiveTab, importTextIntoActiveTab };
}
