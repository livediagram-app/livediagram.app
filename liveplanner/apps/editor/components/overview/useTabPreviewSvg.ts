'use client';

// A tab tile's preview drawn (docs/specs/026-plan/plan-overview.md "Tabs"): the tab's image export, the same SVG the
// Export dialog previews and downloads (usePlanImageExport, renderTabDrawingSvg), in the viewer's appearance, with the
// plan's cards. A Board or Sheet tab is sized to the preview window first (previewTabOf). Drawn once per change of
// what it shows: the tab, the cards, their types, the done columns, the comment counts, the Sheets read; never for
// presence or another tab (a Dashboard alone reads the plan's tabs, as its slots draw them).
import { useEffect, useMemo, useState } from 'react';
import { donePhase } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { svgFrameOf } from '@liveworkspace/workbench/lib/svg-frame';
import { usePlanImageExport } from '@/components/dialogs/usePlanImageExport';
import { usePlan } from '@/components/plan/PlanContext';
import { useThreadStore } from '@/components/plan/threads/CardThreadsContext';
import { itemsWithCounts } from '@/hooks/plan/thread-store';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { tabAsSeen } from '@/lib/export-as-seen';
import { renderTabDrawingSvg } from '@/lib/tab-drawing';
import { previewTabOf } from './tab-preview-svg';

export type TabPreviewSvg = { markup: string; width: number; height: number; background: string };

const NO_TABS: readonly Tab[] = [];

// The glyph catalogues, asked for once for every preview: a card's type glyph draws from them.
let icons: Promise<void> | null = null;
let iconsLoaded = false;
function useIconsReady(): boolean {
  const [ready, setReady] = useState(iconsLoaded);
  useEffect(() => {
    if (ready) return;
    let live = true;
    icons ??= ensureIconCatalogs().then(
      () => void (iconsLoaded = true),
      () => void (iconsLoaded = true),
    );
    void icons.then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [ready]);
  return ready;
}

export function useTabPreviewSvg(tab: Tab, tabs: readonly Tab[]): TabPreviewSvg | null {
  const { appearance } = useAppearance();
  const plan = usePlan();
  const threadStore = useThreadStore();
  const iconsReady = useIconsReady();
  const seen = useMemo(() => tabAsSeen(previewTabOf(tab), appearance), [tab, appearance]);
  const image = usePlanImageExport(seen, seen.kind === 'dashboard' ? tabs : NO_TABS);
  const storedItems = plan?.items;
  const types = plan?.types;
  const phases = plan?.statusPhases;
  const items = useMemo(
    () =>
      storedItems && threadStore ? itemsWithCounts(storedItems, threadStore.counts()) : storedItems,
    [storedItems, threadStore],
  );
  const { imageTab, plain, opts, ready } = image;
  return useMemo(() => {
    if (!iconsReady || !ready) return null;
    const markup = renderTabDrawingSvg(imageTab, {
      pattern: false,
      hiddenLayers: plain,
      ...(items ? { items, itemTypes: types } : {}),
      ...(phases ? { itemsDone: donePhase(phases) } : {}),
      ...opts,
    });
    const frame = svgFrameOf(markup);
    return {
      markup,
      width: frame.width,
      height: frame.height,
      background: imageTab.backgroundColor ?? '#ffffff',
    };
  }, [iconsReady, ready, imageTab, plain, items, types, phases, opts]);
}
