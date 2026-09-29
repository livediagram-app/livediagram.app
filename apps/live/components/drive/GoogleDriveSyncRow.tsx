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
  DRIVE_PRIMARY_LABELS,
  DRIVE_SYNC_BADGES,
  driveRhythmText,
  driveSyncCopy,
  driveSyncTexts,
  lastSyncedText,
  type DriveSyncTone,
} from '@/lib/drive/cloud-sync-copy';
import type { DriveMirrorNotice } from '@/lib/drive/engine';
import { useRelativeNow } from '@/lib/relative-time';
import { useDriveMirror } from './drive-mirror-context';
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

// One place for several variants (Layout stability): every child in the same
// grid cell, only the current one visible; the others keep their space and are
// hidden from sight and assistive technology alike.
function Slot({ children }: { children: ReactNode }) {
  return <div className="grid [&>*]:[grid-area:1/1]">{children}</div>;
}

function Variant({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={shown ? undefined : true} className={shown ? undefined : 'invisible'}>
      {children}
    </div>
  );
}

// Reserves the notice's space while there is none.
const NOTICE_PLACEHOLDER: DriveMirrorNotice = {
  kind: 'diagram',
  ldId: '',
  name: 'A diagram',
  parentId: '',
};

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
  const { status, connecting } = drive;
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
  const copy = driveSyncCopy(status, {
    connecting,
    connectError: drive.connectError,
    connectNote: drive.connectNote,
  });
  const connected = status.state === 'idle' || status.state === 'syncing';
  const paused = status.state === 'needs_reconnect' || status.state === 'needs_resume';
  const syncing = status.state === 'syncing';
  const notice = status.notices[0] ?? null;
  const detail = status.progress ? 'progress' : notice ? 'notice' : 'rhythm';

  // The primary button: one per state, all its wordings laid out.
  const primary = (() => {
    switch (copy.action) {
      case 'connect':
        return {
          label: connecting ? 'Connecting…' : 'Connect Google Drive',
          held: connecting,
          act: drive.connect,
        };
      case 'reconnect':
        return {
          label: connecting ? 'Connecting…' : 'Reconnect',
          held: connecting,
          act: drive.connect,
        };
      case 'resume':
        return { label: 'Resume sync', held: busy === 'resume', act: run('resume', drive.resume) };
      case 'syncNow':
        return { label: syncing ? 'Syncing…' : 'Sync now', held: syncing, act: drive.syncNow };
      default:
        return null;
    }
  })();

  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div
          data-cloud-sync={row.provider}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 tabular-nums dark:border-slate-700 dark:bg-slate-800"
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
            <StableLabel options={driveSyncTexts(status)} current={copy.text} block />
          </div>

          <div data-drive-detail={detail} className="text-xs">
            <Slot>
              <Variant shown={detail === 'rhythm'}>
                <p className="text-slate-600 dark:text-slate-300">{driveRhythmText()}</p>
              </Variant>
              <Variant shown={detail === 'progress'}>
                <p className="mb-1.5 text-slate-600 dark:text-slate-300">
                  {status.progress
                    ? `${status.progress.done} of ${status.progress.total} documents copied`
                    : '0 of 0 documents copied'}
                </p>
                <div
                  role="progressbar"
                  aria-label="Copying your documents to Google Drive"
                  aria-valuemin={0}
                  aria-valuemax={status.progress?.total ?? 0}
                  aria-valuenow={status.progress?.done ?? 0}
                  className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
                >
                  <div
                    className="h-full rounded-full bg-brand-500 transition-[width] motion-reduce:transition-none"
                    style={{
                      width: `${status.progress ? (100 * status.progress.done) / Math.max(1, status.progress.total) : 0}%`,
                    }}
                  />
                </div>
              </Variant>
              <Variant shown={detail === 'notice'}>
                <NoticeBox
                  notice={notice ?? NOTICE_PLACEHOLDER}
                  more={Math.max(0, status.notices.length - 1)}
                  canAdopt={drive.canAdopt}
                  disabled={busy !== null || !notice}
                  onAdopt={run('adopt', () => (notice ? drive.adopt(notice) : undefined))}
                />
              </Variant>
            </Slot>
          </div>

          {/* The footer keeps its buttons in place: Disconnect unseen while there
              is nothing to disconnect, the primary button as wide as its longest
              wording and unseen when there is nothing to press. */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            <span className="min-w-0 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
              {connected || paused ? lastSyncedText(status.lastSyncedAt, now) : null}
            </span>
            <span data-drive-actions className="flex shrink-0 items-center gap-2">
              <span
                data-drive-disconnect
                aria-hidden={connected || paused ? undefined : true}
                className={connected || paused ? undefined : 'invisible'}
              >
                <Button
                  // Reversible, and the Drive files stay: a warning, not a danger.
                  variant="warning"
                  size="sm"
                  disabled={busy !== null}
                  onClick={run('disconnect', drive.disconnect)}
                >
                  Disconnect
                </Button>
              </span>
              <span
                data-drive-primary
                aria-hidden={primary ? undefined : true}
                className={primary ? undefined : 'invisible'}
              >
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy !== null && busy !== 'resume'}
                  // aria-disabled, not disabled: a pressed button keeps focus, so
                  // the pane never jumps to another control.
                  aria-disabled={primary?.held ?? false}
                  onClick={() => {
                    if (primary && !primary.held) void primary.act();
                  }}
                >
                  <StableLabel
                    options={DRIVE_PRIMARY_LABELS}
                    current={primary?.label ?? 'Sync now'}
                    itemClassName="text-optical-line"
                  />
                </Button>
              </span>
            </span>
          </div>
        </div>
      )}
    />
  );
}

function NoticeBox({
  notice,
  more,
  canAdopt,
  disabled,
  onAdopt,
}: {
  notice: DriveMirrorNotice;
  more: number;
  canAdopt: boolean;
  disabled: boolean;
  onAdopt: () => void;
}) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
      <p>
        <span className="font-semibold">{notice.name}</span>
        {more > 0 ? ` and ${more} more` : ''}: {DRIVE_NOTICE_TEXT} Show it this folder, or move the{' '}
        {notice.kind === 'folder' ? 'folder' : 'file'} back in Drive.
      </p>
      {canAdopt ? (
        <Button
          variant="secondary"
          size="xs"
          className="mt-2"
          disabled={disabled}
          onClick={onAdopt}
        >
          Show this folder to livediagram
        </Button>
      ) : null}
    </div>
  );
}
