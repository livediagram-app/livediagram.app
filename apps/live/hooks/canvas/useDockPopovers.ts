import { useState, type Ref } from 'react';
import { computeDockAnchor, type DockAnchor } from '@/lib/canvas-chrome';
import { track } from '@/lib/telemetry';
import { useUiScale } from '@/components/providers/ui-scale';

// The panels that open as popovers off a button: the Toolbar layout's
// Explorer, from its menu button (docs/specs/007-editor/toolbar-layout.md), and Layers / Activity /
// Collaborate, from their bottom-right cluster buttons (docs/specs/007-editor/live-app.md). One is open
// at a time. This hook owns which (if any), the resolved popover anchor, and
// the toggle handler. The anchor math is the pure computeDockAnchor (tested
// in lib/canvas-chrome.test.ts); the DOM-rect reads stay here.

// The popover's width at 100%; it is drawn at the UI scale
// (docs/specs/007-editor/ui-scale.md), so the anchor clamps against the
// scaled width or a scaled popover runs off the right edge.
const POPOVER_WIDTH = 256;

// 'slides': the Slide Deck panel over its cluster button in Illustrate mode. 'card-types': the Card
// Types panel over its cluster button in Plan mode (docs/specs/025-plan/item-types.md).
export type DockPanel = 'explorer' | 'layers' | 'collaborate' | 'slides' | 'card-types';

export type { DockAnchor };

// The panel-open counts (docs/specs/017-telemetry/telemetry.md) for panels that ALSO open on desktop by
// un-minimising a floating card (EditorCanvasHost's toggles emit there). As
// a popover the same panel opens here instead, and a click takes one path or
// the other (the cluster button calls either its popover toggle or its
// expand, never both), so each surface counts its own opens and none counts
// twice. Only on the open transition: re-opening the panel already showing
// is not a new open.
function trackDockPanelOpened(id: DockPanel): void {
  if (id === 'layers') track('Layer', 'Opened', 'Panel');
  else if (id === 'collaborate') track('UI', 'Opened', 'Collaborate');
  else if (id === 'slides') track('UI', 'Opened', 'SlideDeck');
  else if (id === 'card-types') track('Plan', 'Opened', 'CardTypes');
}

export function useDockPopovers(mainRef: Ref<HTMLElement>) {
  const [activeDockPanel, setActiveDockPanel] = useState<DockPanel | null>(null);
  const [activeDockAnchor, setActiveDockAnchor] = useState<DockAnchor | null>(null);
  const scale = useUiScale('panels');

  // Toggle a panel's popover from the button that owns it. The popover hangs
  // from the button (computeDockAnchor's 'button'), or, with `above`, opens
  // up from a button in the bottom-right cluster. Tapping the open panel's
  // button closes it.
  const handleDockButtonClick = (id: DockPanel, button: HTMLElement, above = false) => {
    if (activeDockPanel === id) {
      setActiveDockPanel(null);
      setActiveDockAnchor(null);
      return;
    }
    trackDockPanelOpened(id);
    setActiveDockPanel(id);
    const canvas = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (canvas) {
      setActiveDockAnchor(
        computeDockAnchor(
          button.getBoundingClientRect(),
          canvas.getBoundingClientRect(),
          POPOVER_WIDTH * scale,
          above ? 'above' : 'button',
        ),
      );
    }
  };

  return {
    activeDockPanel,
    setActiveDockPanel,
    activeDockAnchor,
    setActiveDockAnchor,
    handleDockButtonClick,
  };
}
