'use client';

import { useState } from 'react';
import { TrashIcon } from '@livediagram/ui';
import { usePlan } from '@/components/plan/PlanContext';
import { CountBadge } from '@/components/plan/CountBadge';
import { ClusterPopoverButton } from './ClusterPopoverButton';

// The Trash in the bottom-right cluster, in Plan mode (docs/specs/025-plan/items.md "Trash"), left of
// Undo, with a count of the cards in it. While a card is dragged it opens out into a drop target ("Drop to
// Trash", dashed), and fills red with its lid tipped while the card is over it; a card let go there is
// trashed. Pressed, it opens the Trash. Motion stops with reduced motion; the colours still change.
export function TrashClusterButton(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  const plan = usePlan();
  const dragging = !!plan?.draggingItemId;
  const [over, setOver] = useState(false);
  // The drop ends the drag before the pointer leaves: the next drag starts plain.
  if (!dragging && over) setOver(false);
  let count = 0;
  for (const it of plan?.items.values() ?? []) if (it.fields['status'] === 'trash') count += 1;

  if (dragging) {
    return (
      <span
        data-plan-trash
        role="status"
        aria-live="polite"
        onPointerEnter={() => setOver(true)}
        onPointerLeave={() => setOver(false)}
        className={`pointer-events-auto flex h-12 items-center gap-2 rounded-xl border-2 px-4 text-[13px] font-semibold shadow-lg transition-all duration-200 ease-out animate-fade-in motion-reduce:transition-none ${
          over
            ? 'scale-105 border-rose-600 bg-rose-600 text-white shadow-rose-500/30 motion-reduce:scale-100'
            : 'border-dashed border-rose-400 bg-rose-50 text-rose-600 dark:border-rose-500/70 dark:bg-rose-950/60 dark:text-rose-300'
        }`}
      >
        <span
          aria-hidden
          className={`flex transition-transform duration-200 motion-reduce:transition-none ${
            over ? '-rotate-12 scale-110' : ''
          }`}
        >
          <TrashIcon size={18} />
        </span>
        {over ? 'Let go to trash it' : 'Drop to Trash'}
      </span>
    );
  }
  return (
    <span data-plan-trash className="pointer-events-auto relative">
      <ClusterPopoverButton
        label={
          count ? `Open the Trash, ${count} ${count === 1 ? 'card' : 'cards'}` : 'Open the Trash'
        }
        hoverTitle="Trash"
        hoverDescription="Drag a card here to put it out of the way; open it to restore cards or delete them for good."
        icon={<TrashIcon size={18} />}
        {...props}
      />
      {count > 0 ? (
        <span aria-hidden className="pointer-events-none absolute -right-1.5 -top-1.5">
          <CountBadge background="#e11d48" color="#ffffff">
            {count}
          </CountBadge>
        </span>
      ) : null}
    </span>
  );
}
