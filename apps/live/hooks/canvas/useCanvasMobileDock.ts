import { useEffect, useRef, useState, type Ref } from 'react';
import { computeDockAnchor } from '@/lib/canvas-chrome';

// Mobile dock: a compact button row that replaces the four full-width
// collapse banners on small screens. This hook owns its state — which
// panel (if any) is open, the button-ref map used to position the
// popover, and the resolved popover anchor — plus the toggle handler.
// The anchor math is the pure computeDockAnchor (tested in
// lib/canvas-chrome.test.ts); the DOM-rect reads stay here.

const POPOVER_WIDTH = 256;

// 'poll' and 'vote' only ever appear while a poll / dot-vote is running on the
// tab (spec/88, spec/39). Without them the dock had no button for either, so
// on a phone the one panel that matters during a live session was the one you
// could not get back to once it was dismissed.
export type MobilePanel =
  | 'explorer'
  | 'palette'
  | 'collaborate'
  | 'ai'
  | 'layers'
  | 'poll'
  | 'vote'
  // 'avatar' (spec/101) appears only while Avatar mode is active, like the
  // session-tool panels above it.
  | 'avatar'
  // 'laser' (spec/111) likewise: the pen's settings, only while the Laser
  // tool is active.
  | 'laser'
  // 'spotlight' (spec/112): the light's look, likewise only while its mode is
  // active.
  | 'spotlight'
  // 'eraser' (spec/113): the brush's settings, while the Eraser is active.
  | 'eraser'
  // 'format' (spec/117): the painter's settings, while the Format tool is on.
  | 'format'
  // 'highlighter' (spec/81): the marker's colour + strength, while it is held.
  | 'highlighter'
  // 'slide-deck' (spec/31): the deck builder, while the tool is picked.
  | 'slide-deck';

export type DockAnchor = { left: number; top: number; arrowOffset: number };

export function useCanvasMobileDock(mainRef: Ref<HTMLElement>) {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel | null>(null);
  const dockButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeDockAnchor, setActiveDockAnchor] = useState<DockAnchor | null>(null);

  // Open a panel under its dock button (never toggles it shut).
  const openDockPanel = (id: MobilePanel) => {
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

  const handleDockButtonClick = (id: MobilePanel) => {
    // Tapping the open panel's button closes it.
    if (activeMobilePanel === id) {
      setActiveMobilePanel(null);
      setActiveDockAnchor(null);
      return;
    }
    openDockPanel(id);
  };

  return {
    openDockPanel,
    activeMobilePanel,
    setActiveMobilePanel,
    dockButtonRefs,
    activeDockAnchor,
    setActiveDockAnchor,
    handleDockButtonClick,
  };
}

// Open a dock panel by itself when something new appears for it: a poll that
// just started (or that you just answered), a vote that just opened. In the
// dock layout (phone, or the minimal panel preference) a session panel lives
// under its button, closable like the rest, but the moment it arrives is the
// moment you want to see it, so it opens once, keyed on `key`. The dock button
// renders in the same commit, so its rect is measurable when this runs.
export function useOpenDockPanelOnChange(
  key: string | null,
  id: MobilePanel,
  openDockPanel: (id: MobilePanel) => void,
) {
  // Latest opener, kept in a ref (updated after commit) so the effect below
  // fires on `key` alone rather than on every render's new function.
  const openRef = useRef(openDockPanel);
  useEffect(() => {
    openRef.current = openDockPanel;
  });
  useEffect(() => {
    if (key !== null) openRef.current(id);
  }, [key, id]);
}
