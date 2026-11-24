'use client';

// Make Plan Cards on a selection's toolbar (docs/specs/013-workspace/make-plan-cards.md "Where"): beside Send to Plan,
// when the selection holds two or more shapes or stickies with words and this session may send.
import type { Element } from '@livediagram/document';
import { HoverCard, lucideGlyph } from '@livediagram/ui';
import { lucideWorkflow } from '@liveworkspace/icons/lucide';
import { canMakePlanCards, openMakePlanCards } from '@/lib/plan-cards/make-entry';
import { countPlanShapes } from '@/lib/plan-cards/read-shapes';

export const MakePlanCardsIcon = lucideGlyph(lucideWorkflow, 16);

export function MakePlanCardsButton({
  elements,
  className,
}: {
  elements: readonly Element[];
  className: string;
}) {
  if (!canMakePlanCards() || countPlanShapes(elements, 2) < 2) return null;
  return (
    <HoverCard
      title="Make Plan Cards"
      description="Turn these shapes into plan cards, arrows into Blocked By."
    >
      <button
        type="button"
        onClick={() => openMakePlanCards({ only: elements.map((e) => e.id) })}
        aria-label="Make plan cards from the selection"
        data-make-plan-cards=""
        className={className}
      >
        <MakePlanCardsIcon size={14} />
      </button>
    </HoverCard>
  );
}
