'use client';

// The Export dialog's Plan side (docs/specs/026-plan/plan-tabs.md "Export"): the formats a Plan tab offers, and what
// its images draw: a Board, Sheet or Dashboard tab as laid out (plan-export-tab.ts), the cells of every Sheet worked
// out from the sheet store, and each plan view as a picture of its chart (plan-view-art.ts) on any tab.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EXPORT_BG,
  PIE_PALETTE,
  canvasSurface,
  readDashboard,
  type ResolvePlanArt,
  type SheetRenderModel,
  type Tab,
} from '@liveplanner/document';
import { usePlan } from '@/components/plan/PlanContext';
import { useSheetsBridgeContext } from '@/hooks/sheets/useSheetsBridge';
import { tabAsSeen } from '@/lib/export-as-seen';
import { renderTabToSvg } from '@/lib/export-tab';
import {
  exportFormatsFor,
  planImageOf,
  planViewArt,
  type ExportFormatKey,
  type PlanArtData,
  type PlanImage,
  type SheetMetricArt,
} from '@liveplanner/plan-art';
import { getTheme } from '@/lib/themes';
import { debugLog } from '@/lib/debug-log';

type PlanImageExport = {
  // The formats offered; undefined offers every one.
  formats: readonly ExportFormatKey[] | undefined;
  // The tab the images draw (the tab itself on any other tab).
  imageTab: Tab;
  // A Board, Sheet or Dashboard tab: no canvas options (isometric, pattern, hidden layers).
  plain: boolean;
  // What the image exporters add: the Sheets' cells and the plan views' pictures.
  opts: { sheets?: ReadonlyMap<string, SheetRenderModel>; resolvePlanArt?: ResolvePlanArt };
  // False while the Sheets the image draws are still being read.
  ready: boolean;
};

const NO_TABS: readonly Tab[] = [];
const NO_ITEMS = new Map();
const NO_MAP = new Map<string, string>();

type SheetReads = {
  models: ReadonlyMap<string, SheetRenderModel>;
  metrics: ReadonlyMap<string, SheetMetricArt>;
  // The grid each Sheet's cells fill (sheetContentsFor): a Sheet tab's image grows its Sheet to it.
  contents: ReadonlyMap<string, { width: number; height: number }>;
  // The Sheets framed (sheetKey) when read: the cells fit that frame, so a grown one is read again.
  key: string;
};
const NO_CONTENTS = new Map<string, { width: number; height: number }>();

export function usePlanImageExport(
  tab: Tab,
  documentTabs: readonly Tab[] = NO_TABS,
  scope: 'tab' | 'selection' = 'tab',
): PlanImageExport {
  const plan = usePlan();
  const bridge = useSheetsBridgeContext();
  // One clock for the whole export, so the preview and the download read the same day.
  const [now] = useState(() => new Date());
  const whole = scope === 'tab';
  const formats = whole ? exportFormatsFor(tab) : undefined;
  const [reads, setReads] = useState<SheetReads | null>(null);

  // The tab as laid out: the figures from Sheets join once they are read.
  const metrics = reads?.metrics;
  const models = reads?.models;
  const contents = reads?.contents;
  // Keyed on the cards and types alone: the context value also changes with presence and the open card.
  const planItems = plan?.items;
  const planTypes = plan?.types;
  const image: PlanImage | null = useMemo(
    () =>
      whole
        ? planImageOf(tab, {
            tabs: documentTabs,
            now,
            // The editor's themes, the person's own among them.
            themeOf: getTheme,
            ...(metrics ? { metrics } : {}),
            ...(models ? { sheetHeads: (id: string) => !models.get(id)?.hideHeaders } : {}),
            ...(contents ? { sheetContent: (id: string) => contents.get(id) ?? null } : {}),
            renderDiagram: (shown) =>
              renderTabToSvg(tabAsSeen(shown), {
                pattern: false,
                ...(planItems ? { items: planItems, itemTypes: planTypes } : {}),
              }),
          })
        : null,
    [whole, tab, documentTabs, now, metrics, models, contents, planItems, planTypes],
  );
  const imageTab = image?.tab ?? tab;
  // The Sheets the image frames, each at its size: what the read below depends on. The figures it reads never change
  // this; the content sizes it reads may grow a Sheet once, which reads its cells again for the grown frame, and the
  // next read finds the same sizes, so it settles there.
  const sheetKey = imageTab.elements
    .flatMap((el) => {
      const id = (el as { planSheet?: { sheetId?: string } }).planSheet?.sheetId;
      return el.type === 'shape' && el.shape === 'plan-sheet' && id
        ? [`${id}:${Math.round(el.width)}x${Math.round(el.height)}`]
        : [];
    })
    .join(',');
  const needsSheets =
    !!sheetKey ||
    // The stored layout read safely: a malformed one has no figures, rather than throwing.
    !!readDashboard(tab.dashboard)?.rows.some((r) =>
      r.slots.some((s) => s.content?.type === 'sheet-metric'),
    );
  const imageRef = useRef(imageTab);
  useEffect(() => {
    imageRef.current = imageTab;
  });

  // The sheets engine and the store load only when the image has a Sheet to draw.
  useEffect(() => {
    if (!needsSheets || !bridge) return;
    let live = true;
    const key = sheetKey;
    void readSheets().then((next) => {
      if (live) setReads(next);
    });
    // The Sheets' cells and figures, read once their tabs are loaded. A failure (an engine that will not load, a read
    // that throws) still settles, with nothing read: the Sheets draw their frames alone, and the export is not held.
    async function readSheets(): Promise<SheetReads> {
      try {
        const [{ sheetStoreOf }, sheets] = await Promise.all([
          import('@/components/sheets/sheet-store-client'),
          import('@/lib/export-plan/plan-export-sheets'),
        ]);
        if (!bridge) return { models: new Map(), metrics: new Map(), contents: NO_CONTENTS, key };
        const store = sheetStoreOf(bridge);
        const tabs = documentTabs.length ? documentTabs : [tab];
        await Promise.all(
          sheets
            .sheetTabsToLoad(imageRef.current, tab.dashboard, tabs)
            .map((id) => store.loadTab(id)),
        );
        const next = {
          models: sheets.sheetModelsFor(imageRef.current.elements, store),
          metrics: sheets.sheetMetricsFor(tab.dashboard, tabs, store, bridge.locale),
          contents: sheets.sheetContentsFor(imageRef.current.elements, store),
          key,
        };
        debugLog('[export] sheets read', { models: next.models.size, metrics: next.metrics.size });
        return next;
      } catch (e) {
        debugLog('[export] sheets.read.failed', { error: e instanceof Error ? e.name : 'unknown' });
        return { models: new Map(), metrics: new Map(), contents: NO_CONTENTS, key };
      }
    }
    return () => {
      live = false;
    };
    // Read again when the Sheets framed, the layout or the tabs change; `tab` itself is read through them.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [needsSheets, bridge, sheetKey, tab.dashboard, documentTabs]);

  // A plan view's picture from the document's cards, and each placeholder's from the layout.
  const art = image?.art ?? NO_MAP;
  const surface = canvasSurface(imageTab.backgroundColor ?? EXPORT_BG);
  const data: PlanArtData = useMemo(
    () => ({
      items: plan?.items ?? NO_ITEMS,
      types: plan?.types ?? [],
      statusPhases: plan?.statusPhases ?? new Map(),
      statusNames: plan?.statusNames ?? new Map(),
      now,
      chartPalette: PIE_PALETTE,
    }),
    [plan?.items, plan?.types, plan?.statusPhases, plan?.statusNames, now],
  );
  const resolvePlanArt = useMemo<ResolvePlanArt>(
    () => (el) => art.get(el.id) ?? (el.planView ? planViewArt(el, data, surface) : undefined),
    [art, data, surface],
  );
  const opts = useMemo(
    () => ({ resolvePlanArt, ...(models ? { sheets: models } : {}) }),
    [resolvePlanArt, models],
  );
  return {
    formats,
    imageTab,
    plain: !!image,
    opts,
    // Without a sheets bridge (outside the editor) a Sheet draws its frame alone, so nothing is awaited.
    // Ready once the Sheets are read for the frames now drawn: a Sheet grown by its content waits for its cells.
    ready: !needsSheets || !bridge || reads?.key === sheetKey,
  };
}
