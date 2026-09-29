'use client';

// Google Drive's row in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"; blueprint "Cloud Sync in
// Settings"): where the mirror stands in plain words, the rhythm it keeps,
// when it last synced, what to do about anything that needs the user, and
// Connect, Sync now and Disconnect.

import { useState, type ReactNode } from 'react';
import { Button, Glyph, StableLabel } from '@livediagram/ui';
import { SettingsRowShell } from '@/components/dialogs/settings/SettingsRowShell';
import type { SettingsCloudSyncRowSpec } from '@/components/dialogs/settings/settings-catalogue';
import {
  DRIVE_SYNC_BADGES,
  driveRhythmText,
  driveSyncCopy,
  lastSyncedText,
  type DriveSyncTone,
} from '@/lib/drive/cloud-sync-copy';
import { useRelativeNow } from '@/lib/relative-time';
import { DRIVE_CONNECT_FAILED, useDriveMirror } from './drive-mirror-context';
import { DRIVE_NOTICE_TEXT } from './DriveNoticeMarker';

// The state pill: a glyph and a word, so the colour is never the only signal.
const TONE: Record<DriveSyncTone, { className: string; glyph: ReactNode }> = {
  off: {
    className:
      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
    glyph: <circle cx="8" cy="8" r="4.5" />,
  },
  ok: {
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
    glyph: <path d="M4 8.5l2.6 2.6L12 5.5" />,
  },
  busy: {
    className:
      'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-950/60 dark:text-brand-200',
    glyph: (
      <>
        <path d="M3.5 7.5a4.5 4.5 0 0 1 8.2-2.3" />
        <path d="M12 3v2.6H9.4" />
        <path d="M12.5 8.5a4.5 4.5 0 0 1-8.2 2.3" />
        <path d="M4 13v-2.6h2.6" />
      </>
    ),
  },
  attention: {
    className:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200',
    glyph: (
      <>
        <path d="M8 4v5" />
        <path d="M8 11.8v.2" />
      </>
    ),
  },
};

// Every button label pair: a button is as wide as its longer wording.
const CONNECT_LABELS = ['Connect Google Drive', 'Connecting…'] as const;
const RECONNECT_LABELS = ['Reconnect', 'Connecting…'] as const;
const SYNC_LABELS = ['Sync now', 'Syncing…'] as const;

function StatePill({ tone, children }: { tone: DriveSyncTone; children: string }) {
  const { className, glyph } = TONE[tone];
  return (
    <span
      data-drive-state={tone}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Glyph size={12} units={16}>
        {glyph}
      </Glyph>
      <StableLabel options={DRIVE_SYNC_BADGES} current={children} />
    </span>
  );
}

export function GoogleDriveSyncRow({ row }: { row: SettingsCloudSyncRowSpec }) {
  const drive = useDriveMirror();
  const { status } = drive;
  const now = useRelativeNow();
  const [busy, setBusy] = useState<null | 'resume' | 'disconnect' | 'adopt'>(null);
  const run = (kind: NonNullable<typeof busy>, action: () => Promise<void> | void) => async () => {
    setBusy(kind);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };
  // Connecting is the provider's, so it holds until the page leaves for Google.
  const { connecting } = drive;
  const copy = driveSyncCopy(status, { connecting, connectError: drive.connectError });
  // The text slot holds both the usual words and the failure, so a failed
  // Connect changes no heights.
  const usual = driveSyncCopy(status, { connecting, connectError: null }).text;
  const texts =
    copy.action === 'connect' || copy.action === 'reconnect'
      ? [usual, DRIVE_CONNECT_FAILED]
      : [usual];
  const connected = status.state === 'idle' || status.state === 'syncing';
  const paused = status.state === 'needs_reconnect' || status.state === 'needs_resume';
  const syncing = status.state === 'syncing';

  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div
          data-cloud-sync={row.provider}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              <Glyph size={16} units={16}>
                <path d="M4.5 12.5h7.2a2.8 2.8 0 0 0 .4-5.6A4 4 0 0 0 4.4 7.3a2.6 2.6 0 0 0 .1 5.2z" />
              </Glyph>
              {row.label}
            </span>
            <StatePill tone={copy.tone}>{copy.badge}</StatePill>
          </div>

          <div
            aria-live="polite"
            data-drive-text
            className={`text-sm ${copy.failed ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}
          >
            <StableLabel options={texts} current={copy.text} block />
          </div>

          {status.progress ? (
            <div
              role="progressbar"
              aria-label="Copying your documents to Google Drive"
              aria-valuemin={0}
              aria-valuemax={status.progress.total}
              aria-valuenow={status.progress.done}
              className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] motion-reduce:transition-none"
                style={{
                  width: `${(100 * status.progress.done) / Math.max(1, status.progress.total)}%`,
                }}
              />
            </div>
          ) : null}

          {connected ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">{driveRhythmText()}</p>
          ) : null}

          {status.notices.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {status.notices.map((notice) => (
                <li
                  key={`${notice.kind}:${notice.ldId}`}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                >
                  <p>
                    <span className="font-semibold">{notice.name}</span>: {DRIVE_NOTICE_TEXT} Show
                    it this folder, or move the {notice.kind === 'folder' ? 'folder' : 'file'} back
                    in Drive.
                  </p>
                  {drive.canAdopt ? (
                    <Button
                      variant="secondary"
                      size="xs"
                      className="mt-2"
                      disabled={busy !== null}
                      onClick={run('adopt', () => drive.adopt(notice))}
                    >
                      Show this folder to livediagram
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {/* One action row; the buttons keep their places as states change. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            <span className="min-w-0 text-xs text-slate-600 dark:text-slate-300">
              {connected || paused ? lastSyncedText(status.lastSyncedAt, now) : null}
            </span>
            <span className="flex items-center gap-2">
              {connected || paused ? (
                <Button
                  // Reversible, and the Drive files stay: a warning, not a danger.
                  variant="warning"
                  size="sm"
                  disabled={busy !== null}
                  onClick={run('disconnect', drive.disconnect)}
                >
                  Disconnect
                </Button>
              ) : null}
              {copy.action === 'connect' ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy !== null || connecting}
                  onClick={() => void drive.connect()}
                >
                  <StableLabel
                    options={CONNECT_LABELS}
                    current={connecting ? 'Connecting…' : 'Connect Google Drive'}
                    itemClassName="text-optical-line"
                  />
                </Button>
              ) : null}
              {copy.action === 'reconnect' ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy !== null || connecting}
                  onClick={() => void drive.connect()}
                >
                  <StableLabel
                    options={RECONNECT_LABELS}
                    current={connecting ? 'Connecting…' : 'Reconnect'}
                    itemClassName="text-optical-line"
                  />
                </Button>
              ) : null}
              {copy.action === 'resume' ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy !== null}
                  onClick={run('resume', drive.resume)}
                >
                  Resume sync
                </Button>
              ) : null}
              {connected ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy !== null || syncing}
                  onClick={() => drive.syncNow()}
                >
                  <StableLabel
                    options={SYNC_LABELS}
                    current={syncing ? 'Syncing…' : 'Sync now'}
                    itemClassName="text-optical-line"
                  />
                </Button>
              ) : null}
            </span>
          </div>
        </div>
      )}
    />
  );
}
