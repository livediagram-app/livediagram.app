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
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { markNear, runIsNear } from './useCardRunReveal';

// The most cards that glide in one change; past it the board snaps.
export const FLIP_CARDS_MAX = 40;
const FLIP_CLASS = 'plan-card-flip';

// A node's place within `root`, in layout units.
function placeWithin(node: HTMLElement, root: HTMLElement): { x: number; y: number } {
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

// The cards to measure. A busy board draws its cards in runs (components/plan/card-runs.ts), and the browser skips a run
// out of view: reading a place in one lays all its cards out again, so on a 2,000-card board one drop laid out the whole
// board. Only the runs within a view's length of the body's view are read; a card further off never glides, as none
// would see it. Each run read is asked to draw (useCardRunReveal): one that is still far has no cards yet, and its
// cards are learnt as they are built (the hook's `remember`).
export function cardsToMeasure(body: HTMLElement): HTMLElement[] {
  const runs = body.querySelectorAll<HTMLElement>('[data-plan-run]');
  if (runs.length === 0) return [...body.querySelectorAll<HTMLElement>('[data-plan-card]')];
  const view = body.getBoundingClientRect();
  const near: HTMLElement[] = [];
  for (const run of runs) if (runIsNear(run.getBoundingClientRect(), view)) near.push(run);
  const cards: HTMLElement[] = [];
  for (const run of near) {
    markNear(run);
    for (const card of run.querySelectorAll<HTMLElement>('[data-plan-card]')) cards.push(card);
  }
  return cards;
}

// `signature` changes when the cards' order or columns change; the board's body is `root`; `skipId` is the card
// being dragged; `hold` says a column is gliding (useColumnMoveFlip), its cards riding in their cells, so they are
// measured but not played. Returns `remember(run)`: a busy board's run whose cards were just built (PlanCardRun) has
// their places learnt, so a card drawn after the last change still glides on the next.
export function usePlanCardFlip(
  root: RefObject<HTMLElement | null>,
  signature: string,
  skipId: string | null,
  hold?: () => boolean,
): (run: HTMLElement) => void {
  const last = useRef(new Map<string, { x: number; y: number }>());
  const remember = (run: HTMLElement) => {
    const body = root.current;
    // A run near the view but off screen is skipped by the browser (content-visibility): each card place read in it
    // laid the run out again, so a board's near runs built after it was first drawn (a 2,000-card import, the cards
    // built as a transition) cost hundreds of layouts, 2 to 4 s, one time in two. None would see its cards glide.
    // A run skips its own contents, so it is asked of its first card.
    const cards = run.querySelectorAll<HTMLElement>('[data-plan-card]');
    if (!body || cards[0]?.checkVisibility?.({ contentVisibilityAuto: true }) === false) return;
    for (const card of cards) last.current.set(card.dataset.planCard!, placeWithin(card, body));
  };
  useLayoutEffect(() => {
    const body = root.current;
    if (!body) return;
    const cards = cardsToMeasure(body);
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
    if (
      before.size === 0 ||
      moves.length === 0 ||
      moves.length > FLIP_CARDS_MAX ||
      hold?.() === true ||
      prefersReducedMotion()
    )
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
  }, [root, signature, skipId, hold]);
  return remember;
}
