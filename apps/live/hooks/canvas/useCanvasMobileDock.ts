import { useRef, useState, type Ref } from 'react';
import { computeDockAnchor } from '@/lib/canvas-chrome';

// Mobile dock: a compact button row that replaces the four full-width
// collapse banners on small screens. This hook owns its state — which
// panel (if any) is open, the button-ref map used to position the
// popover, and the resolved popover anchor — plus the toggle handler.
// The anchor math is the pure computeDockAnchor (tested in
// lib/canvas-chrome.test.ts); the DOM-rect reads stay here.

const POPOVER_WIDTH = 256;

export type MobilePanel = 'explorer' | 'palette' | 'collaborate' | 'ai' | 'layers';

export type DockAnchor = { left: number; top: number; arrowOffset: number };

export function useCanvasMobileDock(mainRef: Ref<HTMLElement>) {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel | null>(null);
  const dockButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeDockAnchor, setActiveDockAnchor] = useState<DockAnchor | null>(null);

  const handleDockButtonClick = (id: MobilePanel) => {
    // Tapping the open panel's button closes it.
    if (activeMobilePanel === id) {
      setActiveMobilePanel(null);
      setActiveDockAnchor(null);
      return;
    }
    setActiveMobilePanel(id);
    const btn = dockButtonRefs.current[id];
    const canvas = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (btn && canvas) {
      setActiveDockAnchor(
        computeDockAnchor(
          btn.getBoundingClientRect(),
          canvas.getBoundingClientRect(),
          POPOVER_WIDTH,
        ),
      );
    }
  };

  return {
    activeMobilePanel,
    setActiveMobilePanel,
    dockButtonRefs,
    activeDockAnchor,
    setActiveDockAnchor,
    handleDockButtonClick,
  };
}
