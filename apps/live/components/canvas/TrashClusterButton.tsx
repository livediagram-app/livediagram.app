'use client';

import { useEffect, useRef, useState } from 'react';
import { isTrashed } from '@livediagram/items';
import { CountBadge, TrashIcon } from '@livediagram/ui';
import { usePlan } from '@/components/plan/PlanContext';
import { ClusterPopoverSegment } from './ClusterPopoverButton';

// The Trash in Plan mode's bottom-right strip (docs/specs/026-plan/items.md "Trash"): its first, left-hand
// button, before Find a Card and Card Types, with a count of the cards in it. While a card is dragged it is
// replaced by a drop target beside the strip ("Drop to Trash", dashed), filling with the brand colour, its lid
// tipped, while the card is over it (never red: a trash looks like any other target); a card let go there is trashed. Pressed, it opens the Trash. Motion stops with reduced
// motion; the colours still change. Not on a phone (the strip there has no room for it).

// Whether a card is being dragged (the drop target shows in place of the button).
export function usePlanCardDragging(): boolean {
  return !!usePlan()?.draggingItemId;
}

export function TrashDropTarget() {
  const [over, setOver] = useState(false);
  const targetRef = useRef<HTMLSpanElement>(null);
  // Over it or not, from the pointer's place: a touch pointer stays captured by the card it pressed, so
  // the target never hears pointerenter or pointerleave. Captured moves still reach the window.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = targetRef.current?.getBoundingClientRect();
      setOver(
        !!r &&
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom,
      );
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <span
      ref={targetRef}
      data-plan-trash
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex h-12 items-center gap-2 rounded-xl border-2 px-4 text-[13px] font-semibold shadow-lg transition-all duration-200 ease-out animate-fade-in motion-reduce:transition-none ${
        over
          ? 'scale-105 border-brand-500 bg-brand-500 text-white shadow-brand-500/30 motion-reduce:scale-100 dark:border-brand-600 dark:bg-brand-600'
          : 'border-dashed border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
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

// The strip's Trash button, its count tucked into its corner (the strip clips anything outside it).
export function TrashSegment(props: {
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
}) {
  const plan = usePlan();
  let count = 0;
  for (const it of plan?.items.values() ?? []) if (isTrashed(it)) count += 1;
  return (
    <span data-plan-trash className="relative flex">
      <ClusterPopoverSegment
        label={
          count ? `Open the Trash, ${count} ${count === 1 ? 'card' : 'cards'}` : 'Open the Trash'
        }
        hoverTitle="Trash"
        hoverDescription="Drag a card here to put it out of the way; open it to restore cards or delete them for good."
        icon={<TrashIcon size={18} />}
        {...props}
      />
      {count > 0 ? (
        <span aria-hidden className="pointer-events-none absolute right-0.5 top-0.5">
          {/* Grey, not red: the Trash holds nothing urgent. */}
          <CountBadge size="sm" background="#64748b" color="#ffffff">
            {count}
          </CountBadge>
        </span>
      ) : null}
    </span>
  );
}
