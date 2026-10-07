'use client';

// Cards move visibly (docs/specs/026-plan/plan-board.md "Cards move visibly"): when a board's cards change place, by
// this person's move or a collaborator's arriving, each card that moved glides from where it was to where it now
// sits, rather than jumping. FLIP: measure, put back, play.
//
// Positions are layout units relative to the board's body (offsetLeft/offsetTop summed up to it), so the canvas zoom
// and pan never read as a move, and the translate applies in the same units. A card that appears or goes is left
// alone (it fades in or out on its own terms); the card being dragged is skipped (it is under the pointer already);
// a reshuffle of more than FLIP_CARDS_MAX cards (a filter, a swimlane change) snaps, as gliding them all is noise,
// not news. Reduced motion snaps.
import { useLayoutEffect, useRef, type RefObject } from 'react';

// The most cards that glide in one change; past it the board snaps.
export const FLIP_CARDS_MAX = 40;
const FLIP_CLASS = 'plan-card-flip';

function motionReduced(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ||
    document.documentElement.classList.contains('reduce-motion')
  );
}

// A node's place within `root`, in layout units.
export function placeWithin(node: HTMLElement, root: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let at: HTMLElement | null = node;
  while (at && at !== root) {
    x += at.offsetLeft;
    y += at.offsetTop;
    const parent = at.offsetParent as HTMLElement | null;
    // Past the root without meeting it (it is not positioned): measure against its own place instead.
    if (!parent || !root.contains(parent)) {
      if (parent !== root) {
        x -= root.offsetLeft;
        y -= root.offsetTop;
      }
      break;
    }
    at = parent;
  }
  return { x, y };
}

// `signature` changes when the cards' order or columns change; the board's body is `root`; `skipId` is the card
// being dragged.
export function usePlanCardFlip(
  root: RefObject<HTMLElement | null>,
  signature: string,
  skipId: string | null,
): void {
  const last = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const body = root.current;
    if (!body) return;
    const cards = body.querySelectorAll<HTMLElement>('[data-plan-card]');
    const before = last.current;
    const after = new Map<string, { x: number; y: number }>();
    const moves: [HTMLElement, number, number][] = [];
    for (const node of cards) {
      const id = node.dataset.planCard!;
      const at = placeWithin(node, body);
      after.set(id, at);
      const was = before.get(id);
      if (!was || id === skipId) continue;
      const dx = was.x - at.x;
      const dy = was.y - at.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      moves.push([node, dx, dy]);
    }
    last.current = after;
    if (before.size === 0 || moves.length === 0 || moves.length > FLIP_CARDS_MAX || motionReduced())
      return;
    // Invert: each card back where it was, with no transition...
    for (const [node, dx, dy] of moves) {
      node.classList.remove(FLIP_CLASS);
      node.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    // ...take that as the starting frame (one layout read for them all)...
    void body.offsetHeight;
    // ...then play: each glides home, and drops the class once there.
    for (const [node] of moves) {
      node.classList.add(FLIP_CLASS);
      node.style.transform = '';
      node.addEventListener('transitionend', () => node.classList.remove(FLIP_CLASS), {
        once: true,
      });
    }
  }, [root, signature, skipId]);
}
