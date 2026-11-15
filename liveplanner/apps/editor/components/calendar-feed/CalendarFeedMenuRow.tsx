'use client';

// Subscribe to Calendar… in the tab menu (docs/specs/026-plan/calendar-feed.md "Where it lives"), under Export:
// getting the plan's dates out beside getting its tab out. Drawn only with the door CalendarFeedHost sets for someone
// who may have a feed; it names the whole plan, whichever tab the menu opened on.
import { lucideGlyph } from '@liveplanner/ui';
import { lucideCalendarClock } from '@liveworkspace/icons/lucide';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useCalendarFeedDoor } from './CalendarFeedContext';

const CalendarFeedIcon = lucideGlyph(lucideCalendarClock, 16);

export function CalendarFeedMenuRow({ onClose }: { onClose: () => void }) {
  const door = useCalendarFeedDoor();
  if (!door) return null;
  return (
    <MenuActionRow
      plain
      icon={<CalendarFeedIcon />}
      label="Subscribe to Calendar…"
      onClick={() => {
        onClose();
        door.open();
      }}
    />
  );
}
