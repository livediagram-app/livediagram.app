// A Plan card dragged on the canvas and released over a board's column (docs/specs/026-plan/plan-board.md
// "Working on a board"): the column, and the board holding it, are read from the board's own DOM under the
// pointer. Null for a press that did not travel, a dragged element that is not a Plan card, or a release over
// no column.
import type { Element } from '@livediagram/document';

// How far the pointer travels before a release counts as a drop rather than a click.
const PLAN_CARD_DROP_TRAVEL_PX = 4;

export type PlanCardCanvasDrop = { card: Element; status: string; boardId?: string };

export function planCardCanvasDropAt(
  elements: readonly Element[],
  draggedId: string,
  start: { x: number; y: number },
  clientX: number,
  clientY: number,
): PlanCardCanvasDrop | null {
  if (Math.hypot(clientX - start.x, clientY - start.y) <= PLAN_CARD_DROP_TRAVEL_PX) return null;
  const card = elements.find((el) => el.id === draggedId);
  if (card?.type !== 'shape' || card.shape !== 'plan-card') return null;
  const cell = document
    .elementsFromPoint(clientX, clientY)
    .find(
      (el): el is HTMLElement => el instanceof HTMLElement && el.dataset.planStatus !== undefined,
    );
  const status = cell?.dataset.planStatus;
  if (!status) return null;
  // The board too, so its card types and the status are checked before anything moves.
  const boardId = cell.closest<HTMLElement>('[data-plan-board]')?.dataset.planBoard;
  return { card, status, ...(boardId ? { boardId } : {}) };
}
