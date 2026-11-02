import { useEffect, useRef } from 'react';
import type { DockPanel } from '@/hooks/canvas/useDockPopovers';

// The results walkthrough lives in the Vote popover (docs/specs/012-collaboration/session-tools.md "The
// Session strip"). Whoever drives it needs Previous / Next on screen, so when a walkthrough starts
// for them (from the tab menu, or a vote element's menu, rather than the popover itself) the Vote
// popover opens over its button. Followers are left alone: nothing opens on its own for them.
// Returns the ref for the Vote button the popover anchors to.
export function useVoteReviewOpener(
  driving: boolean,
  {
    activeDockPanel,
    handleDockButtonClick,
  }: {
    activeDockPanel: DockPanel | null;
    handleDockButtonClick: (id: DockPanel, button: HTMLElement, above?: boolean) => void;
  },
) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasDriving = useRef(driving);
  useEffect(() => {
    const started = driving && !wasDriving.current;
    wasDriving.current = driving;
    if (!started || activeDockPanel === 'session-vote') return;
    const button = buttonRef.current;
    if (button) handleDockButtonClick('session-vote', button, true);
  }, [driving, activeDockPanel, handleDockButtonClick]);
  return buttonRef;
}
