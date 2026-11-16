'use client';

// Email to Board… in the tab menu (docs/specs/026-plan/email-to-board.md "Where it lives"), beside Publish as Roadmap.
// Drawn only with the door EmailIntakeHost sets for an Editor of the whole plan, on a tab holding a Plan board.
import { lucideGlyph } from '@liveplanner/ui';
import { lucideMail } from '@liveworkspace/icons/lucide';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useEmailIntakeDoor } from './EmailIntakeContext';

const MailIcon = lucideGlyph(lucideMail, 16);

export function EmailIntakeMenuRow({ onClose }: { onClose: () => void }) {
  const door = useEmailIntakeDoor();
  if (!door) return null;
  return (
    <MenuActionRow
      plain
      icon={<MailIcon />}
      label="Email to Board…"
      onClick={() => {
        onClose();
        door.open();
      }}
    />
  );
}
