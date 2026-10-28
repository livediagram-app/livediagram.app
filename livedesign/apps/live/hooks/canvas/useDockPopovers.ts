import { useState, type Ref } from 'react';
import { computeDockAnchor, type DockAnchor } from '@/lib/canvas-chrome';
import { track } from '@/lib/telemetry';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';

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
// A popover wider than the rest, so its placement keeps all of it on the canvas.
const POPOVER_WIDTHS: Partial<Record<string, number>> = {
  // The Layers popover's `w-[22rem]`: roomy rows (docs/specs/006-design/layers.md).
  layers: 352,
  // The Contents popover's `w-[380px]` (docs/specs/007-editor/pages-mode.md "Contents").
  contents: 380,
  // The Photo panel's 280 px (docs/specs/031-photo/photo-pages.md "The Photo panel").
  'photo-panel': 280,
  // The Explorer's `w-[60rem]`: its rail beside a pane (docs/specs/013-workspace/explorer-structure.md).
  explorer: 960,
};

export type DockPanel =
  | 'explorer'
  | 'layers'
  | 'collaborate'
  // Pages mode's Contents (docs/specs/007-editor/pages-mode.md "Contents").
  | 'contents'
  // A photo page's Photo panel over its button in the Pages strip (docs/specs/031-photo/photo-pages.md "The Photo panel").
  | 'photo-panel';

export type { DockAnchor };

// The panel-open counts (docs/specs/017-telemetry/telemetry.md) for panels that open as a popover over
// their cluster button. Only on the open transition: re-opening the panel already showing is not a
// new open.
function trackDockPanelOpened(id: DockPanel): void {
  if (id === 'layers') track('Layer', 'Opened', 'Panel');
  else if (id === 'collaborate') track('UI', 'Opened', 'Collaborate');
  else if (id === 'contents') track('UI', 'Opened', 'PageContents');
  else if (id === 'photo-panel') track('UI', 'Opened', 'PhotoPanel');
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
          (POPOVER_WIDTHS[id] ?? POPOVER_WIDTH) * scale,
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
