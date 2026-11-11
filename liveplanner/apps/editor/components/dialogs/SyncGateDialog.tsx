'use client';

import { useState, type ReactNode } from 'react';
import { Button, DialogCloseButton, DialogHeader } from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { SyncProjectPrompt } from './SyncProjectPrompt';

// A dialog a plan in This Browser opens before it can do what it was opened for (docs/specs/006-project/
// offline-mode.md "Sharing a project in This Browser"): its header, the Sync Plan prompt (SyncProjectPrompt) with the
// dialog's own reason, and Cancel, held while the sync runs. The sync converts the open plan in place, with no reload,
// and whoever opened the gate swaps it for the real dialog as the plan stops being offline. Share draws it
// (ShareOfflineGate), and so does Automations (docs/specs/026-plan/automations.md "Who may do what"), which also
// asks a guest on a server plan to sign in through it.
export function SyncGateDialog({
  title,
  subtitle = 'Saved only in this browser.',
  help,
  promptTitle,
  message,
  onSyncToCloud,
  ready = true,
  signInHref,
  onClose,
}: {
  title: string;
  subtitle?: string;
  // A help link beside the close.
  help?: ReactNode;
  promptTitle?: ReactNode;
  message: ReactNode;
  onSyncToCloud: () => Promise<void>;
  ready?: boolean;
  // A guest on a server plan signs in instead of syncing.
  signInHref?: string | undefined;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onClose={onClose} ariaLabel={title} size="md">
      <DialogHeader title={title} subtitle={subtitle}>
        {help}
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>

      <SyncProjectPrompt
        onSyncToCloud={onSyncToCloud}
        ready={ready}
        title={promptTitle}
        onBusyChange={setBusy}
        message={message}
        signInHref={signInHref}
      />

      <DialogFooter>
        <Button variant="secondary" size="xs" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
