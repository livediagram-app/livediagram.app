// A card from the palette lands only in a board's column (docs/specs/026-plan/plan-mode.md "The
// palette"): dragged or placed, it becomes a new item in the column and row under the pointer, never a
// card on the canvas. Over no board, or over a board that does not show the type, nothing is made and
// the reason is said.
import { pointInRect, type Element } from '@livediagram/document';
import { otherPlanBoardAt, planBoardTarget } from './plan-board-targets';
import { getPaletteDragPreview, subscribePaletteDragPreview } from '@/lib/palette-drag-preview';
import { dropSlotAt } from './usePlanCardDrag';

export type PlanCardDrop =
  | { outcome: 'added' }
  | { outcome: 'refused'; message: string }
  | { outcome: 'missed'; message: string };

export const PLAN_CARD_MISSED = 'Drop a card into a column on a board';

// A palette card released at a screen point.
export function dropPlanCardAt(type: string, clientX: number, clientY: number): PlanCardDrop {
  const hit = otherPlanBoardAt(clientX, clientY, '');
  const target = hit ? planBoardTarget(hit.id) : undefined;
  if (!hit || !target) return { outcome: 'missed', message: PLAN_CARD_MISSED };
  if (!target.acceptsType(type)) return { outcome: 'refused', message: target.refusal() };
  const slot = dropSlotAt(hit.el, clientX, clientY, '');
  if (!slot) return { outcome: 'missed', message: PLAN_CARD_MISSED };
  // A new card is made in whatever column it lands in, even one whose status its type leaves out: left-out statuses
  // only stop a card moving there (docs/specs/026-plan/item-types.md "An item type").
  target.addCard(type, slot);
  return { outcome: 'added' };
}

// A canvas point on the screen, through the board drawn there: the board's element gives its canvas
// box, its DOM its screen box. Null when no board on the tab holds the point.
export function boardClientPoint(
  elements: readonly Element[],
  canvasX: number,
  canvasY: number,
): { x: number; y: number } | null {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i]!;
    if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
    if (!pointInRect(el, { x: canvasX, y: canvasY })) continue;
    const node = document.querySelector<HTMLElement>(`[data-plan-board="${CSS.escape(el.id)}"]`);
    const rect = node?.getBoundingClientRect();
    if (!rect || el.width <= 0 || el.height <= 0) return null;
    return {
      x: rect.left + ((canvasX - el.x) * rect.width) / el.width,
      y: rect.top + ((canvasY - el.y) * rect.height) / el.height,
    };
  }
  return null;
}

// The gap a palette card opens in a column while it is dragged over a board (the same gap a card from
// another board opens), so the drop points show before the drop. A fixed height: the card is not made
// yet, so it has no size on screen to borrow.
export const PLAN_PALETTE_GAP_PX = 56;

let hovered: string | null = null;

function clearHover(): void {
  if (hovered) planBoardTarget(hovered)?.hover(null);
  hovered = null;
}

// The drag ends (dropped, cancelled, or the tile let go anywhere): the gap closes with it.
subscribePaletteDragPreview(() => {
  if (!getPaletteDragPreview()) clearHover();
});

// A palette drag over the canvas at a screen point: when it carries a card of a type a board under the
// point shows, that board opens the gap where the card would land. True while it does.
export function planCardDragOver(clientX: number, clientY: number): boolean {
  const preview = getPaletteDragPreview();
  if (preview?.kind !== 'plan-card') {
    clearHover();
    return false;
  }
  return planCardHoverAt(preview.planType ?? 'task', clientX, clientY);
}

// A card of `type` held over a screen point (dragged, or pressed and not yet placed): the board under
// the point opens the gap where it would land. True while it does.
export function planCardHoverAt(type: string, clientX: number, clientY: number): boolean {
  const hit = otherPlanBoardAt(clientX, clientY, '');
  const target = hit ? planBoardTarget(hit.id) : undefined;
  const slot = hit && target ? dropSlotAt(hit.el, clientX, clientY, '') : null;
  if (hovered && hovered !== hit?.id) clearHover();
  if (!hit || !target || !slot) {
    if (hit && target) target.hover(null);
    return false;
  }
  hovered = hit.id;
  // A type the board does not show: a red zone at the column's foot saying why, where nothing will land. (A
  // column whose status the type leaves out still takes a new card: only moves are refused.)
  const refused = !target.acceptsType(type) ? target.refusal() : null;
  if (refused) {
    target.hover({
      itemId: '',
      slot: { ...slot, beforeId: null },
      height: PLAN_PALETTE_GAP_PX,
      refused,
    });
    return false;
  }
  target.hover({ itemId: '', slot, height: PLAN_PALETTE_GAP_PX });
  return true;
}

// The drop (or the drag leaving the canvas) closes the gap at once.
export const endPlanCardDrag = clearHover;
