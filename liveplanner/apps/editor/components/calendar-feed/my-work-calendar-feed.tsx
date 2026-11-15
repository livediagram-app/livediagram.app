'use client';

// Subscribe to Calendar on My Work (docs/specs/026-plan/calendar-feed.md "The My Work feed", "Where it lives"): the
// Inbox header's calendar door in the editor's Explorer panel (@liveworkspace/explorer InboxHost.headerActions), and
// the dialog it opens on the person's My Work feed. Offered only to someone signed in with an account; the dialog's
// code loads the first time it opens, so a person who never opens it pays nothing for it.
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import type { InboxHeaderAction } from '@liveworkspace/explorer';
import { lucideCalendar } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';
import { track } from '@/lib/telemetry';
import type { CalendarFeedTarget } from './CalendarFeedDialog';

const CalendarFeedDialog = dynamic(
  () => import('./CalendarFeedDialog').then((m) => m.CalendarFeedDialog),
  { ssr: false },
);

const CalendarIcon = lucideGlyph(lucideCalendar, 16);

export const MY_WORK_CALENDAR_ACTION = 'calendar-feed';

/** The Inbox header's door (none without an account) and the dialog to draw while it is open. */
export function useMyWorkCalendarFeed(accountUserId: string | null): {
  headerActions: readonly InboxHeaderAction[] | undefined;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const target = useMemo<CalendarFeedTarget | null>(
    () => (accountUserId ? { kind: 'my-work', ownerId: accountUserId } : null),
    [accountUserId],
  );
  const headerActions = useMemo<readonly InboxHeaderAction[] | undefined>(
    () =>
      target
        ? [
            {
              id: MY_WORK_CALENDAR_ACTION,
              label: 'Subscribe to Calendar',
              icon: <CalendarIcon />,
              onClick: () => {
                setOpen(true);
                track('UI', 'Opened', 'MyWorkCalendarFeed');
              },
            },
          ]
        : undefined,
    [target],
  );
  const dialog =
    target && open ? <CalendarFeedDialog target={target} onClose={() => setOpen(false)} /> : null;
  return { headerActions, dialog };
}
