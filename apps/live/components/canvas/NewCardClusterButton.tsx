'use client';

// New Card in Plan mode's bottom-right strip (docs/specs/026-plan/items.md "New Card"): a + between the Trash and
// Find a Card, for someone who may edit. It opens the New Card panel above it (NewCardPanel), pointing at it.
import { PlusIcon } from '@livediagram/ui';
import { ClusterPopoverSegment } from './ClusterPopoverButton';

export function NewCardSegment({
  divided,
  open,
  onToggle,
}: {
  divided: boolean;
  open: boolean;
  onToggle: (button: HTMLElement) => void;
}) {
  return (
    <ClusterPopoverSegment
      divided={divided}
      label="New Card"
      hoverTitle="New Card"
      hoverDescription="Make a card of any type here and now, then put it on a board when you are ready."
      icon={<PlusIcon size={18} />}
      popoverOpen={open}
      onTogglePopover={onToggle}
    />
  );
}
