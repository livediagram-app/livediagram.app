'use client';

// The gate before the Automations screen (docs/specs/013-workspace/automations.md "Share roles"): the platform's,
// drawn with the workbench's gate dialog (SyncGateDialog) over this app's Sync prompt, its sign-in and its help
// article. A canvas kept Offline syncs first; a guest on a stored canvas signs in first, back to this canvas with the
// screen open (`?automations=1`). Loaded with its own chunk the first time (DocumentAutomationsHost).

import { AutomationsSyncGate } from '@liveworkspace/automations-ui/AutomationsSyncGate';
import type { AutomationsGate } from '@liveworkspace/automations-ui/AutomationsHost';
import type { SyncGateDialogProps } from '@liveworkspace/automations-ui/AutomationsSyncGate';
import { authHrefWithReturn } from '@liveworkspace/workbench/components/chrome/auth-routes';
import { SyncGateDialog } from '@liveworkspace/workbench/components/dialogs/SyncGateDialog';
import { SyncDocumentPrompt } from '@/components/dialogs/SyncDocumentPrompt';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

const signIn = (returnTo: string) => authHrefWithReturn('/sign-in/', returnTo);

// The shared gate dialog with this app's prompt: Sync Canvas, or Sign In for a guest.
function GateDialog(props: SyncGateDialogProps) {
  return <SyncGateDialog {...props} Prompt={SyncDocumentPrompt} />;
}

export function DocumentAutomationsGate({
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
      item="Canvas"
      help={<HelpArticleLink article="automations" size="md" />}
      signIn={signIn}
      Dialog={GateDialog}
    />
  );
}
