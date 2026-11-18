'use client';

// The item panel's breadcrumb (docs/specs/026-plan/plan-board.md "Breadcrumb"): the shared back bar
// (docs/specs/004-interface-design/back-bar.md), a row of its own above the header. It names the card opened
// before this one from inside the panel and steps back to it, with this card's number as its chip. Draws nothing
// for a trail of one card.
import { itemTitle, type Item, type ItemTypeDef } from '@liveplanner/items';
import { BackBar } from '@liveplanner/ui';
import { cardRefIn } from './card-ref';

export function ItemTrailCrumbs({
  trail,
  types,
  onBack,
}: {
  // The trail ending on the open card (liveTrail in item-trail.ts).
  trail: readonly Item[];
  // The plan's card types, for each card's prefix (item-types.md "Card number prefixes").
  types: readonly ItemTypeDef[] | undefined;
  onBack: (itemId: string) => void;
}) {
  const refOf = cardRefIn(types);
  const previous = trail.at(-2);
  const open = trail.at(-1);
  if (!previous || !open) return null;
  return (
    <nav aria-label="Card trail" className="min-w-0">
      <BackBar
        label={`${refOf(previous)} ${itemTitle(previous)}`}
        current={refOf(open)}
        onClick={() => onBack(previous.id)}
        gap="tight"
      />
    </nav>
  );
}
