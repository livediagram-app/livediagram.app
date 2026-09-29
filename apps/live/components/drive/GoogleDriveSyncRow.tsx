'use client';

// Google Drive's row in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"; blueprint "Cloud Sync in
// Settings"). Three phases (not connected, connected, needs attention), each
// keeping one size while it lasts and reserving nothing for another (Layout
// stability, "reserve per phase, not per message").

import { useState, type ReactNode } from 'react';
import { Button, Glyph, StableLabel } from '@livediagram/ui';
import { SettingsRowShell } from '@/components/dialogs/settings/SettingsRowShell';
import type { SettingsCloudSyncRowSpec } from '@/components/dialogs/settings/settings-catalogue';
import {
  DRIVE_NOTICE_TEXT,
  DRIVE_PHASE_BADGES,
  DRIVE_PHASE_PRIMARY,
  DRIVE_SINCE_SAMPLES,
  driveRhythmText,
  driveSyncCopy,
  driveSyncTexts,
  sinceText,
  type DriveSyncBadge,
  type DriveSyncPhase,
  type DriveSyncTone,
} from '@/lib/drive/cloud-sync-copy';
import { useRelativeNow } from '@/lib/relative-time';
import { useDriveMirror } from './drive-mirror-context';

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

function StatePill({
  tone,
  phase,
  children,
}: {
  tone: DriveSyncTone;
  phase: DriveSyncPhase;
  children: DriveSyncBadge;
}) {
  const { className, glyph } = TONE[tone];
  return (
    <span
      data-drive-state={tone}
      // Centred, so a short word sits in the middle of the width its phase reserves.
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-center text-xs font-medium ${className}`}
    >
      <Glyph size={12} units={16}>
        {glyph}
      </Glyph>
      <StableLabel options={DRIVE_PHASE_BADGES[phase]} current={children} />
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
  const { phase } = copy;
  const syncing = status.state === 'syncing' || status.progress !== null;
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
          data-drive-phase={phase}
          className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 tabular-nums dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              <Glyph size={16} units={16}>
                <path d="M4.5 12.5h7.2a2.8 2.8 0 0 0 .4-5.6A4 4 0 0 0 4.4 7.3a2.6 2.6 0 0 0 .1 5.2z" />
              </Glyph>
              {row.label}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <StatePill tone={copy.tone} phase={phase}>
                {copy.badge}
              </StatePill>
              {phase === 'not-connected' ? null : (
                <span data-drive-since className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true">·</span>
                  <StableLabel
                    options={DRIVE_SINCE_SAMPLES}
                    current={sinceText(status.lastSyncedAt, now)}
                  />
                </span>
              )}
            </span>
          </div>

          <div
            aria-live="polite"
            data-drive-text
            className={`text-sm ${copy.failed ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}
          >
            <StableLabel options={driveSyncTexts(status, phase)} current={copy.text} block />
          </div>

          {phase === 'connected' ? (
            <div data-drive-detail={notice ? 'notice' : 'rhythm'} className="text-xs">
              <Slot>
                <Variant shown={!notice}>
                  <p className="text-slate-600 dark:text-slate-300">{driveRhythmText()}</p>
                </Variant>
                <Variant shown={!!notice}>
                  <p className="text-amber-900 dark:text-amber-200">
                    <span className="font-semibold">{notice?.name ?? 'A document'}</span>
                    {more > 0 ? ` and ${more} more` : ''}: {DRIVE_NOTICE_TEXT}{' '}
                    {drive.canAdopt ? (
                      <>
                        <span aria-hidden="true">· </span>
                        <button
                          type="button"
                          disabled={busy !== null || !notice}
                          onClick={run('adopt', () => (notice ? drive.adopt(notice) : undefined))}
                          className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 disabled:opacity-50 dark:text-amber-200 dark:hover:text-amber-100"
                        >
                          Show folder
                        </button>
                      </>
                    ) : null}
                  </p>
                </Variant>
              </Slot>
            </div>
          ) : null}

          {/* The divider above the buttons is the first copy's progress track. */}
          {phase === 'connected' ? (
            <div
              data-drive-progress-track
              {...(status.progress
                ? {
                    role: 'progressbar',
                    'aria-label': 'Copying your documents to Google Drive',
                    'aria-valuemin': 0,
                    'aria-valuemax': status.progress.total,
                    'aria-valuenow': status.progress.done,
                  }
                : {})}
              className="h-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] motion-reduce:transition-none"
                style={{
                  width: `${status.progress ? (100 * status.progress.done) / Math.max(1, status.progress.total) : 0}%`,
                }}
              />
            </div>
          ) : (
            <div className="h-px bg-slate-100 dark:bg-slate-700" />
          )}

          {/* Buttons only: nothing else sits beside them, so nothing is covered. */}
          <div data-drive-actions className="flex flex-wrap items-center justify-end gap-2">
            {phase === 'not-connected' ? null : (
              <span data-drive-disconnect>
                <Button
                  // Reversible, and the Drive files stay: a quiet warning, never
                  // louder than the primary.
                  variant="warning-outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={run('disconnect', drive.disconnect)}
                >
                  Disconnect
                </Button>
              </span>
            )}
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
                  options={DRIVE_PHASE_PRIMARY[phase]}
                  current={primary?.label ?? DRIVE_PHASE_PRIMARY[phase][0]}
                  itemClassName="text-optical-line"
                />
              </Button>
            </span>
          </div>
        </div>
      )}
    />
  );
}
