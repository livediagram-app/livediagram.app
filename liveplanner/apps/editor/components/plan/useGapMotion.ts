'use client';

// A held card's drop gap opens and closes rather than popping (docs/specs/026-plan/plan-board.md "Drag a card"):
// mounted, it grows from nothing to its height and fades up, so the cards below slide down; unmounted (the card moved
// on, or was dropped elsewhere), a bare spacer left in its place shrinks back to nothing, so they slide up again. The list's
// own row gap is folded in too, so nothing jumps by it. Opening and closing share one length and easing, with no
// overshoot, so as a gap moves within a cell the one closing and the one opening always add up to one gap's room: the
// cards beyond both stay still and the cell keeps its height (plan-board.md "A steady drag"). Web Animations, no React
// render; reduced motion shows and hides.
import { useLayoutEffect, type RefObject } from 'react';

// One length and one easing both ways: the closing gap's room and the opening one's are complements at every frame.
export const GAP_MOTION_MS = 180;
export const GAP_MOTION_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const EASE = GAP_MOTION_EASE;

function still(): boolean {
  return (
    typeof window.matchMedia !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// A list the gap opens into empty (or leaves empty) is hidden while empty, so it appearing or going would add or take
// the cell's own gap after it (between the list and the Add card row) in one step. While it holds only a gap, the
// list's bottom margin takes that gap back (from minus the gap to nothing as a gap opens, and back as it closes), so
// the list's room grows and shrinks with the gap and nothing below it jumps. One fold per list.
const listFolds = new WeakMap<HTMLElement, Animation>();
const GHOST_ATTR = 'data-gap-ghost';

// Whether the list holds nothing but drop gaps and closing spacers.
function holdsOnlyGaps(list: HTMLElement, gap?: HTMLElement): boolean {
  for (const child of list.children)
    if (child !== gap && !child.hasAttribute(GHOST_ATTR)) return false;
  return true;
}

// The cell's gap after the list, taken back while the list holds only a gap; none when nothing follows it.
function gapAfter(list: HTMLElement): number {
  const cell = list.parentElement;
  if (!cell || !list.nextElementSibling) return 0;
  return parseFloat(getComputedStyle(cell).rowGap) || 0;
}

function foldList(list: HTMLElement, from: number, to: number, keep: boolean): Animation {
  listFolds.get(list)?.cancel();
  const fold = list.animate([{ marginBottom: `${from}px` }, { marginBottom: `${to}px` }], {
    duration: GAP_MOTION_MS,
    easing: EASE,
    ...(keep ? { fill: 'forwards' as const } : {}),
  });
  listFolds.set(list, fold);
  return fold;
}

export function useGapMotion(ref: RefObject<HTMLElement | null>, height: number): void {
  // Opens once as it mounts; a height change while held (a group picked up) needs no animation.
  useLayoutEffect(() => {
    const gap = ref.current;
    if (!gap || still() || typeof gap.animate !== 'function') return;
    const parent = gap.parentElement;
    // Alone in its list, there is no row gap beside it to fold; the cell's gap after the list is folded instead.
    const lone = !!parent && holdsOnlyGaps(parent, gap);
    const rowGap = parent && !lone ? parseFloat(getComputedStyle(parent).rowGap) || 0 : 0;
    gap.animate(
      [
        // Its borders open with it: a 2 px dashed border would otherwise hold it 4 px tall at its start, a step.
        {
          height: '0px',
          borderTopWidth: '0px',
          borderBottomWidth: '0px',
          marginBottom: `${-rowGap}px`,
          opacity: 0,
          transform: 'scaleX(0.92)',
        },
        {
          height: `${height}px`,
          borderTopWidth: '2px',
          borderBottomWidth: '2px',
          marginBottom: '0px',
          opacity: 1,
          transform: 'none',
        },
      ],
      { duration: GAP_MOTION_MS, easing: EASE },
    );
    if (parent && lone) {
      // From where a closing fold has got to, or from the whole gap taken back.
      const running = listFolds.get(parent)?.playState === 'running';
      const now = running
        ? parseFloat(getComputedStyle(parent).marginBottom) || 0
        : -gapAfter(parent);
      foldList(parent, now, 0, false);
    }
    return () => {
      // Leaving: a copy stays where it was and closes, then goes. It is not React's, so React never touches it.
      if (!parent || !gap.isConnected) return;
      const next = gap.nextSibling;
      // Once React has finished this commit: only a gap really gone leaves a spacer. One still in place was an effect
      // run again over the same gap (development's Strict Mode), and a spacer then would be a whole gap's room
      // opening and closing beside it, a jump each time a gap shows. Before the next paint either way.
      queueMicrotask(() => {
        if (gap.isConnected) return;
        close(parent, next && next.parentNode === parent ? next : null);
      });
    };
    function close(parent: HTMLElement, before: Node | null) {
      // Only its room, never a second dashed gap: a bare spacer of its height.
      const ghost = document.createElement('div');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute(GHOST_ATTR, '');
      ghost.style.pointerEvents = 'none';
      ghost.style.flexShrink = '0';
      parent.insertBefore(ghost, before);
      const shut = ghost.animate(
        [
          { height: `${height}px`, marginBottom: '0px', opacity: 1 },
          { height: '0px', marginBottom: `${-rowGap}px`, opacity: 0 },
        ],
        { duration: GAP_MOTION_MS, easing: EASE, fill: 'forwards' },
      );
      // Left holding only the closing spacer (React has finished: a dropped card would be in it by now), the list
      // folds its gap after it away with it, so its going takes nothing in one step.
      const fold = holdsOnlyGaps(parent) ? foldList(parent, 0, -gapAfter(parent), true) : null;
      const drop = () => {
        ghost.remove();
        // Hidden now it is empty; a card that came meanwhile gets its margin back.
        if (fold && listFolds.get(parent) === fold) {
          fold.cancel();
          listFolds.delete(parent);
        }
      };
      shut.finished.then(drop, drop);
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);
}
