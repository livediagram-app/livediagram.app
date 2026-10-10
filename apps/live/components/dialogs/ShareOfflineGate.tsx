'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Button, Glyph, DialogCloseButton, DialogHeader } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useToast } from '@/hooks/ui/useToast';
import { syncFailureMessage } from '@/lib/offline/offline-convert';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { Spinner } from '@/components/palette/template-picker-icons';

// The Share dialog's offline gate (docs/specs/006-document/offline-mode.md). An offline document is stored only
// in this browser, so there are no links to mint until it's synced to the
// owner's account. Rather than hide the Share button, we keep it and explain
// the one-step conversion here: sync moves the document to the cloud, then the
// page reloads into the normal share flow, where Share opens again by itself.
//
// `atOnce` (a guest, "Sharing a guest's Local only document"): pressing Share was the ask, so the sync
// starts as the gate opens, once `ready` (the reader is known), and the gate shows its progress. A
// failure drops back to the gate's own button.
export function ShareOfflineGate({
  onSyncToCloud,
  atOnce = false,
  ready = true,
  onClose,
}: {
  onSyncToCloud: () => Promise<void>;
  atOnce?: boolean;
  ready?: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  // The one-click sync gave up: the gate's own button takes over.
  const [atOnceFailed, setAtOnceFailed] = useState(false);
  const atOnceStarted = useRef(false);

  const sync = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await onSyncToCloud();
      // onSyncToCloud reloads the page on success, so we normally never fall
      // through. If it resolves without navigating, drop the spinner.
      setBusy(false);
    } catch (e) {
      setBusy(false);
      toast.error(syncFailureMessage(e));
    }
  };

  // Once per gate, once the reader is known: a failure leaves the button, never a retry loop.
  const startAtOnce = useEffectEvent(() => {
    if (!atOnce || !ready || atOnceStarted.current) return;
    atOnceStarted.current = true;
    onSyncToCloud().catch((e: unknown) => {
      setAtOnceFailed(true);
      toast.error(syncFailureMessage(e));
    });
  });
  useEffect(() => {
    startAtOnce();
  }, [atOnce, ready]);

  // A guest's one-click share: the progress, not the question.
  const preparing = atOnce && !atOnceFailed;
  if (preparing) {
    return (
      <Dialog open onClose={onClose} ariaLabel="Getting a share link ready" size="md">
        <DialogHeader
          title="Getting a Share Link Ready"
          subtitle="Uploading this document so others can open it."
        >
          <HelpArticleLink article="offlineMode" size="md" />
        </DialogHeader>
        <p
          role="status"
          className="flex items-center justify-center gap-2 px-6 py-8 text-xs text-slate-500 dark:text-slate-400"
        >
          <span className="text-sky-600 dark:text-sky-400">
            <Spinner />
          </span>
          The Share options open as soon as it is uploaded.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} ariaLabel="Share this document" size="md">
      <DialogHeader
        title="Share this document"
        subtitle="This document is saved offline, in this browser only."
      >
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
            Sync it to your account to share
          </p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Share links, real-time collaboration, and the live image all need the document to live
            on our servers. Syncing uploads this document to your account and keeps working on it
            here. You can take it offline again any time.
          </p>
        </div>
        <Button onClick={() => void sync()} disabled={busy || !ready} className="mt-1 shadow-sm">
          {busy ? 'Syncing…' : 'Sync Document'}
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
