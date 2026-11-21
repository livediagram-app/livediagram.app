'use client';

// The gate before the Automations screen (docs/specs/026-plan/automations.md "Who may do what"): the platform's,
// drawn with the gate Share opens (SyncGateDialog), liveplanner's sign-in and its help article. A plan kept Offline
// syncs first; a guest on a server plan signs in first, back to this plan with the screen open (`?automations=1`).
// Loaded with its own chunk the first time (PlanAutomationsHost).

import {
  AutomationsSyncGate,
  automationsSignInHref as signInHref,
} from '@liveworkspace/automations-ui/AutomationsSyncGate';
import type { AutomationsGate } from '@liveworkspace/automations-ui/AutomationsHost';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { SyncGateDialog } from '@/components/dialogs/SyncGateDialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

const signIn = (returnTo: string) => authHrefWithReturn('/sign-in/', returnTo);

/** Where a guest signs in: back to this very page (its share code and tab kept), the screen asked open. */
export const automationsSignInHref = (location: Pick<Location, 'pathname' | 'search' | 'hash'>) =>
  signInHref(location, signIn);

export function PlanAutomationsGate({
  gate,
  onClose,
}: {
  gate: AutomationsGate;
  onClose: () => void;
}) {
  return (
    <AutomationsSyncGate
      gate={gate}
      onClose={onClose}
      item="Plan"
      help={<HelpArticleLink article="planAutomations" size="md" />}
      signIn={signIn}
      Dialog={SyncGateDialog}
    />
  );
}
