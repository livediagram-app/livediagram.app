'use client';

// The ⋯ menu on a collapsed stack (docs/specs/013-workspace/timeline.md §2.9): one verb, Remove
// from Timeline, which takes every member of the run off the reader's
// feed at once. A day's "Diagrams Renamed · 12 events" is one thing to
// the reader, so it should be one click to be rid of.
//
// Same trigger and menu shape as a single card's one-verb menu, so the
// two can't drift; the card stops the trigger's click at the slot, which
// is what keeps opening the menu from expanding the run underneath it.

import { useCallback, useState } from 'react';
import { stackLabel, type TimelineStackSlotsFor } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { TimelineCardMenu } from './TimelineCardMenu';

export function useTimelineStackSlots({
  onDismiss,
}: {
  /** Take several cards off the reader's feed in one go. */
  onDismiss: (eventIds: string[]) => void;
}): TimelineStackSlotsFor {
  // Which stack's menu is open, by stack key. Held here so the card's
  // right-click can open the same menu as its trigger.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const openMenu = useCallback((key: string | null) => {
    if (key) track('Timeline', 'Opened', 'Menu');
    setMenuFor(key);
  }, []);

  return useCallback(
    (stack) => ({
      onContextMenu: (e) => {
        e.preventDefault();
        openMenu(stack.key);
      },
      menu: (
        <TimelineCardMenu
          subject={`${stackLabel(stack)} · ${stack.events.length} events`}
          open={menuFor === stack.key}
          onOpenChange={(open) => openMenu(open ? stack.key : null)}
          onRemove={() => {
            track('Timeline', 'Removed', 'Stack');
            onDismiss(stack.events.map((e) => e.id));
          }}
        />
      ),
    }),
    [menuFor, openMenu, onDismiss],
  );
}
