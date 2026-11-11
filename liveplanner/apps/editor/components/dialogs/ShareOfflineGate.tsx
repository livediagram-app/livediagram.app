'use client';

import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SyncGateDialog } from './SyncGateDialog';

// The Share dialog's offline gate (docs/specs/006-project/offline-mode.md "Sharing a project in
// This Browser"). An offline project is stored only in this browser, so there are no links to mint until it
// is synced. The gate says so and offers Sync Plan (SyncGateDialog, which Automations draws too); the
// sync converts the open project in place ("Syncing in place"), with no reload, and the Share dialog swaps the
// gate for its share options as the project stops being offline. Sync waits for `ready` (the reader is known).
export function ShareOfflineGate({
  onSyncToCloud,
  ready = true,
  onClose,
}: {
  onSyncToCloud: () => Promise<void>;
  ready?: boolean;
  onClose: () => void;
}) {
  return (
    <SyncGateDialog
      title="Share This Plan"
      help={<HelpArticleLink article="offlineMode" size="md" />}
      message="It is saved only in this browser, so there is nothing to share yet. Sync it to liveplanner to share it: share links, real-time collaboration and the live image all need it on our servers. You can take it offline again any time."
      onSyncToCloud={onSyncToCloud}
      ready={ready}
      onClose={onClose}
    />
  );
}
