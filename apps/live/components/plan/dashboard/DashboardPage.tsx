'use client';

// A Dashboard tab's page (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): its rows of slots drawn over the canvas
// area, below the top row and clear of the panels, as a covering board is (CanvasCover): the canvas under it takes no
// input. The page scrolls when taller than the window; rows and slots come from the palette's Layout.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  dashboardItemOf,
  dashboardZone,
  readDashboardGeometry,
  registerDashboardPlacer,
  type DashboardZone,
} from '@/hooks/plan/dashboard-drop';
import { getPaletteDragPreview } from '@/lib/palette-drag-preview';
import { DropZoneMark, sameZone, zoneMark, type ZoneMark } from './drop-zone-mark';
import { PALETTE_DND_MIME } from '@/lib/icons';
import { createPortal } from 'react-dom';
import {
  moveDashboardSlot,
  type DashboardContent,
  type Element,
  type Tab,
} from '@livediagram/document';

const newId = () => crypto.randomUUID();
import { CanvasCover } from '@/components/plan/MaximisedPlanLayer';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';
import { useFillsTab } from '@/hooks/plan/plan-cover-store';
import { dashboardOf, type PlanTabActions } from '@/hooks/plan/usePlanTabActions';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardRowView } from './DashboardRowView';
import { useArmedPlacement } from './useArmedPlacement';
import { useFitGuard } from './useFitGuard';
import { useSlotMove } from './useSlotMove';
import { DashboardMenuName } from './DashboardMenuName';
import { DashboardSettings } from './DashboardSettings';
import { CANVAS_ROOT_SELECTOR } from '@/lib/canvas-selectors';

export function DashboardPage({
  tab,
  tabs,
  canEdit,
  actions,
  openTab,
  loadTabs,
  loadedTabIds,
  deleteTab,
  releaseSheets,
  renameTab,
}: {
  tab: Tab;
  tabs: readonly Tab[];
  canEdit: boolean;
  actions: PlanTabActions;
  openTab: (tabId: string) => void;
  // Fetch tabs' content (only those named): a slot showing a Board or Sheet tab needs it.
  loadTabs?: (only?: readonly string[]) => Promise<string[]>;
  // The tabs whose content has arrived: a slot's tab not among them is still loading, or failed (see below).
  loadedTabIds?: ReadonlySet<string>;
  // A slot's Clear or Remove also deleting the tab it showed, or a Sheet's cells (plan-tabs.md "Clearing a slot").
  deleteTab?: (tabId: string) => void;
  releaseSheets?: (sheetIds: readonly string[]) => boolean;
  // The tab renamed from its name in the menu box (DashboardMenuName).
  renameTab?: (tabId: string, name: string) => void;
}) {
  // The canvas `main` the page covers: mounted beside the canvas, not in it, so found by its marker.
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR));
  }, []);
  // A palette tile dragged over the page: the zone it would land in is drawn (DropZoneMark: a slot outlined, a line
  // between rows, a line in a row), and the drop fills it. Native drag and drop, as the palette's tiles are; what is
  // dragged is read from the drag preview, as `dataTransfer` cannot be read until the drop.
  const pageRef = useRef<HTMLDivElement>(null);
  // The page is up: slots added from now on settle into place (useSlotEnter); those it opened with draw still.
  useEffect(() => {
    if (canvas) pageRef.current?.setAttribute('data-dashboard-ready', '');
  }, [canvas]);
  const dashboard = useMemo(() => dashboardOf(tab), [tab]);
  const elements = useMemo(() => new Map(tab.elements.map((e) => [e.id, e])), [tab.elements]);
  const guard = useFitGuard(pageRef, dashboard, elements);
  const placement = useArmedPlacement({
    pageRef,
    tabs,
    allowFor: guard.allowFor,
    place: (item, z) => actions.placeItem(item, z),
  });
  const { arm } = placement;
  // The palette's plan views fill slots here: the one dropped on, or the first empty one.
  useEffect(() => {
    if (!canEdit) return;
    // A drop lands where it was dropped; a pressed tile waits for a click (useArmedPlacement).
    return registerDashboardPlacer((item, zone) =>
      zone ? actions.placeItem(item, zone) : arm(item),
    );
  }, [canEdit, actions, arm]);
  const [zone, setZone] = useState<{ zone: DashboardZone; mark: ZoneMark } | null>(null);
  const zoneAt = (x: number, y: number) => {
    const drag = getPaletteDragPreview();
    const item = drag ? dashboardItemOf(drag.kind, drag.choice) : null;
    const root = pageRef.current;
    if (!item || !root) return null;
    const geo = readDashboardGeometry(root);
    const z = dashboardZone(item, geo, x, y, guard.allowFor(item));
    return z
      ? { zone: z, mark: zoneMark(z, geo, root.getBoundingClientRect(), root.scrollTop) }
      : null;
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!canEdit || !e.dataTransfer.types.includes(PALETTE_DND_MIME)) return;
    const next = zoneAt(e.clientX, e.clientY);
    e.stopPropagation();
    if (!next) {
      setZone(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setZone((prev) => (prev && sameZone(prev.zone, next.zone) ? prev : next));
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    setZone(null);
    if (!canEdit) return;
    const [kind, choice] = e.dataTransfer.getData(PALETTE_DND_MIME).split('|');
    const item = kind ? dashboardItemOf(kind, choice || undefined) : null;
    const root = pageRef.current;
    if (!item || !root) return;
    const z = dashboardZone(
      item,
      readDashboardGeometry(root),
      e.clientX,
      e.clientY,
      guard.allowFor(item),
    );
    if (!z) return;
    e.preventDefault();
    e.stopPropagation();
    actions.placeItem(item, z);
  };
  // A slot carried by its grip (plan-tabs.md "Moving a slot"): see useSlotMove.
  const { moving, beginMove } = useSlotMove({
    pageRef,
    allowMove: guard.allowMove,
    onMove: useCallback(
      (slotId: string, zone: DashboardZone) =>
        actions.changeDashboard((l) => moveDashboardSlot(l, slotId, zone, newId), 'DashboardSlot'),
      [actions],
    ),
  });
  // Below the top row: a dashboard has no header to hold it.
  const layout = useCanvasLayerInsets(canvas, false);
  // The tabs the slots show, fetched (a tab's content arrives only when it is opened or swept); until then a slot says
  // it is loading rather than that the tab is empty.
  const shownTabs = useMemo(
    () =>
      dashboard.rows.flatMap((r) =>
        r.slots.flatMap((s) => (s.content?.type === 'tab' ? [s.content.tabId] : [])),
      ),
    [dashboard],
  );
  const shownKey = shownTabs.join(',');
  // The tabs whose fetch failed, each offered a Retry. A fetch is asked for whenever the set shown changes; one
  // already in flight elsewhere (the Plan sweep) is left to land.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const fetchTabs = useCallback(
    (ids: readonly string[]) => {
      if (!loadTabs || ids.length === 0) return;
      // Settled, the asked-for tabs are failed exactly when this fetch says so.
      void loadTabs(ids).then((failures) => {
        setFailed((prev) => {
          const next = new Set([...prev].filter((id) => !ids.includes(id)));
          for (const id of failures) next.add(id);
          return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next;
        });
      });
    },
    [loadTabs],
  );
  useEffect(() => {
    if (shownKey !== '') fetchTabs(shownKey.split(','));
  }, [fetchTabs, shownKey]);
  // Every tab's content not yet here, its failures recorded as a shown tab's are (so a Sheet picker or a figure says
  // so, with Retry, rather than waiting for ever). Keyed on the tabs' ids: the function changes only as tabs come and go.
  const allTabsKey = useMemo(() => tabs.map((t) => t.id).join(','), [tabs]);
  const loadAllTabs = useCallback(
    () => fetchTabs(allTabsKey ? allTabsKey.split(',') : []),
    [fetchTabs, allTabsKey],
  );
  // A figure or a chart from a Sheet may read a sheet on any tab: every tab's content is fetched once one is shown.
  const readsSheets = useMemo(
    () => dashboard.rows.some((r) => r.slots.some((s) => readsSheet(s.content, elements))),
    [dashboard, elements],
  );
  useEffect(() => {
    if (readsSheets) loadAllTabs();
  }, [readsSheets, loadAllTabs]);
  // Where each shown tab's content is: arrived, failed, or on its way.
  const tabStatus = useCallback(
    (tabId: string): 'loaded' | 'failed' | 'loading' =>
      !loadTabs || !loadedTabIds || loadedTabIds.has(tabId)
        ? 'loaded'
        : failed.has(tabId)
          ? 'failed'
          : 'loading',
    [loadTabs, loadedTabIds, failed],
  );
  // Retry: the slot shows Loading again until this fetch settles.
  const retryTab = useCallback(
    (tabId: string) => {
      setFailed((prev) => new Set([...prev].filter((id) => id !== tabId)));
      fetchTabs([tabId]);
    },
    [fetchTabs],
  );
  const value = useMemo<DashboardContextValue>(
    () => ({
      tabs,
      elements,
      canEdit,
      actions,
      openTab,
      tabStatus,
      retryTab,
      loadAllTabs: loadTabs ? loadAllTabs : undefined,
      ...(deleteTab ? { deleteTab } : {}),
      ...(releaseSheets ? { releaseSheets } : {}),
      layout: dashboard,
      fit: guard,
      beginMove: canEdit ? beginMove : undefined,
      movingSlotId: moving?.slotId ?? null,
    }),
    [
      tabs,
      elements,
      canEdit,
      actions,
      openTab,
      tabStatus,
      retryTab,
      loadTabs,
      loadAllTabs,
      deleteTab,
      releaseSheets,
      beginMove,
      dashboard,
      guard,
      moving?.slotId,
    ],
  );
  // A Visualisation tab: its one chart fills the tab from the canvas, as a Board tab's board does (fill-tab.ts), so
  // the page draws nothing over it.
  const soloView = useFillsTab(
    dashboard.rows.length === 1 && dashboard.rows[0]!.slots[0]?.content?.type === 'element'
      ? dashboard.rows[0]!.slots[0].content.elementId
      : '',
  );
  if (soloView) return null;
  return (
    <>
      <span hidden ref={mark} />
      <DashboardMenuName
        tab={tab}
        onRename={canEdit && renameTab ? (name) => renameTab(tab.id, name) : undefined}
      />
      {canvas ? (
        <DashboardSettings
          canvas={canvas}
          canEdit={canEdit}
          name={tab.name}
          layout={dashboard}
          actions={actions}
          onRename={renameTab ? (name) => renameTab(tab.id, name) : undefined}
        />
      ) : null}
      {canvas
        ? createPortal(
            <CanvasCover layout={layout} marker={{ 'data-dashboard': '' }}>
              <DashboardContext.Provider value={value}>
                <div
                  role="region"
                  aria-label={`${tab.name} dashboard`}
                  ref={pageRef}
                  // The bottom padding clears the canvas's bottom toolbars (about 64 px with their margin), so the
                  // last row scrolls fully into view above them; on a phone also the home indicator's safe area.
                  // A tinted background washes the page behind the slots (Dashboard Settings).
                  className={`relative h-full overflow-y-auto overscroll-contain px-3 pb-20 pt-3 max-sm:pb-[calc(6rem+env(safe-area-inset-bottom))] ${dashboard.background === 'tint' ? 'bg-brand-500/[0.07] dark:bg-brand-400/[0.09]' : ''}`}
                  onDragOver={onDragOver}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setZone(null);
                  }}
                  onDrop={onDrop}
                  onPointerMove={placement.onPointerMove}
                  onClickCapture={placement.onClickCapture}
                  data-armed={placement.armed ? '' : undefined}
                >
                  {placement.overlay}
                  {zone ? <DropZoneMark mark={zone.mark} /> : null}
                  {moving?.mark ? <DropZoneMark mark={moving.mark} /> : null}
                  {/* At least the page's height, so a row that fills the page has the height to fill. */}
                  <div className="flex min-h-full flex-col gap-3">
                    {dashboard.rows.map((row, i) => (
                      <DashboardRowView
                        key={row.id}
                        row={row}
                        index={i}
                        rowCount={dashboard.rows.length}
                      />
                    ))}
                  </div>
                </div>
              </DashboardContext.Provider>
            </CanvasCover>,
            canvas,
          )
        : null}
    </>
  );
}

// A slot that reads a Sheet: a figure from one, or a chart drawn from one (plan-tabs.md "Sheet Chart").
function readsSheet(
  content: DashboardContent | undefined,
  elements: ReadonlyMap<string, Element>,
): boolean {
  if (content?.type === 'sheet-metric') return true;
  if (content?.type !== 'element') return false;
  const el = elements.get(content.elementId);
  return el?.type === 'shape' && !!el.chartSource;
}
