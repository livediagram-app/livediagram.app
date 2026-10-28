'use client';

import { useThreadStore } from '@/components/plan/threads/CardThreadsContext';
import { itemsWithCounts } from '@/hooks/plan/thread-store';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { canvasSurface, tabWindowNames, type Tab } from '@liveplanner/project';
import { tabAsSeen } from '@/lib/export-as-seen';
import type { renderTabToSvg } from '@/lib/export-tab';
import { renderTabDrawingSvg } from '@/lib/tab-drawing';
import type { SvgMotion } from '@/lib/export-tab';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { svgFrameOf } from '@liveworkspace/workbench/lib/svg-frame';
import { usePlan } from '@/components/plan/PlanContext';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useEditorContext } from '@/app/project/[id]/EditorContext';

export type TabSvg = {
  markup: string;
  // The drawing's own size in canvas units (the SVG's width / height), for fitting it to a pane.
  width: number;
  height: number;
  // Where the drawing starts in canvas space (the SVG's viewBox corner): canvas point `origin` is
  // drawn at the SVG's top-left.
  origin: { x: number; y: number };
  // The paper behind the drawing, so the pane around it reads as the same canvas.
  background: string;
};

// A tab drawn as the editor would show it (docs/specs/007-editor/split-view.md "The right pane"):
// the export renderer's SVG, in the viewer's appearance, with the project's Plan items. Re-rendered when the tab changes (an edit, a collaborator's op) at a deferred
// priority, so a burst of remote edits never competes with the editor beside it.
//
// `motionFor` sets the drawing moving (a tab window, docs/specs/009-elements/tab-window.md "The drawing"): given the
// drawn tab's surface, it says how each element animates. Without it the drawing is a still, as the side pane's is.
// Pass a module-level function so its identity is stable.
//
// `planOpts` adds what a Plan tab's picture needs beyond its cards (usePlanImageExport): its Sheets' cells and its
// plan views' pictures. A tab window passes them, so it draws a Board, Sheet or Dashboard tab as laid out.
//
// Drawn by renderTabDrawingSvg: a Pages tab as its pages and a Form tab as its form, any other tab as its canvas, so a
// window, the other pane and a Diagram slot all show a tab the same way.
export function useTabSvg(
  tab: Tab | undefined,
  motionFor?: (surface: ReturnType<typeof canvasSurface>) => SvgMotion,
  planOpts?: Pick<NonNullable<Parameters<typeof renderTabToSvg>[1]>, 'sheets' | 'resolvePlanArt'>,
): TabSvg | null {
  const { tabs } = useEditorContext();
  // A window inside this tab is named for the tab it shows, as the export names it. Keyed on the tabs' names, not the
  // tabs, so an edit anywhere in the project does not redraw this one.
  const nameKey = tabs.map((t) => `${t.id}\u0000${t.name}`).join('\u0001');
  // oxlint-disable-next-line react/exhaustive-deps
  const windowNames = useMemo(() => tabWindowNames(tabs), [nameKey]);
  const plan = usePlan();
  const threadStore = useThreadStore();
  const { appearance } = useAppearance();
  const deferredTab = useDeferredValue(tab);
  const [iconsReady, setIconsReady] = useState(false);

  useEffect(() => {
    let live = true;
    void ensureIconCatalogs().then(() => live && setIconsReady(true));
    return () => {
      live = false;
    };
  }, []);

  return useMemo(() => {
    if (!deferredTab) return null;
    // `iconsReady` re-renders once the glyph catalogues land, so icons replace their placeholders.
    void iconsReady;
    const seen = tabAsSeen(deferredTab, appearance);
    const markup = renderTabDrawingSvg(seen, {
      pattern: false,
      motion: motionFor?.(canvasSurface(seen.backgroundColor)),
      resolveTabWindow: windowNames,
      // Each card with its comment count, which its threads hold (docs/specs/026-plan/items.md "Comments").
      ...(plan
        ? {
            items: threadStore ? itemsWithCounts(plan.items, threadStore.counts()) : plan.items,
            itemTypes: plan.types,
          }
        : {}),
      ...planOpts,
    });
    return {
      markup,
      ...svgFrameOf(markup),
      background: seen.backgroundColor ?? '#ffffff',
    };
  }, [deferredTab, appearance, plan, threadStore, iconsReady, windowNames, motionFor, planOpts]);
}
