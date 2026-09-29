'use client';

// Google Drive's row in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"; blueprint "Cloud Sync in
// Settings"). Three phases (not connected, connected, needs attention), each
// keeping one size while it lasts and reserving nothing for another (Layout
// stability, "reserve per phase, not per message"). Syncing is automatic, so
// there is no Sync now.

import { useEffect, useState, type ReactNode } from 'react';
import { Button, Glyph, StableLabel } from '@livediagram/ui';
import { SettingsRowShell } from '@/components/dialogs/settings/SettingsRowShell';
import type { SettingsCloudSyncRowSpec } from '@/components/dialogs/settings/settings-catalogue';
import { DRIVE_SYNCING_SHOW_DELAY_MS } from '@/lib/drive/cadence';
import {
  DRIVE_NOTICE_TEXT,
  DRIVE_PHASE_PRIMARY,
  DRIVE_RHYTHM,
  driveStatusOptions,
  driveSyncCopy,
  driveSyncTexts,
  type DriveStatusText,
} from '@/lib/drive/cloud-sync-copy';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { useRelativeNow } from '@/lib/relative-time';
import { useDriveMirror } from './drive-mirror-context';

// Whether this pass has run long enough to say Syncing… (D26). Compared by
// identity, so a new status is never "long" until its own timer fires.
function useSyncingLong(status: DriveMirrorStatus): boolean {
  const [longPass, setLongPass] = useState<DriveMirrorStatus | null>(null);
  useEffect(() => {
    if (status.state !== 'syncing') return;
    const timer = window.setTimeout(() => setLongPass(status), DRIVE_SYNCING_SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status]);
  return longPass === status;
}

function WarningGlyph() {
  return (
    <Glyph size={12} units={16}>
      <path d="M8 2.5l6 10.5H2z" />
      <path d="M8 6.5v3" />
      <path d="M8 11.4v.1" />
    </Glyph>
  );
}

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

// The status at the top right: plain, muted words, as wide as the widest of the
// phase; the warning colour and a glyph when something needs the user.
function StatusText({
  options,
  current,
}: {
  options: DriveStatusText[];
  current: DriveStatusText;
}) {
  const all = options.some((o) => o.text === current.text) ? options : [...options, current];
  return (
    <span data-drive-status className="grid shrink-0 text-xs tabular-nums">
      {all.map((option) => {
        const shown = option.text === current.text;
        return (
          <span
            key={option.text}
            data-stable-option
            data-warn={option.warn || undefined}
            aria-hidden={shown ? undefined : true}
            className={`inline-flex items-center gap-1 justify-self-end [grid-area:1/1] ${
              option.warn
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-slate-500 dark:text-slate-400'
            } ${shown ? '' : 'invisible'}`}
          >
            {option.warn ? <WarningGlyph /> : null}
            {option.text}
          </span>
        );
      })}
    </span>
  );
}

export function GoogleDriveSyncRow({ row }: { row: SettingsCloudSyncRowSpec }) {
  const drive = useDriveMirror();
  const { status, connecting } = drive;
  const now = useRelativeNow();
  const syncingLong = useSyncingLong(status);
  const [busy, setBusy] = useState<null | 'resume' | 'disconnect' | 'adopt'>(null);
  const run = (kind: NonNullable<typeof busy>, action: () => Promise<void> | void) => async () => {
    setBusy(kind);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };
  const copy = driveSyncCopy(
    status,
    { connecting, connectError: drive.connectError, connectNote: drive.connectNote },
    { now, syncingLong },
  );
  const { phase } = copy;
  const notice = status.notices[0] ?? null;
  const more = Math.max(0, status.notices.length - 1);

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
        return { label: 'Resume', held: busy === 'resume', act: run('resume', drive.resume) };
      default:
        return null;
    }
  })();
  const primaryLabels = DRIVE_PHASE_PRIMARY[phase];

  return (
    <SettingsRowShell
      row={row}
      wrapper={() => (
        <div
          data-cloud-sync={row.provider}
          data-drive-phase={phase}
          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              <Glyph size={16} units={16}>
                <path d="M4.5 12.5h7.2a2.8 2.8 0 0 0 .4-5.6A4 4 0 0 0 4.4 7.3a2.6 2.6 0 0 0 .1 5.2z" />
              </Glyph>
              {row.label}
            </span>
            <StatusText options={driveStatusOptions(status, phase)} current={copy.status} />
          </div>

          <div
            aria-live="polite"
            data-drive-text
            className={`text-sm tabular-nums ${copy.failed ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}
          >
            <StableLabel options={driveSyncTexts(status, phase)} current={copy.text} block />
          </div>

          {phase === 'connected' ? (
            <div data-drive-detail={notice ? 'notice' : 'rhythm'} className="text-xs">
              <Slot>
                <Variant shown={!notice}>
                  <p className="text-slate-500 dark:text-slate-400">{DRIVE_RHYTHM}</p>
                </Variant>
                <Variant shown={!!notice}>
                  {/* Short, like the rhythm it replaces, so little is reserved below
                      it; Show folder is in the footer. */}
                  <p className="text-amber-800 dark:text-amber-200">
                    <span className="font-semibold">{notice?.name ?? 'A document'}</span>
                    {more > 0 ? ` and ${more} more` : ''}: {DRIVE_NOTICE_TEXT}
                  </p>
                </Variant>
              </Slot>
            </div>
          ) : null}

          {/* Buttons only: nothing else sits beside them, so nothing is covered. */}
          <div data-drive-actions className="mt-1 flex flex-wrap items-center justify-end gap-2">
            {notice && drive.canAdopt ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                onClick={run('adopt', () => drive.adopt(notice))}
              >
                Show folder
              </Button>
            ) : null}
            {phase === 'not-connected' ? null : (
              <span data-drive-disconnect>
                <Button
                  // Reversible, and the Drive files stay: a neutral action.
                  variant="secondary"
                  size="sm"
                  disabled={busy !== null}
                  onClick={run('disconnect', drive.disconnect)}
                >
                  Disconnect
                </Button>
              </span>
            )}
            {primaryLabels.length > 0 ? (
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
                    options={primaryLabels}
                    current={primary?.label ?? primaryLabels[0] ?? ''}
                    itemClassName="text-optical-line"
                  />
                </Button>
              </span>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}
