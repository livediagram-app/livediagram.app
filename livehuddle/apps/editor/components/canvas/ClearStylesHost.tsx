'use client';

// Clear Styles for the element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md). Headless: it reads
// the selection from the store, builds the Quick Style view from it (which elements Clear Styles resets) and publishes
// that to the clear-styles-store, so a selection change renders this, never the editor root. livehuddle has no Quick
// Style panel (docs/specs/002-project-scope/not-in-livehuddle.md#quick-style); the view is what is left of it.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { useQuickStyle, type QuickStyleDeps } from '@/hooks/canvas/useQuickStyle';
import {
  sameMembers,
  selectionIds,
  type Selection,
} from '@liveworkspace/workbench/lib/selection-store';
import { publishClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';

const selectionSetOf = (s: Selection) => selectionIds(s.selectedId, s.multiSelectedIds);

export function ClearStylesHost({ deps }: { deps: QuickStyleDeps }) {
  const ids = useSelectionOf(selectionSetOf, sameMembers);
  const quickStyle = useQuickStyle({ ...deps, selectionIds: ids });
  // Published while the view has targets, and only when they change; the press runs the latest.
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
  return null;
}
