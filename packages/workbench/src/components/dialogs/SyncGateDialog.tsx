'use client';

import { useState, type ComponentType, type ReactNode } from 'react';
import { Button, DialogCloseButton, DialogHeader, holdDialogSlot } from '@liveworkspace/ui';
import { Dialog } from './Dialog';
import { DialogFooter } from './DialogFooter';

/** What the app's Sync prompt takes (SyncDocumentPrompt, SyncProjectPrompt): the sync, whether it may start, its
 *  own words, and Sign In in its place for a guest on an item stored on our servers. */
export type SyncPromptProps = {
  onSyncToCloud: () => Promise<void>;
  ready: boolean;
  title?: ReactNode;
  message: ReactNode;
  onBusyChange: (busy: boolean) => void;
  signInHref?: string | undefined;
};

/** The dialog's own props, without the app's prompt: the shape a tool's gate hands it (AutomationsSyncGate). */
export type SyncGateDialogProps = {
  title: string;
  // A line under the title (Share's "Saved only in this browser."); a tool's gate has none, its prompt says it.
  subtitle?: string;
  // A help link beside the close.
  help?: ReactNode;
  promptTitle?: ReactNode;
  message: ReactNode;
  onSyncToCloud: () => Promise<void>;
  ready?: boolean;
  // A guest on an item stored on our servers signs in instead of syncing.
  signInHref?: string | undefined;
  onClose: () => void;
};

// A dialog an item kept Offline opens before a tool can work (each app's offline-mode.md "Sharing a document kept
// Offline"; liveworkspace/docs/specs/018-automations/automations.md "Who may do what"): its header, the app's Sync
// prompt (`Prompt`) with the tool's own reason, or Sign In for a guest, and Cancel. While the sync runs nothing closes
// it: Cancel is held, and the close, Escape, the backdrop and a phone sheet's swipe do nothing, as Cancel. The
// sync converts the open item in place, with no reload, and whoever opened the gate swaps it for the tool as the
// item stops being offline. One copy for every editor: each hands in its own prompt, whose words and toasts are
// its own.
export function SyncGateDialog({
  title,
  subtitle,
  help,
  promptTitle,
  message,
  onSyncToCloud,
  ready = true,
  signInHref,
  onClose,
  Prompt,
}: SyncGateDialogProps & { Prompt: ComponentType<SyncPromptProps> }) {
  const [busy, setBusy] = useState(false);
  // Every way out is held while the sync runs, as Cancel is: `beforeClose` holds the close, the backdrop and a
  // phone sheet's swipe (each dismisses through it), `closeOnEscape` the key.
  return (
    <Dialog
      open
      onClose={onClose}
      beforeClose={() => !busy}
      closeOnEscape={!busy}
      ariaLabel={title}
      size="md"
      phoneSheet
    >
      <DialogHeader title={title} subtitle={subtitle}>
        {help}
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>

      <Prompt
        // Opened inside Tools, the tool it goes on to opens in the gate's place there (holdDialogSlot).
        onSyncToCloud={async () => {
          const undo = holdDialogSlot();
          try {
            await onSyncToCloud();
          } catch (error) {
            undo();
            throw error;
          }
        }}
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
