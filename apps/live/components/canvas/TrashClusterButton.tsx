'use client';

import { TrashIcon } from '@livediagram/ui';
import { usePlan } from '@/components/plan/PlanContext';
import { ClusterPopoverButton } from './ClusterPopoverButton';

// The Trash in the bottom-right cluster, in Plan mode (docs/specs/025-plan/items.md "Trash"), left of
// Undo. While a card is dragged it grows (animated) to say it takes it; a card let go over it is
// trashed. Pressed, it opens the Trash. Its count shows how many cards are in it.
export function TrashClusterButton(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  const plan = usePlan();
  const dragging = !!plan?.draggingItemId;
  let count = 0;
  for (const it of plan?.items.values() ?? []) if (it.fields['status'] === 'trash') count += 1;
  return (
    <span
      data-plan-trash
      className={`pointer-events-auto relative transition-transform duration-200 ease-out motion-reduce:transition-none ${
        dragging ? 'scale-125 [&_button]:ring-2 [&_button]:ring-rose-400' : ''
      }`}
    >
      <ClusterPopoverButton
        label="Open the Trash"
        hoverTitle="Trash"
        hoverDescription="Drag a card here to put it out of the way; open it to restore cards or delete them for good."
        icon={<TrashIcon size={18} />}
        {...props}
      />
      {count > 0 ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white"
        >
          <span className="text-optical-centre">{count}</span>
        </span>
      ) : null}
    </span>
  );
}
