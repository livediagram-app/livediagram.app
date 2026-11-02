'use client';

// Maximise and Minimise Card, animated (docs/specs/026-plan/plan-board.md "Maximised"): the size the panel shows is
// its own state, changed in a View Transition typed PANEL_RESIZE_TRANSITION, so the Dialog morphs between the two
// sizes. The stored preference is written at once (an external store, which React never renders as a transition), and
// the panel follows it on its own only when it changes from elsewhere (another tab). Reduced motion changes it at
// once (startTypedTransition).
import { useState } from 'react';
import { startTypedTransition } from '@liveworkspace/workbench/lib/view-transition';
import { PANEL_RESIZE_TRANSITION } from './item-panel-size';

export function useAnimatedMaximise(
  stored: boolean,
  save: ((on: boolean) => void) | undefined,
): [boolean, ((on: boolean) => void) | undefined] {
  const [shown, setShown] = useState(stored);
  // The stored value last seen, and the one this panel last asked for.
  const [seen, setSeen] = useState(stored);
  const [asked, setAsked] = useState<boolean | null>(null);
  if (stored !== seen) {
    setSeen(stored);
    if (stored !== asked) setShown(stored);
  }
  const toggle = save
    ? (on: boolean) => {
        setAsked(on);
        startTypedTransition(PANEL_RESIZE_TRANSITION, () => setShown(on));
        save(on);
      }
    : undefined;
  return [shown, toggle];
}
