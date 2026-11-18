'use client';

// The gate before the Automations screen (docs/specs/026-plan/automations.md "Who may do what"): rules, schedules and
// due-date reminders run on our servers for an Editor, even while nobody has the plan open. A plan in This Browser
// syncs first, through the same gate Share opens (SyncGateDialog) and its Sync Plan; a guest on a server plan signs in
// first, back to this plan with the screen open (`?automations=1`). Once synced, or signed in, the host swaps the gate
// for the screen, as Share goes on to sharing. Loads with its own chunk the first time.

import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { toolGateCopy } from '@liveworkspace/workbench/lib/tool-gate-copy';
import { SyncGateDialog } from '@/components/dialogs/SyncGateDialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { AUTOMATIONS_PARAM } from './automations-gate';
import type { AutomationsGate } from './AutomationsHost';

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
  const said = toolGateCopy(gate.kind, 'Automations', 'Plan');
  return (
    <SyncGateDialog
      title="Automations"
      help={<HelpArticleLink article="planAutomations" size="md" />}
      promptTitle={said.title}
      message={said.body}
      onSyncToCloud={gate.kind === 'sync' ? gate.sync : async () => {}}
      ready={gate.kind === 'sync' ? gate.ready : true}
      signInHref={gate.kind === 'sign_in' ? automationsSignInHref(window.location) : undefined}
      onClose={onClose}
    />
  );
}
