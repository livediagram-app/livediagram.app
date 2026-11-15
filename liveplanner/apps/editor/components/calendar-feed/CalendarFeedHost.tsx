'use client';

// Gives the editor its door to Subscribe to Calendar (CalendarFeedContext) and draws the dialog while it is open
// (docs/specs/026-plan/calendar-feed.md "Where it lives"). The dialog's code loads the first time it opens
// (docs/specs/016-platform/web-performance.md), so a plan whose person never opens it pays nothing for it.
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import { track } from '@/lib/telemetry';
import { CalendarFeedDoorContext, type CalendarFeedDoor } from './CalendarFeedContext';
import type { CalendarFeedScope } from './calendar-feed-gate';

const CalendarFeedDialog = dynamic(
  () => import('./CalendarFeedDialog').then((m) => m.CalendarFeedDialog),
  { ssr: false },
);

export function CalendarFeedHost({
  scope,
  children,
}: {
  // Null for anyone who may not have a feed (calendarFeedScopeFor).
  scope: CalendarFeedScope | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { ownerId, projectId } = scope ?? {};
  const stable = useMemo<CalendarFeedScope | null>(
    () => (ownerId && projectId ? { ownerId, projectId } : null),
    [ownerId, projectId],
  );
  const door = useMemo<CalendarFeedDoor | null>(
    () =>
      stable
        ? {
            open: () => {
              setOpen(true);
              track('UI', 'Opened', 'CalendarFeed');
            },
          }
        : null,
    [stable],
  );
  return (
    <CalendarFeedDoorContext.Provider value={door}>
      {children}
      {stable && open ? <CalendarFeedDialog scope={stable} onClose={() => setOpen(false)} /> : null}
    </CalendarFeedDoorContext.Provider>
  );
}
