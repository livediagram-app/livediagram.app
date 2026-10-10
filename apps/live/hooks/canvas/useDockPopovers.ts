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
// A popover wider than the rest, so its placement keeps all of it on the canvas.
export const POPOVER_WIDTHS: Partial<Record<string, number>> = {
  'plan-trash': 352,
  // CardFinderPanel's `sm:w-[44rem]`: wide enough for each row's state, priority, due date and assignee.
  'plan-cards': 704,
  // CardTypesPanel's `sm:w-[34rem]`, two types to a row.
  'card-types': 544,
  // NewCardPanel's `w-72`.
  'plan-new-card': 288,
  // The Session strip's popovers, `w-72` each (docs/specs/012-collaboration/session-tools.md).
  'session-timer': 288,
  'session-vote': 288,
  'session-poll': 288,
};

// 'slides': the Slide Deck panel over its cluster button in Illustrate mode. 'card-types': the Card
// Types panel over its cluster button in Plan mode (docs/specs/026-plan/item-types.md).
export type DockPanel =
  | 'explorer'
  | 'layers'
  | 'collaborate'
  | 'slides'
  | 'card-types'
  | 'plan-trash'
  | 'plan-cards'
  | 'plan-new-card'
  // The Session strip's Timer, Vote and Poll (docs/specs/012-collaboration/session-tools.md "The Session strip").
  | 'session-timer'
  | 'session-vote'
  | 'session-poll';

export type { DockAnchor };

// The panel-open counts (docs/specs/017-telemetry/telemetry.md) for panels that open as a popover over
// their cluster button. Only on the open transition: re-opening the panel already showing is not a
// new open.
function trackDockPanelOpened(id: DockPanel): void {
  if (id === 'layers') track('Layer', 'Opened', 'Panel');
  else if (id === 'collaborate') track('UI', 'Opened', 'Collaborate');
  else if (id === 'slides') track('UI', 'Opened', 'SlideDeck');
  else if (id === 'card-types') track('Plan', 'Opened', 'CardTypes');
  else if (id === 'plan-trash') track('Plan', 'Opened', 'Trash');
  else if (id === 'plan-cards') track('Plan', 'Opened', 'CardFinder');
  else if (id === 'session-timer') track('UI', 'Opened', 'SessionTimer');
  else if (id === 'session-vote') track('UI', 'Opened', 'SessionVote');
  else if (id === 'session-poll') track('UI', 'Opened', 'SessionPoll');
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
