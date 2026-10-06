'use client';

// The Plan card element's body (docs/specs/026-plan/plan-board.md "The Plan card"): one item's card
// face at the element's size. A click in Plan mode, or a double-click in any mode, opens the item;
// a card whose item is not in this document's store says so and offers to go.
import type { ShapeElement } from '@livediagram/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
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
  const open = () => plan?.openItem(item.id);
  return (
    <div
      className="absolute inset-0"
      style={fontFamily ? { fontFamily } : undefined}
      role="button"
      tabIndex={-1}
      aria-label={itemAccessibleName(item, plan?.types)}
      onClick={(e) => {
        if (!plan?.planInput) return;
        e.stopPropagation();
        open();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        open();
      }}
    >
      <PlanCardFace
        item={item}
        palette={palette}
        fields={DEFAULT_CARD_FIELDS}
        presence={plan?.presence.get(item.id)}
      />
    </div>
  );
}
