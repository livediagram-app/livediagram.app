import { addTransitionType, startTransition } from 'react';
import { prefersReducedMotion } from './motion-preference';

// A state change animated as a React View Transition (docs/specs/003-system-architecture/react-state-and-effects.md
// "Animating a state change"): the change runs in a transition named by `type`, and the <ViewTransition> around
// the surface that changes picks its animation by that type. Under reduced motion (the OS setting or the in-app
// preference) the change runs plainly, so no View Transition starts and nothing is captured.
export function startTypedTransition(type: string, change: () => void): void {
  if (prefersReducedMotion()) {
    change();
    return;
  }
  startTransition(() => {
    addTransitionType(type);
    change();
  });
}
