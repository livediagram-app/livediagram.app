'use client';

// New Card (docs/specs/026-plan/items.md "New Card"): the Plan strip's + opens this panel above it, pointing at it,
// as the Trash and Find a Card do: a tile per card type. A pick makes a card of that type,
// off any board, in its type's starting status, and opens it to be named.
import { newItemId, typeIn } from '@livediagram/items';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { AddCardChoices } from './AddCardPopover';
import { usePlan } from './PlanContext';
import { newCardStatus } from './new-card-status';

export function NewCardPanel({
  popoverAnchor,
  onPopoverClose,
}: {
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  if (!plan?.canEdit) return null;
  return (
    <MovablePanel
      title="New Card"
      helpArticle="planCards"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-72"
      onMoveTo={() => {}}
      popoverOpen
      popoverAnchor={popoverAnchor}
      asPopover
      popoverWidth="w-72"
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="px-2 pb-2">
        <AddCardChoices
          types={plan.types}
          onAdd={({ type, fields }) => {
            const id = newItemId();
            plan.addItem({
              id,
              type,
              fields,
              status: newCardStatus(typeIn(plan.types, type), plan.statusNames),
              after: null,
            });
            onPopoverClose();
            plan.openNewItem(id);
          }}
        />
      </div>
    </MovablePanel>
  );
}
