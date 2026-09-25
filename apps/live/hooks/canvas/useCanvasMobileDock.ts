import { useEffect, useRef, useState, type Ref } from 'react';
import { computeDockAnchor, type DockAnchor } from '@/lib/canvas-chrome';
import { track } from '@/lib/telemetry';

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
  // Opened from the bottom-right cluster in the dock layouts (spec/12), not
  // from a dock-row button.
  | 'activity'
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

export type { DockAnchor };

// The panel-open counts (spec/22) for panels that ALSO open on desktop by
// un-minimising a floating card (EditorCanvasHost's toggles emit there). In
// the dock layouts (minimal panels, phones, the Toolbar layout) the same
// panel opens here instead, as a popover, and a click takes one path or the
// other (the cluster button calls either its popover toggle or its expand,
// never both), so each surface counts its own opens and none counts twice.
// Only on the open transition: re-opening the panel already showing is not
// a new open.
function trackDockPanelOpened(id: MobilePanel): void {
  if (id === 'layers') track('Layer', 'Opened', 'Panel');
  else if (id === 'activity') track('UI', 'Opened', 'Activity');
}

export function useCanvasMobileDock(mainRef: Ref<HTMLElement>) {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel | null>(null);
  const dockButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeDockAnchor, setActiveDockAnchor] = useState<DockAnchor | null>(null);

  // Open a panel under its dock button (never toggles it shut).
  //
  // `ownButton` is a lone button OUTSIDE the dock asking to anchor a panel
  // (the Toolbar layout's menu button, spec/148). It is passed in rather than
  // registered in dockButtonRefs because the dock, hidden on desktop but still
  // mounted, registers its own button under the same panel id, and a hidden
  // button measures as a zero rect in the corner. It also switches the popover
  // to hang from the button (computeDockAnchor's 'button') rather than tuck
  // against the dock's right edge.
  // `above` (with `ownButton`) opens the popover up from a button in the
  // bottom-right cluster instead of down from one at the top.
  const openDockPanel = (id: MobilePanel, ownButton?: HTMLElement, above = false) => {
    if (id !== activeMobilePanel) trackDockPanelOpened(id);
    setActiveMobilePanel(id);
    const btn = ownButton ?? dockButtonRefs.current[id];
    const canvas = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (btn && canvas) {
      setActiveDockAnchor(
        computeDockAnchor(
          btn.getBoundingClientRect(),
          canvas.getBoundingClientRect(),
          POPOVER_WIDTH,
          ownButton ? (above ? 'above' : 'button') : 'dock',
        ),
      );
    }
  };

  const handleDockButtonClick = (id: MobilePanel, ownButton?: HTMLElement, above = false) => {
    // Tapping the open panel's button closes it.
    if (activeMobilePanel === id) {
      setActiveMobilePanel(null);
      setActiveDockAnchor(null);
      return;
    }
    openDockPanel(id, ownButton, above);
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
