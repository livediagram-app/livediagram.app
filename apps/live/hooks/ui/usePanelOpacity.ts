import { useEffect } from 'react';

// Keep the `--lvd-panel-opacity` custom property on <html> in sync with the
// user's "Panel opacity" preference (spec/20). The full floating editor
// panels (MovablePanel, tagged `data-panel-translucent`) read it via CSS in
// globals.css, so dragging the slider makes them translucent live and they
// snap back to opaque on hover / focus. Only the full panels reference the
// var; the minimal dock bar never does, so this preference leaves the
// minimal layout untouched. undefined / >= 1 clears the var so the CSS
// fallback of 1 (fully opaque) applies.
export function usePanelOpacity(opacity: number | undefined): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (opacity === undefined || opacity >= 1) {
      root.style.removeProperty('--lvd-panel-opacity');
    } else {
      root.style.setProperty('--lvd-panel-opacity', String(opacity));
    }
  }, [opacity]);
}
