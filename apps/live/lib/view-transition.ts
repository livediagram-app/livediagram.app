import { flushSync } from 'react-dom';
import { prefersReducedMotion } from './motion-preference';

// Runs a state change as a View Transition: the browser holds a picture of the page as it was and crossfades it into
// the page the change draws, so a whole surface swapping (a start panel changing mode) reads as one turning rather than
// a blink. The change is flushed inside the transition so the new state is what it captures. Where the browser has no
// View Transitions, or motion is reduced, the change simply runs.
export function withViewTransition(change: () => void): void {
  const doc = typeof document === 'undefined' ? null : document;
  if (!doc || typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    change();
    return;
  }
  doc.startViewTransition(() => flushSync(change));
}
