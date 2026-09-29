'use client';

// The account menu's Google Drive panel (docs/specs/022-drive-mirror/drive-mirror.md,
// "Connecting"; blueprint "Presentation and UX"): the connection state,
// **Connect Google Drive**, and once connected **Sync now**, **Last synced**
// and **Disconnect**, the first mirror's progress, and any notice about a
// folder livediagram cannot see.

import { useState } from 'react';
import { Button } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { DialogHeader } from '@/components/dialogs/DialogHeader';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { useDriveMirror } from './drive-mirror-context';
import { DRIVE_NOTICE_TEXT } from './DriveNoticeMarker';

const TITLE_ID = 'drive-dialog-title';

// "Just now" under a minute, then the shared relative wording (D11).
export function lastSyncedLabel(at: number | null, now: number): string {
  if (at === null) return 'Not yet';
  if (now - at < 60_000) return 'Just now';
  return relativeSince(at, now);
}

// The one line under the title that says where things stand.
export function driveStatusLine(status: DriveMirrorStatus): string {
  switch (status.state) {
    case 'starting':
      return 'Checking your Google Drive connection…';
    case 'disconnected':
      return 'Keep a copy of your Personal Space in your own Google Drive, updated while livediagram is open.';
    case 'needs_reconnect':
      return "Google Drive stopped accepting livediagram's access. Nothing was deleted.";
    case 'needs_resume':
      return 'Drive access has lapsed. Resume to carry on syncing.';
    default:
      if (status.error === 'rate_limited') {
        return 'Google asked livediagram to slow down. Syncing continues less often for a while.';
      }
      if (status.error === 'offline' || status.error === 'failed') {
        return "Couldn't reach Google Drive. livediagram tries again when you come back.";
      }
      if (status.leaseHeldElsewhere) {
        return 'Another device is writing to Drive right now; this one keeps reading changes.';
      }
      return 'Mirroring to the livediagram folder in your Google Drive.';
  }
}

export function DriveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drive = useDriveMirror();
  const { status } = drive;
  const [busy, setBusy] = useState(false);
  const run = (action: () => Promise<void> | void) => async () => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  const connected = status.state === 'idle' || status.state === 'syncing';
  const now = useRelativeNow();

  return (
    <Dialog open={open} onClose={onClose} titleId={TITLE_ID} size="md">
      <DialogHeader title={<span id={TITLE_ID}>Google Drive</span>}>
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="space-y-4 px-6 py-5 text-sm text-slate-700 dark:text-slate-300">
        <p aria-live="polite">{driveStatusLine(status)}</p>

        {status.progress ? (
          <div className="space-y-1.5">
            <p>
              Copying your diagrams to Drive: {status.progress.done} of {status.progress.total}
            </p>
            <div
              role="progressbar"
              aria-label="Copying your diagrams to Drive"
              aria-valuemin={0}
              aria-valuemax={status.progress.total}
              aria-valuenow={status.progress.done}
              className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] motion-reduce:transition-none"
                style={{
                  width: `${(100 * status.progress.done) / Math.max(1, status.progress.total)}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {connected ? (
          <p className="text-slate-500 dark:text-slate-400">
            Last synced:{' '}
            <span className="text-slate-700 dark:text-slate-200">
              {lastSyncedLabel(status.lastSyncedAt, now)}
            </span>
          </p>
        ) : null}

        {status.notices.length > 0 ? (
          <ul className="space-y-2">
            {status.notices.map((notice) => (
              <li
                key={`${notice.kind}:${notice.ldId}`}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/40"
              >
                <p>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {notice.name}
                  </span>
                  : {DRIVE_NOTICE_TEXT}
                </p>
                {drive.canAdopt ? (
                  <Button
                    variant="secondary"
                    size="xs"
                    className="mt-2"
                    disabled={busy}
                    onClick={run(() => drive.adopt(notice))}
                  >
                    Show this folder to livediagram
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        {status.state === 'disconnected' ? (
          <Button variant="primary" size="sm" disabled={busy} onClick={run(drive.connect)}>
            Connect Google Drive
          </Button>
        ) : null}
        {status.state === 'needs_reconnect' || status.state === 'needs_resume' || connected ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={run(drive.disconnect)}>
            Disconnect
          </Button>
        ) : null}
        {status.state === 'needs_reconnect' ? (
          <Button variant="primary" size="sm" disabled={busy} onClick={run(drive.connect)}>
            Reconnect
          </Button>
        ) : null}
        {status.state === 'needs_resume' ? (
          <Button variant="primary" size="sm" disabled={busy} onClick={run(drive.resume)}>
            Resume sync
          </Button>
        ) : null}
        {connected ? (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || status.state === 'syncing'}
            onClick={run(drive.syncNow)}
          >
            {status.state === 'syncing' ? 'Syncing…' : 'Sync now'}
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}
