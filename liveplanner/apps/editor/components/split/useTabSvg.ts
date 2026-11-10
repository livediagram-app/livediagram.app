'use client';

import { useThreadStore } from '@/components/plan/threads/CardThreadsContext';
import { itemsWithCounts } from '@/hooks/plan/thread-store';
import { donePhase } from '@liveplanner/items';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { tabWindowNames, type Tab } from '@liveplanner/project';
import { tabAsSeen } from '@/lib/export-as-seen';
import { renderTabDrawingSvg } from '@/lib/tab-drawing';
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
// priority, so a burst of remote edits never competes with the editor beside it. A still, as every export is.
//
// Drawn by renderTabDrawingSvg: a Pages tab as its pages and a Form tab as its form, any other tab as its canvas, so
// the other pane and a Diagram slot show a tab the same way.
export function useTabSvg(tab: Tab | undefined): TabSvg | null {
  const { tabs } = useEditorContext();
  // A stored tab window inside this tab (docs/specs/009-elements/tab-window.md, retired) is named for the tab it
  // showed, as the export names it. Keyed on the tabs' names, not the
  // tabs, so an edit anywhere in the project does not redraw this one.
  const nameKey = tabs.map((t) => `${t.id}\u0000${t.name}`).join('\u0001');
  // oxlint-disable-next-line react/exhaustive-deps -- keyed on the tabs' names, not the tabs
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
      resolveTabWindow: windowNames,
      // Each card with its comment count, which its threads hold (docs/specs/026-plan/items.md "Comments").
      ...(plan
        ? {
            items: threadStore ? itemsWithCounts(plan.items, threadStore.counts()) : plan.items,
            itemTypes: plan.types,
            // The plan-wide done columns, for the blocked badge (docs/specs/026-plan/item-types.md "Blocked By").
            itemsDone: donePhase(plan.statusPhases),
          }
        : {}),
    });
    return {
      markup,
      ...svgFrameOf(markup),
      background: seen.backgroundColor ?? '#ffffff',
    };
  }, [deferredTab, appearance, plan, threadStore, iconsReady, windowNames]);
}
