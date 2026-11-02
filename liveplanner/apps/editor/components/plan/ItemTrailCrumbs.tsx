'use client';

// The item panel's breadcrumb (docs/specs/026-plan/plan-board.md "Breadcrumb"): the shared back bar
// (docs/specs/004-interface-design/back-bar.md), a row of its own above the header. It names the card opened
// before this one from inside the panel and steps back to it, with this card's number as its chip. Draws nothing
// for a trail of one card.
import { itemTitle, type Item } from '@liveplanner/items';
import { BackBar } from '@liveplanner/ui';

export function ItemTrailCrumbs({
  trail,
  onBack,
}: {
  // The trail ending on the open card (liveTrail in item-trail.ts).
  trail: readonly Item[];
  onBack: (itemId: string) => void;
}) {
  const previous = trail.at(-2);
  const open = trail.at(-1);
  if (!previous || !open) return null;
  return (
    <nav aria-label="Card trail" className="min-w-0">
      <BackBar
        label={`#${previous.key} ${itemTitle(previous)}`}
        current={`#${open.key}`}
        onClick={() => onBack(previous.id)}
        gap="tight"
      />
    </nav>
  );
}
