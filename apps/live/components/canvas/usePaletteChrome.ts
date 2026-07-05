'use client';

import { useEffect, useRef } from 'react';
import { getTheme } from '@/lib/themes';
import { isMobileViewportSync } from '@/lib/responsive';
import type { CanvasChromeProps } from './CanvasChrome';

// The palette's chrome behaviours (spec/09 + /63), lifted out of
// useCanvasChromePanels: the dock-mode reopen-after-draw transition and
// the active-tab theme tint the tiles preview.
export function usePaletteChrome({
  tabThemeId,
  pendingDraw,
  minimalPanels,
  activeMobilePanel,
  handleDockButtonClick,
}: {
  tabThemeId: CanvasChromeProps['tabThemeId'];
  pendingDraw: CanvasChromeProps['pendingDraw'];
  minimalPanels: CanvasChromeProps['minimalPanels'];
  activeMobilePanel: CanvasChromeProps['activeMobilePanel'];
  handleDockButtonClick: CanvasChromeProps['handleDockButtonClick'];
}) {
  // Dock-mode palette reopen: when a draw tool is armed FROM the palette it
  // closes so the user can draw; once the draw lands (pendingDraw clears),
  // reopen the palette so they can pick the next thing without re-tapping.
  const reopenPaletteAfterDrawRef = useRef(false);
  const prevPendingDrawRef = useRef(pendingDraw);
  // Keep the latest opener in a ref so the transition effect can stay keyed
  // on pendingDraw without re-running every render.
  const openDockPanelRef = useRef(handleDockButtonClick);
  openDockPanelRef.current = handleDockButtonClick;
  useEffect(() => {
    const prev = prevPendingDrawRef.current;
    prevPendingDrawRef.current = pendingDraw;
    if (prev && !pendingDraw && reopenPaletteAfterDrawRef.current) {
      reopenPaletteAfterDrawRef.current = false;
      // Reopen via the dock handler so the popover anchor is recomputed
      // from the dock button (the same path a manual tap takes) — setting
      // the panel alone would reopen it at a stale/missing position.
      if (minimalPanels || isMobileViewportSync()) openDockPanelRef.current('palette');
    }
  }, [pendingDraw, minimalPanels]);
  // Theme tint for the palette tiles, so the palette previews the active
  // tab theme: the boxed-shape tiles render filled in the theme's element
  // fill + stroke, line-art tools + icons tint to the stroke. The Basic
  // theme leaves elementStroke null, so we pass nothing and the palette
  // keeps its default slate look. See spec/09.
  const paletteTheme = getTheme(tabThemeId);
  // A per-shape theme (UML / custom, spec/42 + spec/44) tints each shape
  // tile by its own kind even when the base element stroke is unset, so
  // surface the tint whenever there's a base stroke OR per-shape colours.
  const paletteTint =
    paletteTheme.elementStroke || paletteTheme.shapeColors
      ? {
          stroke: paletteTheme.elementStroke ?? undefined,
          fill: paletteTheme.elementFill ?? undefined,
          shapeColors: paletteTheme.shapeColors,
        }
      : undefined;

  // Only remember to reopen if the palette was actually the open
  // dock panel when the draw was armed.
  const onPaletteDrawArmed = () => {
    reopenPaletteAfterDrawRef.current = activeMobilePanel === 'palette';
  };

  return { paletteTheme, paletteTint, onPaletteDrawArmed };
}
