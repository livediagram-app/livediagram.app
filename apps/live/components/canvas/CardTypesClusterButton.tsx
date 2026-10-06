'use client';

import { PlanCardsIcon } from '@livediagram/ui';
import { ClusterPopoverButton } from './ClusterPopoverButton';

// The Card Types button in the bottom-right cluster, in Plan mode (docs/specs/026-plan/item-types.md
// "The Card Types panel"): where Layers sits in the other modes.
export function CardTypesClusterButton(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <ClusterPopoverButton
      label="Open Card Types"
      hoverTitle="Card Types"
      hoverDescription="The kinds of card this document's boards hold, and the fields each one has."
      icon={<PlanCardsIcon size={18} />}
      dataTourId="card-types"
      {...props}
    />
  );
}
