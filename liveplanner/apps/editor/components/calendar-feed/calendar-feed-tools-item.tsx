'use client';

// Subscribe to Calendar in the footer's Tools menu, in Collaborate (docs/specs/026-plan/calendar-feed.md "Where it
// lives"; liveworkspace/docs/specs/004-index/footer-tools-menu.md): there only with the door CalendarFeedHost sets for
// someone who may have a feed; it names the whole plan, whichever tab is open.
import { lucideGlyph } from '@liveplanner/ui';
import { lucideCalendarClock } from '@liveworkspace/icons/lucide';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { useCalendarFeedDoor } from './CalendarFeedContext';

const CalendarFeedIcon = lucideGlyph(lucideCalendarClock, 16);

export function useCalendarFeedToolsItem(): ChromeToolsItem | null {
  const door = useCalendarFeedDoor();
  if (!door) return null;
  return {
    id: 'calendar-feed',
    group: 'collaborate',
    label: 'Subscribe to Calendar',
    description: 'The plan’s dates in your own calendar.',
    icon: <CalendarFeedIcon />,
    ...(door.badges ? { badges: door.badges } : {}),
    onSelect: () => door.open(),
  };
}
