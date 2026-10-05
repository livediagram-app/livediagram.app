'use client';

import { SearchIcon } from '@livediagram/ui';
import { ClusterPopoverButton } from './ClusterPopoverButton';

// The Cards button in the bottom-right cluster, in Plan mode (docs/specs/025-plan/items.md "Finding a
// card"): beside Card Types, it opens the search over every card in the document.
export function CardFinderClusterButton(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  return (
    <ClusterPopoverButton
      label="Find a Card"
      hoverTitle="Cards"
      hoverDescription="Every card in this document: search them, find the ones on no board, and open any of them."
      icon={<SearchIcon size={18} />}
      {...props}
    />
  );
}
