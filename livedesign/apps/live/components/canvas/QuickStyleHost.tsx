'use client';

// The Quick Style bar's host (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas"):
// it reads the selection from the store and builds the bar's view from it, so a selection change
// renders this and the bar, never the editor root that hands it everything else.

import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentProps } from 'react';
import dynamic from 'next/dynamic';
import type { QuickStyleBar as QuickStyleBarComponent } from '@/components/canvas/QuickStyleBar';
import { loadQuickStyleBar } from '@/lib/editor-deferred-code';
import { quickStyleBarPage, quickStyleStyledIds } from '@/lib/quick-style-bar';
import { useCurrentPageId } from '@/lib/current-page-kind';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { useQuickStyle, type QuickStyleDeps } from '@/hooks/canvas/useQuickStyle';
import {
  sameMembers,
  selectionIds,
  type Selection,
} from '@liveworkspace/workbench/lib/selection-store';
import { publishClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';

// Shown once something is selected; its code is fetched once the editor is idle (lib/editor-deferred-code.ts).
const QuickStyleBar = dynamic(loadQuickStyleBar, { ssr: false });

const selectionSetOf = (s: Selection) => selectionIds(s.selectedId, s.multiSelectedIds);

export function QuickStyleHost({
  deps,
  ...bar
}: { deps: QuickStyleDeps } & Omit<
  ComponentProps<typeof QuickStyleBarComponent>,
  'quickStyle' | 'pageId'
>) {
  const ids = useSelectionOf(selectionSetOf, sameMembers);
  const quickStyle = useQuickStyle({ ...deps, selectionIds: ids });
  // The page it sits on: the one holding most of what it styles, or, for a tool in hand, the page you are on.
  const { view } = quickStyle;
  const styledKey = view ? quickStyleStyledIds(view).join(' ') : null;
  const elements = deps.activeTab.elements;
  const { pages } = deps;
  const currentPageId = useCurrentPageId();
  const pageId = useMemo(
    () =>
      styledKey === null
        ? null
        : quickStyleBarPage(styledKey ? styledKey.split(' ') : [], elements, pages, currentPageId),
    [styledKey, elements, pages, currentPageId],
  );
  // Clear Styles for the element menu's quick bar (clear-styles-store): published while the view has targets, even
  // with the bar hidden (as it is while the menu is open), and only when they change; the press runs the latest.
  const latest = useRef(quickStyle);
  useLayoutEffect(() => {
    latest.current = quickStyle;
  });
  const targets = view?.targetIds ?? null;
  const targetsKey = targets ? [...targets].sort().join(' ') : '';
  useEffect(() => {
    if (!targetsKey) {
      publishClearStyles(null);
      return;
    }
    publishClearStyles({
      targetIds: new Set(targetsKey.split(' ')),
      clear: () => latest.current.clearStyles(),
    });
    return () => publishClearStyles(null);
  }, [targetsKey]);
  return <QuickStyleBar {...bar} quickStyle={quickStyle} pageId={pageId} />;
}
