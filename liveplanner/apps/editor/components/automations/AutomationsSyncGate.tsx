'use client';

// The gate before the Automations screen (docs/specs/026-plan/automations.md "Who may do what"): rules, schedules and
// due-date reminders run on our servers for an Editor, even while nobody has the plan open. A plan in This Browser
// syncs first, through the same gate Share opens (SyncGateDialog) and its Sync Plan; a guest on a server plan signs in
// first, back to this plan with the screen open (`?automations=1`). Once synced, or signed in, the host swaps the gate
// for the screen, as Share goes on to sharing. Loads with its own chunk the first time.

import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { SyncGateDialog } from '@/components/dialogs/SyncGateDialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { AUTOMATIONS_PARAM } from './automations-gate';
import type { AutomationsGate } from './AutomationsHost';

export const OFFLINE_RULES_TITLE = 'Rules Run on Our Servers';
export const OFFLINE_RULES_COPY =
  'Rules, schedules and due-date reminders run even when nobody has this plan open, so they need it saved to your account.';
export const GUEST_RULES_COPY =
  'Rules act for an Editor of this plan, even when nobody has it open, so they need you signed in. You come back here with Automations open.';

/** Where a guest signs in: back to this very page (its share code and tab kept), the screen asked open. */
export function automationsSignInHref(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
): string {
  const search = new URLSearchParams(location.search);
  search.set(AUTOMATIONS_PARAM, '1');
  return authHrefWithReturn(
    '/sign-in/',
    `${location.pathname}?${search.toString()}${location.hash}`,
  );
}

export function AutomationsSyncGate({
  gate,
  onClose,
}: {
  gate: AutomationsGate;
  onClose: () => void;
}) {
  return (
    <SyncGateDialog
      title="Automations"
      subtitle={gate.kind === 'sync' ? 'Saved only in this browser.' : 'You are not signed in.'}
      help={<HelpArticleLink article="planAutomations" size="md" />}
      promptTitle={OFFLINE_RULES_TITLE}
      message={gate.kind === 'sync' ? OFFLINE_RULES_COPY : GUEST_RULES_COPY}
      onSyncToCloud={gate.kind === 'sync' ? gate.sync : async () => {}}
      ready={gate.kind === 'sync' ? gate.ready : true}
      signInHref={gate.kind === 'sign_in' ? automationsSignInHref(window.location) : undefined}
      onClose={onClose}
    />
  );
}
