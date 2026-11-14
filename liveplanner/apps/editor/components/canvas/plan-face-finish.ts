// What a Plan board hands the shared face finish pass (@liveworkspace/workbench/components/canvas/useFaceFinishPass,
// docs/specs/008-canvas/blueprints/finish.md "Faces in their finish"): its cards and columns as the owners that seed
// their parts' strokes, a busy board's off-screen cards left for when they scroll into view, and the pointer's own
// feedback as no change. Every liveplanner face takes with it: a face with no cards or columns is unchanged by it.
import type { FaceFinishBoard } from '@liveworkspace/workbench/components/canvas/useFaceFinishPass';
import { isBoardHoverWrite } from '@/components/plan/board-hover';

// What a part's stroke is seeded by (docs/specs/008-canvas/finish.md "Marker"): the card or column it sits in, so a
// part appearing or going elsewhere (a column's hover controls, a card dragged to another column) leaves every other
// part's ink as it was, and a re-take draws the same strokes instead of a fresh wobble on every card (which read as
// the borders flashing).
const OWNER = '[data-plan-card], [data-plan-column], [data-marker-key]';
function ownerOf(root: Element, el: Element): string {
  const owner = el.closest(OWNER);
  if (!owner || !root.contains(owner)) return '';
  const card = owner.getAttribute('data-plan-card');
  if (card) return `card:${card}`;
  const marked = owner.getAttribute('data-marker-key');
  if (marked) return `key:${marked}`;
  return `col:${owner.getAttribute('data-plan-column') ?? ''}|${owner.getAttribute('data-plan-lane') ?? ''}`;
}

// A busy board's card the browser is not drawing (content-visibility: auto, app/globals.css): reading it would lay it
// out after all, card by card (docs/specs/026-plan/plan-board.md "A busy board").
function offScreenCard(el: Element): boolean {
  if (!el.hasAttribute('data-plan-card')) return false;
  const inner = el.firstElementChild;
  return !!inner?.checkVisibility && !inner.checkVisibility({ contentVisibilityAuto: true });
}

/** The Plan board's hooks, handed to every liveplanner finish pass. */
export const PLAN_BOARD: FaceFinishBoard = {
  ownerOf,
  unseen: offScreenCard,
  ignore: isBoardHoverWrite,
};
