'use client';

// The Quick Style panel's host (docs/specs/008-canvas/blueprints/selection-store.md "Above the canvas"):
// it reads the selection from the store and builds the panel's view from it, so a selection change
// renders this and the panel, never the editor root that hands it everything else.

import { useEffect, useLayoutEffect, useRef, type ComponentProps } from 'react';
import dynamic from 'next/dynamic';
import type { QuickStylePanel as QuickStylePanelComponent } from '@/components/canvas/QuickStylePanel';
import { loadQuickStylePanel } from '@/lib/editor-deferred-code';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { useQuickStyle, type QuickStyleDeps } from '@/hooks/canvas/useQuickStyle';
import { sameMembers, selectionIds, type Selection } from '@/lib/selection-store';
import { publishClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';

// Shown once something is selected; its code is fetched once the editor is idle (lib/editor-deferred-code.ts).
const QuickStylePanel = dynamic(loadQuickStylePanel, { ssr: false });

const selectionSetOf = (s: Selection) => selectionIds(s.selectedId, s.multiSelectedIds);

export function QuickStyleHost({
  deps,
  ...panel
}: { deps: QuickStyleDeps } & Omit<ComponentProps<typeof QuickStylePanelComponent>, 'quickStyle'>) {
  const ids = useSelectionOf(selectionSetOf, sameMembers);
  const quickStyle = useQuickStyle({ ...deps, selectionIds: ids });
  // Clear Styles for the element menu's quick bar (clear-styles-store): published while the view has targets, even
  // with the panel hidden (as it is while the menu is open), and only when they change; the press runs the latest.
  const latest = useRef(quickStyle);
  useLayoutEffect(() => {
    latest.current = quickStyle;
  });
  const targets = quickStyle.view?.targetIds ?? null;
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
  return <QuickStylePanel {...panel} quickStyle={quickStyle} />;
}
