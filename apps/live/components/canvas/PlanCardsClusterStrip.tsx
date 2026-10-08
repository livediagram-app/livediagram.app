'use client';

import { PlanCardsIcon, SearchIcon } from '@livediagram/ui';
import { ClusterPopoverSegment, ClusterStrip } from './ClusterPopoverButton';
import { TrashDropTarget, TrashSegment, usePlanCardDragging } from './TrashClusterButton';

// Plan mode's buttons in the bottom-right cluster, one strip as Undo and Redo are, where Layers sits in the other
// modes: the **Trash** on its left (docs/specs/026-plan/items.md "Trash"; given only off a phone, to an editor),
// then **Find a Card** (items.md "Finding a card"), the search over every card in the document, then **Card
// Types** (docs/specs/026-plan/item-types.md "The Card Types panel"). Each opens its own panel above it. While a
// card is dragged the Trash steps out of the strip as a wide drop target beside it.
export function PlanCardsClusterStrip({
  finderOpen,
  onToggleFinder,
  typesOpen,
  onToggleTypes,
  typesButtonRef,
  trash,
}: {
  finderOpen: boolean;
  onToggleFinder: (button: HTMLElement) => void;
  typesOpen: boolean;
  onToggleTypes: (button: HTMLElement) => void;
  // The Card Types button, for a caller that opens its panel from elsewhere.
  typesButtonRef?: React.Ref<HTMLButtonElement>;
  // The Trash button: its panel's state and toggle. Absent, the strip has none.
  trash?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
}) {
  const dragging = usePlanCardDragging();
  return (
    <>
      {trash && dragging ? <TrashDropTarget /> : null}
      <ClusterStrip>
        {trash && !dragging ? (
          <TrashSegment popoverOpen={trash.open} onTogglePopover={trash.onToggle} />
        ) : null}
        <ClusterPopoverSegment
          divided={!!trash && !dragging}
          label="Find a Card"
          hoverTitle="Cards"
          hoverDescription="Every card in this document: search them, find the ones on no board, and open any of them."
          icon={<SearchIcon size={18} />}
          popoverOpen={finderOpen}
          onTogglePopover={onToggleFinder}
        />
        <ClusterPopoverSegment
          divided
          label="Open Card Types"
          hoverTitle="Card Types"
          hoverDescription="The kinds of card this document's boards hold, and the fields each one has."
          icon={<PlanCardsIcon size={18} />}
          dataTourId="card-types"
          popoverOpen={typesOpen}
          onTogglePopover={onToggleTypes}
          {...(typesButtonRef ? { buttonRef: typesButtonRef } : {})}
        />
      </ClusterStrip>
    </>
  );
}
