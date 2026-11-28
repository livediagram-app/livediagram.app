import {
  TabMenu as SharedTabMenu,
  type TabMenuBindingProps,
  type TabMenuCopyToProps,
} from '@liveworkspace/workbench/components/chrome/TabMenu';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { lucideCalendarClock } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livehuddle/ui';
import { AddTabToDocumentDialog } from '@/components/dialogs/TabOrganiseDialogs';
import { useSplitViewContext } from '@/components/split/SplitViewContext';

// Attendance: a calendar with a clock, who was in the tab and when.
const AttendanceIcon = lucideGlyph(lucideCalendarClock, 16);

// The tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the workbench's one
// menu with this app's words, its Add to Another Space picker and its own row, Attendance (its Send
// Stickies to Plan went with the sticky notes: docs/specs/002-project-scope/not-in-livehuddle.md "The Write category").
// A space's tabs have no lock, so the toolbar spreads its buttons evenly, Delete last; a connected tab's name always
// follows its file, so its menu has no Rename.
export function TabMenu({
  selfId,
  otherDocuments,
  onCopyTo,
  onOpenAttendance,
  attendanceOnly = false,
  ...menu
}: Omit<TabMenuBindingProps, 'locked' | 'onToggleLock'> &
  TabMenuCopyToProps & {
    // A tab's Attendance (docs/specs/012-collaboration/tab-attendance.md "Where it shows"): absent for a session that
    // may not see it. `attendanceOnly` (a Participant, a tab-scoped link) makes it the menu's one row.
    onOpenAttendance?: (() => void) | undefined;
    attendanceOnly?: boolean;
  }) {
  const split = useSplitViewContext();
  const attendanceRow = onOpenAttendance ? (
    <MenuActionRow plain icon={<AttendanceIcon />} label="Attendance" onClick={onOpenAttendance} />
  ) : null;
  return (
    <SharedTabMenu
      {...menu}
      words={{ item: 'tab', holder: 'space' }}
      split={split}
      toolbar="spread"
      renameConnected={false}
      copyTo={{
        label: 'Add to Another Space',
        disabled: otherDocuments.length === 0,
        picker: (close) => (
          <AddTabToDocumentDialog
            ownerId={selfId}
            otherDocuments={otherDocuments}
            onPick={onCopyTo}
            onClose={close}
          />
        ),
      }}
      // A read-only session that may see Attendance gets that row alone: every other verb here changes the tab.
      only={attendanceOnly ? attendanceRow : undefined}
      ownGroup={attendanceRow}
      connectedRows={attendanceRow}
    />
  );
}
