'use client';

import { useState } from 'react';
import { Button } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';

// The Share dialog's offline gate (spec/76). An offline diagram is stored only
// in this browser, so there are no links to mint until it's synced to the
// owner's account. Rather than hide the Share button, we keep it and explain
// the one-step conversion here: sync moves the diagram to the cloud, then the
// page reloads into the normal share flow.
export function ShareOfflineGate({
  onSyncToCloud,
  onClose,
}: {
  onSyncToCloud: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const sync = async () => {
    setBusy(true);
    try {
      track('Diagram', 'Created', 'Cloud');
      await onSyncToCloud();
      // onSyncToCloud reloads the page on success, so we normally never fall
      // through. If it resolves without navigating, drop the spinner.
      setBusy(false);
    } catch {
      setBusy(false);
      toast.error('Could not sync this diagram. Check your connection and try again.');
    }
  };

  return (
    <Dialog open onClose={onClose} ariaLabel="Share this diagram" size="md">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-5 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Share this diagram
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            This diagram is saved offline, in this browser only.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <HelpArticleLink
            article="offlineMode"
            title="Offline Mode"
            description="What offline diagrams are and how to sync them."
          />
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 px-6 py-7 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 16.5h10a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.2-1.1A3.4 3.4 0 0 0 6 16.5Z" />
            <path d="M3.5 3.5l17 17" />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Sync it to your account to share
          </p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Share links, real-time collaboration, and the live image all need the diagram to live on
            our servers. Syncing uploads this diagram to your account and keeps working on it here.
            You can take it offline again any time.
          </p>
        </div>
        <Button onClick={() => void sync()} disabled={busy} className="mt-1 shadow-sm">
          {busy ? 'Syncing…' : 'Sync to Account'}
        </Button>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        <Button variant="secondary" size="xs" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
