'use client';

import { useState } from 'react';
import { Button, Glyph, DialogCloseButton, DialogHeader } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useToast } from '@/hooks/ui/useToast';
import { syncFailureMessage } from '@/lib/offline/offline-convert';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { Spinner } from '@/components/palette/template-picker-icons';

// The Share dialog's offline gate (docs/specs/006-document/offline-mode.md "Sharing a Local only
// document"). An offline document is stored only in this browser, so there are no links to mint until it
// is synced. The gate says so and offers Sync Document; the sync converts the open document in place
// ("Syncing in place"), with no reload, and the Share dialog swaps the gate for its share options as the
// document stops being offline. Sync waits for `ready` (the reader is known).
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
  const toast = useToast();

  const sync = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onSyncToCloud();
      // The document is a cloud document now: the dialog shows the share options in place of this
      // gate. The spinner stays until it does, so the button never flashes back.
      toast.success('Synced. Your document is on livediagram now.');
    } catch (e) {
      setBusy(false);
      toast.error(syncFailureMessage(e));
    }
  };

  return (
    <Dialog open onClose={onClose} ariaLabel="Share this document" size="md">
      <DialogHeader title="Share this document" subtitle="Saved only in this browser.">
        <HelpArticleLink article="offlineMode" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>

      <div className="flex flex-col items-center gap-4 px-6 py-7 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
          <Glyph size={24} units={24}>
            <path d="M6 16.5h10a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.2-1.1A3.4 3.4 0 0 0 6 16.5Z" />
            <path d="M3.5 3.5l17 17" />
          </Glyph>
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            This Document Is Offline
          </p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            It is saved only in this browser, so there is nothing to share yet. Sync it to
            livediagram to share it: share links, real-time collaboration and the live image all
            need it on our servers. You can take it offline again any time.
          </p>
        </div>
        <Button
          onClick={() => void sync()}
          disabled={busy || !ready}
          aria-busy={busy}
          className="mt-1 shadow-sm"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner />
              Syncing…
            </span>
          ) : (
            'Sync Document'
          )}
        </Button>
      </div>

      <DialogFooter>
        <Button variant="secondary" size="xs" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
