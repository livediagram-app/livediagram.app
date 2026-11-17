'use client';

// Email to Board in the footer's Tools menu, in Automate (docs/specs/026-plan/email-to-board.md "Where it lives";
// liveworkspace/docs/specs/004-index/footer-tools-menu.md): there only with the door EmailIntakeHost sets for an Editor
// of the whole plan, on a tab holding a Plan board.
import { lucideGlyph } from '@liveplanner/ui';
import { lucideMail } from '@liveworkspace/icons/lucide';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { useEmailIntakeDoor } from './EmailIntakeContext';

const MailIcon = lucideGlyph(lucideMail, 16);

export function useEmailIntakeToolsItem(): ChromeToolsItem | null {
  const door = useEmailIntakeDoor();
  if (!door) return null;
  return {
    id: 'email-intake',
    group: 'automate',
    label: 'Email to Board',
    description: 'Forwarded mail becomes cards on a board.',
    icon: <MailIcon />,
    // Its dialog opens inside Tools (footer-tools-menu.md "Opening a tool inside Tools").
    inPlace: true,
    ...(door.badges ? { badges: door.badges } : {}),
    onSelect: () => door.open(),
  };
}
