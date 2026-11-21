'use client';

import { SyncGateDialog } from '@liveworkspace/workbench/components/dialogs/SyncGateDialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SyncDesignPrompt } from './SyncDesignPrompt';

// The Share dialog's offline gate (docs/specs/006-design/offline-mode.md "Sharing a design in
// Offline"). An offline design is stored only in this browser, so there are no links to mint until it
// is synced. The gate says so and offers Sync Design (SyncDesignPrompt, which Share Form draws too), in the
// workbench's gate dialog (SyncGateDialog, which Automations draws too); the sync converts the open design in place
// ("Syncing in place"), with no reload, and the Share dialog swaps the gate for its share options as the design stops
// being offline. Sync waits for `ready` (the reader is known).
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
      title="Share This Design"
      subtitle="Saved only in this browser."
      help={<HelpArticleLink article="offlineMode" size="md" />}
      message="It is saved only in this browser, so there is nothing to share yet. Sync it to livedesign to share it: share links, real-time collaboration and the live image all need it on our servers. You can take it offline again any time."
      onSyncToCloud={onSyncToCloud}
      ready={ready}
      onClose={onClose}
      Prompt={SyncDesignPrompt}
    />
  );
}
