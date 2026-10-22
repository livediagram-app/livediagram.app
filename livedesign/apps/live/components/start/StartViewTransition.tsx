'use client';

import { ViewTransition, type ReactNode } from 'react';

// The start panels' View Transition (docs/specs/007-editor/start-diagramming.md "Changing mode"): wrapped around
// every start the editor can show, so a mode change that swaps one start for another reads as the same panel
// turning in place. Only a `start-mode` transition (StartModeSwitch) animates it; every other transition leaves it be.
export const START_MODE_TRANSITION = 'start-mode';
const UPDATE = { [START_MODE_TRANSITION]: START_MODE_TRANSITION, default: 'none' };

export function StartViewTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition default="none" update={UPDATE}>
      {children}
    </ViewTransition>
  );
}
