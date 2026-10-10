'use client';

// The Plan card element's body (docs/specs/026-plan/plan-board.md "The Plan card"): one item's card
// face at the element's size. A double-click or double-tap, in any mode, opens the item;
// a card whose item is not in this document's store says so and offers to go.
import type { ShapeElement } from '@livediagram/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { usePlan } from './PlanContext';
import { PlanCardFace } from './PlanCardFace';
import { planOwnColours, planPalette } from './plan-palette';
import { DEFAULT_CARD_FIELDS, itemAccessibleName } from '@livediagram/items';

export function PlanCardView({
  element,
  fontFamily,
}: {
  element: ShapeElement;
  fontFamily?: string;
}) {
  const plan = usePlan();
  // Its theme and style colours (docs/specs/026-plan/plan-board.md "Theme and style"): a lone card's
  // fill is its face.
  const themed = planPalette(useCanvasSurface(), planOwnColours(element));
  const palette = element.fillColor ? { ...themed, card: themed.surface } : themed;
  const itemId = element.planCard?.itemId ?? '';
  const item = plan?.items.get(itemId);
  // A card on the canvas opens on a double-click or double-tap only, in every mode, so a single press selects it
  // and a drag moves it (docs/specs/026-plan/plan-board.md "The Plan card"). Two presses counted, not `dblclick`,
  // which is unreliable on touch; a press that travelled is a move and counts for nothing.
  const press = usePressWithoutDrag(
    () => {
      if (item) plan?.openItem(item.id);
    },
    { requireDouble: true },
  );
  if (!item) {
    const loading = !plan || plan.status === 'loading' || !itemId;
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-[12px]"
        style={{ borderColor: palette.border, color: palette.muted, backgroundColor: palette.card }}
      >
        {loading ? (
          <span>Loading item…</span>
        ) : (
          <>
            <span>Item not found</span>
            {plan?.canEdit ? (
              <button
                type="button"
                className="rounded-md border px-2 py-0.5 font-medium enabled:cursor-pointer"
                style={{ borderColor: palette.border, color: palette.text }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  plan.removeCard(element.id);
                }}
              >
                Remove card
              </button>
            ) : null}
          </>
        )}
      </div>
    );
  }
  return (
    <div
      className="absolute inset-0"
      style={fontFamily ? { fontFamily } : undefined}
      role="button"
      tabIndex={-1}
      aria-label={itemAccessibleName(item, plan?.types)}
      {...press}
    >
      <PlanCardFace
        item={item}
        palette={palette}
        fields={DEFAULT_CARD_FIELDS}
        size={element.planCard?.size}
        presence={plan?.presence.get(item.id)}
      />
    </div>
  );
}
