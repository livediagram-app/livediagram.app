'use client';

// Gives the editor its door to Email to Board (EmailIntakeContext) and draws the dialog while it is open
// (docs/specs/026-plan/email-to-board.md "Where it lives"). The door is there only on a tab holding a Plan board. The
// dialog's code loads the first time it opens (docs/specs/016-platform/web-performance.md), so a plan whose people
// never open it pays nothing for it.
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import { track } from '@/lib/telemetry';
import { EmailIntakeDoorContext, type EmailIntakeDoor } from './EmailIntakeContext';
import type { EmailIntakeScope } from './email-intake-gate';

const EmailIntakeDialog = dynamic(
  () => import('./EmailIntakeDialog').then((m) => m.EmailIntakeDialog),
  { ssr: false },
);

export function EmailIntakeHost({
  scope,
  boardIds,
  children,
}: {
  // Null for anyone who may not manage an address (emailIntakeScopeFor).
  scope: EmailIntakeScope | null;
  // The Plan boards on the tab the menu is for, in its order.
  boardIds: readonly string[];
  children: ReactNode;
}) {
  // Taken when the dialog opens, so an edit on the canvas behind it does not move it to another board.
  const [openOn, setOpenOn] = useState<readonly string[] | null>(null);
  const { ownerId, projectId, shareCode } = scope ?? {};
  const stable = useMemo<EmailIntakeScope | null>(
    () => (ownerId && projectId ? { ownerId, projectId, shareCode: shareCode ?? null } : null),
    [ownerId, projectId, shareCode],
  );
  const key = boardIds.join('\n');
  const door = useMemo<EmailIntakeDoor | null>(
    () =>
      stable && key
        ? {
            open: () => {
              setOpenOn(key.split('\n'));
              track('UI', 'Opened', 'EmailIntake');
            },
          }
        : null,
    [stable, key],
  );
  return (
    <EmailIntakeDoorContext.Provider value={door}>
      {children}
      {stable && openOn ? (
        <EmailIntakeDialog scope={stable} boardIds={openOn} onClose={() => setOpenOn(null)} />
      ) : null}
    </EmailIntakeDoorContext.Provider>
  );
}
