'use client';

// Gives the editor its door to Email to Board (EmailIntakeContext) and draws the dialog while it is open
// (docs/specs/026-plan/email-to-board.md "Where it lives"). The door is there only on a tab holding a Plan board. The
// dialog's code loads the first time it opens (docs/specs/016-platform/web-performance.md), so a plan whose people
// never open it pays nothing for it.
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { requestToolsView } from '@liveworkspace/workbench/components/chrome/tools-door';
import { track } from '@/lib/telemetry';
import { EmailIntakeDoorContext, type EmailIntakeDoor } from './EmailIntakeContext';
import { EMAIL_INTAKE_PARAM, type EmailIntakeScope } from './email-intake-gate';
import {
  ToolGateDialog,
  toolGateBadges,
  useAskedOpen,
  type ToolGate,
} from '@/components/dialogs/tool-gate';

const EmailIntakeDialog = dynamic(
  () => import('./EmailIntakeDialog').then((m) => m.EmailIntakeDialog),
  { ssr: false },
);

export function EmailIntakeHost({
  scope,
  gate = null,
  boardIds,
  children,
}: {
  // Null for anyone who may not manage an address (emailIntakeScopeFor).
  scope: EmailIntakeScope | null;
  // Set for an Editor who must sign in or sync first (emailIntakeGateFor): the door opens that gate.
  gate?: ToolGate | null;
  // The Plan boards on the tab the menu is for, in its order.
  boardIds: readonly string[];
  children: ReactNode;
}) {
  // Taken when the dialog opens, so an edit on the canvas behind it does not move it to another board.
  // Back from a guest's sign-in, asked open: Tools opens at Email to Board on arrival (footer-tools-menu.md "From
  // elsewhere"), on the tab's boards, where the gate or the dialog draws.
  const asked = useAskedOpen(EMAIL_INTAKE_PARAM);
  useEffect(() => {
    if (asked) requestToolsView('email-intake');
  }, [asked]);
  const [openOn, setOpenOn] = useState<readonly string[] | null>(null);
  const { ownerId, projectId, shareCode } = scope ?? {};
  const stable = useMemo<EmailIntakeScope | null>(
    () => (ownerId && projectId ? { ownerId, projectId, shareCode: shareCode ?? null } : null),
    [ownerId, projectId, shareCode],
  );
  const key = boardIds.join('\n');
  const gateKind = gate?.kind ?? null;
  const door = useMemo<EmailIntakeDoor | null>(() => {
    if (!key) return null;
    const open = () => setOpenOn(key.split('\n'));
    if (stable)
      return {
        open: () => {
          open();
          track('UI', 'Opened', 'EmailIntake');
        },
      };
    if (!gateKind) return null;
    // Through the gate: once synced the scope arrives and the dialog opens in its place, on the boards taken here.
    return {
      badges: toolGateBadges(gate),
      open: () => {
        open();
        track('UI', 'Opened', gateKind === 'sync' ? 'EmailIntakeOffline' : 'EmailIntakeSignIn');
      },
    };
  }, [stable, key, gateKind, gate]);
  return (
    <EmailIntakeDoorContext.Provider value={door}>
      {children}
      {stable && openOn ? (
        <EmailIntakeDialog scope={stable} boardIds={openOn} onClose={() => setOpenOn(null)} />
      ) : null}
      {gate && !stable && openOn ? (
        <ToolGateDialog
          gate={gate}
          title="Email to Board"
          promptTitle="Mail Arrives at Our Servers"
          signInPromptTitle="An Address Belongs to an Account"
          syncCopy="A board's address takes mail on our servers and makes its cards even when nobody has the plan open, so the plan needs saving to your account."
          signInCopy="A board's address outlives this visit, so it belongs to an account and needs you signed in. You come back here with Email to Board open."
          param={EMAIL_INTAKE_PARAM}
          onClose={() => setOpenOn(null)}
        />
      ) : null}
    </EmailIntakeDoorContext.Provider>
  );
}
