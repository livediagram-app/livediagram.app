// The builder's question motion (docs/specs/030-forms/forms.md "Building a form"; forms.css): the FLIP options for the
// question list, the leave a deleted question plays before it goes, and the grow a question plays as it opens for
// editing or closes again. Reduced motion plays nothing.
import type { FlipListOptions } from '@/hooks/ui/useFlipList';
import { prefersReducedMotion } from '@/lib/motion-preference';

// The leave's length (forms.css .form-q-leave), and a little over it in case its end never fires (a hidden tab).
const LEAVE_MS = 160;

/** The question list's FLIP: each question measured against the column (its nearest `[data-flip-root]`), as questions
 *  in different sections have different offset parents; a new question grows in. */
export const QUESTION_FLIP: FlipListOptions = {
  moveClass: 'form-q-move',
  measure: (node) =>
    node.getBoundingClientRect().top -
    (node.closest('[data-flip-root]')?.getBoundingClientRect().top ?? 0),
  onEnter: (node) => {
    node.classList.remove('form-q-enter');
    void node.offsetWidth;
    node.classList.add('form-q-enter');
    node.addEventListener('animationend', () => node.classList.remove('form-q-enter'), {
      once: true,
    });
  },
};

/** Plays a question's leave, then `done` (at once under reduced motion, or with no node). */
export function leaveThen(node: HTMLElement | null, done: () => void): void {
  if (!node || prefersReducedMotion()) return done();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };
  node.classList.add('form-q-leave');
  node.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, LEAVE_MS + 80);
}

// The open and close's length and curve, as the question list's moves (forms.css .form-q-move). Safe range 150..250 ms.
export const OPEN_MS = 220;
const OPEN_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Grows (or shrinks) a question from the height it had to the height it has now, clipping while it does; answers the
 *  animation, or null when there is nothing to play (reduced motion, no change, no Web Animations). */
export function growBetween(node: HTMLElement, from: number): Animation | null {
  const to = node.offsetHeight;
  if (prefersReducedMotion() || Math.abs(to - from) < 1 || typeof node.animate !== 'function')
    return null;
  return node.animate(
    [
      { height: `${from}px`, overflow: 'hidden' },
      { height: `${to}px`, overflow: 'hidden' },
    ],
    { duration: OPEN_MS, easing: OPEN_EASING },
  );
}
