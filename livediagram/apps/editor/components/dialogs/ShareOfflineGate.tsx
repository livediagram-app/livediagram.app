'use client';

import { useState } from 'react';
import { Button, DialogCloseButton, DialogHeader } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { SyncDocumentPrompt } from './SyncDocumentPrompt';

// The Share dialog's offline gate (docs/specs/006-document/offline-mode.md "Sharing a document in
// This Browser"). An offline document is stored only in this browser, so there are no links to mint until it
// is synced. The gate says so and offers Sync Canvas (SyncDocumentPrompt); the
// sync converts the open document in place ("Syncing in place"), with no reload, and the Share dialog swaps the
// gate for its share options as the document stops being offline. Sync waits for `ready` (the reader is known).
export function ShareOfflineGate({
  onSyncToCloud,
  ready = true,
  onClose,
}: {
  onSyncToCloud: () => Promise<void>;
  ready?: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onClose={onClose} ariaLabel="Share This Canvas" size="md">
      <DialogHeader title="Share This Canvas" subtitle="Saved only in this browser.">
        <HelpArticleLink article="offlineMode" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>

      <SyncDocumentPrompt
        onSyncToCloud={onSyncToCloud}
        ready={ready}
        onBusyChange={setBusy}
        message="It is saved only in this browser, so there is nothing to share yet. Sync it to livediagram to share it: share links, real-time collaboration and the live image all need it on our servers. You can take it offline again any time."
      />

      <DialogFooter>
        <Button variant="secondary" size="xs" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
