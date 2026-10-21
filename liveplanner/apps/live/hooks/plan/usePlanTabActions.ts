'use client';

// The Plan tab kinds' editor actions (docs/specs/026-plan/plan-tabs.md): Start Planning making a Board, Sheet or
// Dashboard tab, and a Dashboard's layout changes. Each is one change, one undo step: a Board or Sheet tab is its
// element added (the palette's own add, a commit) with the kind ticked into that same step.
import { useCallback, useMemo } from 'react';
import {
  DASHBOARD_ROW_H_DEFAULT,
  DASHBOARD_SLOTS_MAX,
  addDashboardRow,
  addDashboardSlot,
  dashboardElementIds,
  dashboardFromPreset,
  insertDashboardRow,
  insertDashboardSlot,
  placeDashboardDuplicate,
  isDefaultTabName,
  newDashboardCard,
  newDashboard,
  readDashboard,
  removeDashboardSlot,
  setDashboardContent,
  type DashboardContent,
  type DashboardLayout,
  type Element,
  type PlanTabKind,
  type Tab,
} from '@liveplanner/document';
import type { PlanVisualisation } from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import { placedSheetTitle } from '@/lib/sheet-seeds';
import { insertTabsAfter } from '@/app/document/[id]/template-tab-set';
import {
  dashboardElement,
  dashboardViewElement,
  detailedBoards,
  newSlotTab,
  withLookOf,
} from './slot-elements';
import { tabNameFromPlan, viewsTitled } from '@/lib/tab-named-plan';
import type { DashboardItem, DashboardZone } from './dashboard-drop';
import type { SuggestedDashboard } from '@/lib/suggested-dashboards';

const newId = () => crypto.randomUUID();

export type DashboardChange =
  'DashboardRow' | 'DashboardSlot' | 'DashboardContent' | 'DashboardLook' | 'DashboardCardStyle';

export type PlanTabActions = {
  // A Board or Sheet tab: `add` places its element (a commit), then the kind joins that step.
  startElementTab: (kind: Exclude<PlanTabKind, 'dashboard'>, add: () => void) => void;
  // A Dashboard of a preset layout (dashboardFromPreset).
  startDashboard: (presetId?: string) => void;
  // A tab of one visualisation filling the page (a full-screen Gantt chart): a Dashboard of one row that fills it.
  startVisualisationTab: (view: PlanVisualisation, name: string) => void;
  // A Dashboard built from the document's own work (suggested-dashboards.ts): its rows, its views made as elements.
  startSuggestedDashboard: (suggestion: SuggestedDashboard) => void;
  // A layout change; nothing when it returns the same layout. `prune`: the slots' elements the new layout no longer
  // holds leave the tab with it (Clear Dashboard, Start Over From a Layout).
  changeDashboard: (
    change: (layout: DashboardLayout) => DashboardLayout,
    kind: DashboardChange,
    opts?: { prune?: boolean },
  ) => void;
  // A slot's content set (a tab or a note) or cleared; an element it held leaves the tab with it.
  setSlotContent: (slotId: string, content: DashboardContent | undefined) => void;
  // Something from the palette, dropped on `at` (or pressed: null slot and row). A plan view, a new Board or Sheet tab
  // (after this one) or a note fills the slot dropped on, or the first empty slot (a new row's when every slot is
  // full). A row goes under the row dropped on (at the end when pressed); a slot joins the row dropped on (the last
  // row with room when pressed, or a new row).
  placeItem: (item: DashboardItem, zone: DashboardZone | null) => void;
  // A slot removed with whatever element it held, one step (the row too when it was the row's last slot).
  removeSlot: (rowId: string, slotId: string) => void;
  // A copy of the slot beside it (else in a row below), its content copied, one step (plan-tabs.md "Editing"). A
  // board, chart or utility is copied; a tab is shown again; a Sheet element is not offered (two would share one
  // sheet).
  duplicateSlot: (rowId: string, slotId: string) => void;
};

// The dashboard of `tab`, read safely; a new one when it has none.
export function dashboardOf(tab: Tab | undefined): DashboardLayout {
  return readDashboard(tab?.dashboard) ?? newDashboard(newId);
}

// `tab` with the slot's content replaced: the element the slot held (if any) removed, `add` added.
export function withSlotContent(
  tab: Tab,
  slotId: string,
  content: DashboardContent | undefined,
  add?: Element,
): Tab {
  const layout = dashboardOf(tab);
  const held = layout.rows.flatMap((r) => r.slots).find((s) => s.id === slotId)?.content;
  const dropId = held?.type === 'element' ? held.elementId : null;
  const elements = tab.elements.filter((e) => e.id !== dropId);
  return {
    ...tab,
    elements: add ? [...elements, add] : elements,
    dashboard: setDashboardContent(layout, slotId, content),
  };
}

export function usePlanTabActions({
  activeId,
  commitTabs: commitAnyTabs,
  tickTabs,
  bringCardTypes,
  markTabLoaded,
}: {
  activeId: string;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  tickTabs: (map: (ts: Tab[]) => Tab[]) => void;
  // A new Board tab's board brings its preset's card types (usePresetCardTypes), as a template's tabs do: its tab is
  // not the open one, so the open tab's watch never sees it.
  bringCardTypes?: (elements: Tab['elements']) => void;
  // A tab made here has nothing to fetch.
  markTabLoaded?: (tabId: string) => void;
}): PlanTabActions {
  // Read when used, so a caller handing new functions each render never remakes the actions (the Dashboard's context).
  const tabHooks = useLatest({ bringCardTypes, markTabLoaded });
  // A locked tab refuses every change made here, as every edit there is (plan-tabs.md "Dashboard tab"): commitTabs
  // itself does not check the lock.
  const commitTabs = useCallback(
    (map: (ts: Tab[]) => Tab[]) =>
      commitAnyTabs((ts) => (ts.find((t) => t.id === activeId)?.locked ? ts : map(ts))),
    [commitAnyTabs, activeId],
  );
  const onActive = useCallback(
    (map: (t: Tab) => Tab) => (ts: Tab[]) =>
      ts.map((t) => (t.id === activeId && !t.locked ? map(t) : t)),
    [activeId],
  );
  const startElementTab = useCallback<PlanTabActions['startElementTab']>(
    (kind, add) => {
      add();
      // A Dashboard left with no rows is replaced (plan-tabs.md): its layout goes with the kind, in the same step. A tab
      // still on its default name takes the name of the board or Sheet now filling it (plan-tabs.md "Names").
      tickTabs(
        onActive((t) => {
          const name = tabNameFromPlan(t, placedSheetTitle);
          return {
            ...t,
            kind,
            opensIn: 'plan',
            dashboard: undefined,
            ...(name ? { name } : {}),
            // A board filling its tab draws its cards Detailed, whatever its preset's size on a canvas.
            ...(kind === 'board' ? { elements: detailedBoards(t.elements) } : {}),
          };
        }),
      );
      track('Plan', 'Created', kind === 'board' ? 'BoardTab' : 'SheetTab');
    },
    [tickTabs, onActive],
  );
  const startDashboard = useCallback<PlanTabActions['startDashboard']>(
    (presetId) => {
      commitTabs(
        onActive((t) => ({
          ...t,
          // A tab still on its default name ("Tab 5") takes the Dashboard's; a name someone gave it stays.
          name: isDefaultTabName(t.name) ? 'Dashboard' : t.name,
          kind: 'dashboard',
          opensIn: 'plan',
          dashboard: dashboardFromPreset(presetId, newId),
        })),
      );
      track('Plan', 'Created', 'DashboardTab');
    },
    [commitTabs, onActive],
  );
  const startVisualisationTab = useCallback<PlanTabActions['startVisualisationTab']>(
    (view, name) => {
      const el = dashboardViewElement(view);
      const dashboard = readDashboard({
        rows: [
          {
            id: newId(),
            height: DASHBOARD_ROW_H_DEFAULT,
            fill: true,
            slots: [{ id: newId(), span: 12, content: { type: 'element', elementId: el.id } }],
          },
        ],
      });
      if (!dashboard) return;
      commitTabs(
        onActive((t) => {
          const made: Tab = {
            ...t,
            name: isDefaultTabName(t.name) ? name : t.name,
            kind: 'dashboard',
            opensIn: 'plan',
            elements: [...t.elements, el],
            dashboard,
          };
          // The tab and its chart share one name (plan-tabs.md "Names"): a tab with a name of its own gives it to the
          // chart as its title; a default-named tab takes the view's name, which the chart already shows.
          return isDefaultTabName(t.name) ? made : { ...made, elements: viewsTitled(made, t.name) };
        }),
      );
      track('Plan', 'Created', 'VisualisationTab');
    },
    [commitTabs, onActive],
  );
  const startSuggestedDashboard = useCallback<PlanTabActions['startSuggestedDashboard']>(
    (s) => {
      // The views made once, outside the update (React may run an updater twice).
      const elements: Element[] = [];
      const rows = s.rows.map((row) => ({
        id: newId(),
        height: row.height,
        slots: row.slots.map((slot) => {
          const base = { id: newId(), span: slot.span };
          if ('view' in slot) {
            const el = dashboardViewElement(slot.view);
            elements.push(el);
            return { ...base, content: { type: 'element' as const, elementId: el.id } };
          }
          if ('tab' in slot)
            return {
              ...base,
              content: { type: 'tab' as const, tabId: slot.tab.tabId, of: slot.tab.of },
            };
          return base;
        }),
      }));
      const dashboard = readDashboard({ rows });
      if (!dashboard) return;
      commitTabs(
        onActive((t) => ({
          ...t,
          name: isDefaultTabName(t.name) ? s.name : t.name,
          kind: 'dashboard',
          opensIn: 'plan',
          elements: [...t.elements, ...elements],
          dashboard,
        })),
      );
      track('Plan', 'Created', 'SuggestedDashboard');
    },
    [commitTabs, onActive],
  );
  const changeDashboard = useCallback<PlanTabActions['changeDashboard']>(
    (change, kind, opts) => {
      commitTabs((ts) => {
        const tab = ts.find((t) => t.id === activeId);
        if (!tab) return ts;
        const before = dashboardOf(tab);
        const after = change(before);
        if (after === before) return ts;
        const held = opts?.prune ? dashboardElementIds(after) : null;
        return ts.map((t) =>
          t.id === activeId
            ? {
                ...t,
                dashboard: after,
                ...(held ? { elements: t.elements.filter((e) => held.has(e.id)) } : {}),
              }
            : t,
        );
      });
      track('Plan', 'Changed', kind);
    },
    [commitTabs, activeId],
  );
  const setSlotContent = useCallback<PlanTabActions['setSlotContent']>(
    (slotId, content) => {
      commitTabs(onActive((t) => withSlotContent(t, slotId, content)));
      track('Plan', 'Changed', 'DashboardContent');
    },
    [commitTabs, onActive],
  );
  // A Layout tile: a row, or a slot.
  // A Layout tile: a row (at the gap dropped on, else the end), or a slot (at the gap in the row dropped on, a row of its
  // own at a gap between rows, else pressed: the last row with room, or a new row).
  const changeLayout = useCallback(
    (item: Extract<DashboardItem, { kind: 'row' | 'slot' }>, zone: DashboardZone | null) => {
      if (item.kind === 'row') {
        changeDashboard(
          (l) =>
            insertDashboardRow(
              l,
              zone?.kind === 'row-gap' ? zone.index : l.rows.length,
              item.height,
              item.slots,
              newId,
            ),
          'DashboardRow',
        );
        return;
      }
      changeDashboard((l) => {
        if (zone?.kind === 'slot-gap') return insertDashboardSlot(l, zone.rowId, zone.index, newId);
        if (zone?.kind === 'row-gap')
          return insertDashboardRow(l, zone.index, DASHBOARD_ROW_H_DEFAULT, 1, newId);
        const roomy = [...l.rows].reverse().find((r) => r.slots.length < DASHBOARD_SLOTS_MAX);
        const added = roomy ? addDashboardSlot(l, roomy.id, newId) : l;
        return added !== l ? added : addDashboardRow(l, newId);
      }, 'DashboardSlot');
    },
    [changeDashboard],
  );
  const placeItem = useCallback<PlanTabActions['placeItem']>(
    (item, zone) => {
      if (item.kind === 'row' || item.kind === 'slot') {
        changeLayout(item, zone);
        return;
      }
      const slotId = zone?.kind === 'slot' ? zone.slotId : null;
      // The element or tab is made once, outside the update (React may run an updater twice).
      // A plan view is an element of the dashboard itself (plan-tabs.md "Slot content"); a new board or Sheet is a
      // Board or Sheet tab of its own, after this one, which the slot shows (plan-tabs.md "Filling a slot").
      // A chart from a Sheet comes chosen (SheetChartSource): its element is made there.
      if (item.kind === 'sheet-chart' && !item.chart) return;
      const view =
        item.kind === 'view'
          ? dashboardElement(item)
          : item.kind === 'sheet-chart'
            ? (item.chart ?? null)
            : null;
      const made = item.kind === 'board' || item.kind === 'sheet' ? newSlotTab(item) : null;
      if (made) tabHooks.current.bringCardTypes?.(made.elements);
      commitTabs((ts) => {
        const tab = ts.find((t) => t.id === activeId);
        if (!tab) return ts;
        let layout = dashboardOf(tab);
        const empty = () => layout.rows.flatMap((r) => r.slots).find((s) => !s.content)?.id ?? null;
        let target = slotId ?? empty();
        if (!target) {
          layout = addDashboardRow(layout, newId);
          target = empty();
        }
        if (!target) return ts;
        const base = { ...tab, dashboard: layout };
        if (view) {
          const next = withSlotContent(base, target, { type: 'element', elementId: view.id }, view);
          return ts.map((t) => (t.id === activeId ? next : t));
        }
        // The new tab goes straight after the dashboard, in the same step as the slot showing it.
        if (made && (item.kind === 'board' || item.kind === 'sheet')) {
          const next = withSlotContent(base, target, {
            type: 'tab',
            tabId: made.id,
            of: item.kind,
          });
          return insertTabsAfter(
            ts.map((t) => (t.id === activeId ? next : t)),
            activeId,
            [withLookOf(made, tab)],
          );
        }
        if (item.kind === 'tab') {
          const next = withSlotContent(base, target, {
            type: 'tab',
            tabId: item.tabId,
            of: item.of,
          });
          return ts.map((t) => (t.id === activeId ? next : t));
        }
        // A figure from a form: the document's first form, changed in the slot when it has more (DashboardFormMetric).
        if (item.kind === 'form-metric') {
          const next = withSlotContent(base, target, {
            type: 'form-metric',
            metric: item.metric,
            formTabId: ts.find((t) => t.kind === 'form')?.id ?? '',
          });
          return ts.map((t) => (t.id === activeId ? next : t));
        }
        // A figure from a Sheet: its source is chosen in the slot (DashboardSheetMetric).
        if (item.kind === 'sheet-metric') {
          const next = withSlotContent(base, target, {
            type: 'sheet-metric',
            metric: item.metric,
            sheetId: '',
          });
          return ts.map((t) => (t.id === activeId ? next : t));
        }
        // A written card: a Title starts as the dashboard's name, ready to be written over.
        if (item.kind === 'card') {
          const content: DashboardContent =
            item.card === 'title'
              ? { type: 'title', title: tab.name, text: '' }
              : newDashboardCard(item.card, new Date());
          const next = withSlotContent(base, target, content);
          return ts.map((t) => (t.id === activeId ? next : t));
        }
        if (item.kind === 'note') {
          const next = withSlotContent(base, target, { type: 'note', title: 'Note', text: '' });
          return ts.map((t) => (t.id === activeId ? next : t));
        }
        return ts;
      });
      if (made) {
        tabHooks.current.markTabLoaded?.(made.id);
        track('Plan', 'Created', made.kind === 'board' ? 'BoardTab' : 'SheetTab');
      }
      track('Plan', 'Changed', 'DashboardContent');
    },
    [commitTabs, activeId, changeLayout, tabHooks],
  );
  const removeSlot = useCallback<PlanTabActions['removeSlot']>(
    (rowId, slotId) => {
      commitTabs(
        onActive((t) => {
          const cleared = withSlotContent(t, slotId, undefined);
          return {
            ...cleared,
            dashboard: removeDashboardSlot(dashboardOf(cleared), rowId, slotId),
          };
        }),
      );
      track('Plan', 'Changed', 'DashboardSlot');
    },
    [commitTabs, onActive],
  );
  const duplicateSlot = useCallback<PlanTabActions['duplicateSlot']>(
    (rowId, slotId) => {
      commitTabs(
        onActive((t) => {
          const layout = dashboardOf(t);
          const content = layout.rows.flatMap((r) => r.slots).find((s) => s.id === slotId)?.content;
          if (!content) return t;
          const placed = placeDashboardDuplicate(layout, rowId, slotId, newId);
          if (!placed) return t;
          let copy: DashboardContent = content;
          let add: Element | undefined;
          if (content.type === 'element') {
            const el = t.elements.find((e) => e.id === content.elementId);
            if (!el || (el.type === 'shape' && el.shape === 'plan-sheet')) return t;
            add = { ...structuredClone(el), id: newId() };
            copy = { ...content, elementId: add.id };
          }
          return {
            ...t,
            elements: add ? [...t.elements, add] : t.elements,
            dashboard: setDashboardContent(placed.layout, placed.slotId, copy),
          };
        }),
      );
      track('Plan', 'Changed', 'DashboardSlot');
    },
    [commitTabs, onActive],
  );
  return useMemo(
    () => ({
      startElementTab,
      startDashboard,
      startSuggestedDashboard,
      startVisualisationTab,
      changeDashboard,
      setSlotContent,
      placeItem,
      removeSlot,
      duplicateSlot,
    }),
    [
      startElementTab,
      startDashboard,
      startSuggestedDashboard,
      startVisualisationTab,
      changeDashboard,
      setSlotContent,
      placeItem,
      removeSlot,
      duplicateSlot,
    ],
  );
}
