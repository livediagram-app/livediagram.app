'use client';

import { useState, type ReactNode } from 'react';
import { Button, Glyph } from '@livedocuments/ui';
import { useToast } from '@/hooks/ui/useToast';
import { syncFailureMessage } from '@/lib/offline/offline-convert';
import { Spinner } from '@/components/palette/template-picker-icons';

// The offer to move a document in This Browser onto livedocuments (docs/specs/006-document/offline-mode.md "Sharing a
// document in This Browser"), drawn inside a dialog: the document Share dialog's gate and Share Form's. It says
// the document is offline and offers Sync Document; the sync converts the open document in place, and the dialog around it swaps this prompt for what it was
// opened for as the document stops being offline. Sync waits for `ready` (the reader is known).
export function SyncDocumentPrompt({
  onSyncToCloud,
  ready = true,
  message,
  onBusyChange,
}: {
  onSyncToCloud: () => Promise<void>;
  ready?: boolean;
  // Why this dialog needs the document on livedocuments.
  message: ReactNode;
  // Told while the sync runs, so the dialog can hold its own buttons.
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusyState] = useState(false);
  const toast = useToast();
  const setBusy = (next: boolean) => {
    setBusyState(next);
    onBusyChange?.(next);
  };

  const sync = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onSyncToCloud();
      // The document is a cloud document now: the dialog shows what it was opened for in place of this prompt.
      // The spinner stays until it does, so the button never flashes back.
      toast.success('Synced. Your document is on livedocuments now.');
    } catch (e) {
      setBusy(false);
      toast.error(syncFailureMessage(e));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-7 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30">
        <Glyph size={24} units={24}>
          <path d="M6 16.5h10a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.2-1.1A3.4 3.4 0 0 0 6 16.5Z" />
          <path d="M3.5 3.5l17 17" />
        </Glyph>
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          This Document Is in This Browser
        </p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {message}
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
  );
}
