'use client';

// The paper and pattern the editor paints behind a tab (docs/specs/007-editor/split-view.md "The other
// pane"): what a drawing of the tab sits on, so it reads as that tab's own canvas wherever it is shown.
import { useCallback, useMemo, type CSSProperties } from 'react';
import type { Tab } from '@livehuddle/document';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { resolveTabBackdrop } from '@/lib/themes';
import { useAppearance } from '@/hooks/ui/useAppearance';

/** Paints a canvas whose origin sits at `origin` (px in the box painted) at zoom `k`. */
export type TabBackdropPaint = (origin: { x: number; y: number }, k: number) => CSSProperties;

export function useTabBackdropPaint(tab: Tab): TabBackdropPaint {
  const { appearance } = useAppearance();
  const backdrop = useMemo(() => resolveTabBackdrop(tab, appearance), [tab, appearance]);
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
