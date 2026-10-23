'use client';

// The paper and pattern the editor paints behind a tab, (docs/specs/007-editor/split-view.md "The other
// pane", docs/specs/009-elements/tab-window.md "The drawing"): what a drawing of the tab sits on, so it reads as that
// tab's own canvas wherever it is shown. Shared by the split view's other pane and a tab window.
import { useCallback, useMemo, type CSSProperties } from 'react';
import type { Tab } from '@livedesign/design';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { useAppearance } from '@/hooks/ui/useAppearance';

/** Paints a canvas whose origin sits at `origin` (px in the box painted) at zoom `k`. */
export type TabBackdropPaint = (origin: { x: number; y: number }, k: number) => CSSProperties;

export function useTabBackdropPaint(tab: Tab): TabBackdropPaint {
  const { appearance } = useAppearance();
  const backdrop = useMemo(() => resolveViewBackdrop(tab, appearance), [tab, appearance]);
  const scale = tab.backgroundPatternScale ?? 1;
  return useCallback(
    (origin, k) =>
      tabBackgroundStyle(
        backdrop.backgroundPattern ?? 'grid',
        origin,
        backdrop.backgroundColor,
        backdrop.patternColor,
        backdrop.backgroundOpacity ?? 1,
        scale * k,
      ),
    [backdrop, scale],
  );
}
