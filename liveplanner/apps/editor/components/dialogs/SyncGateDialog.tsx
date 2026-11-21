'use client';

import {
  SyncGateDialog as SharedSyncGateDialog,
  type SyncGateDialogProps,
} from '@liveworkspace/workbench/components/dialogs/SyncGateDialog';
import { SyncProjectPrompt } from './SyncProjectPrompt';

// A dialog a plan kept Offline opens before it can do what it was opened for (docs/specs/006-project/
// offline-mode.md "Sharing a project kept Offline"): the shared gate with the Sync Plan prompt. Share draws it
// (ShareOfflineGate), and so does Automations (docs/specs/026-plan/automations.md "Who may do what"), which also
// asks a guest on a server plan to sign in through it.
export function SyncGateDialog(props: SyncGateDialogProps) {
  return <SharedSyncGateDialog {...props} Prompt={SyncProjectPrompt} />;
}
