'use client';

// Google Drive's row in Settings > Account > Cloud Sync
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"; blueprint "Cloud Sync in
// Settings"). One row: the provider on the left, its status and one button on
// the right. A second line appears only while something needs the user. The
// status keeps one width per phase (Layout stability, "reserve per phase, not
// per message"). Syncing is automatic, so there is no Sync now.

import { useEffect, useRef, useState } from 'react';
import { lucideCloud, lucideTriangleAlert } from '@livediagram/icons/lucide';
import { Button, StableLabel, lucideGlyph } from '@livediagram/ui';
import { ArrowOutIcon } from '@/components/primitives/HelpArticleLink';
import { SettingsRowShell } from '@/components/dialogs/settings/SettingsRowShell';
import type { SettingsCloudSyncRowSpec } from '@/components/dialogs/settings/settings-catalogue';
import { DRIVE_SYNCING_SHOW_DELAY_MS } from '@/lib/drive/cadence';
import {
  DRIVE_PROBLEM_LABELS,
  DRIVE_SINCE_STEPS_MS,
  driveConnectedText,
  driveStatusOptions,
  driveSyncCopy,
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

// Vendored Lucide glyphs (docs/specs/004-interface-design/iconography.md).
const WarningGlyph = lucideGlyph(lucideTriangleAlert, 12);
const CloudGlyph = lucideGlyph(lucideCloud, 16);

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

// The shared clock ticks every 30 s; the first minute's wording changes at 15 s
// and 60 s, so the row also wakes exactly then.
function useSinceNow(lastSyncedAt: number | null): number {
  const tick = useRelativeNow();
  const [stepNow, setStepNow] = useState(0);
  useEffect(() => {
    if (lastSyncedAt === null) return;
    const timers = DRIVE_SINCE_STEPS_MS.map((step) => {
      const wait = lastSyncedAt + step - Date.now();
      return wait > 0 ? window.setTimeout(() => setStepNow(Date.now()), wait) : null;
    });
    return () => timers.forEach((t) => (t === null ? undefined : window.clearTimeout(t)));
  }, [lastSyncedAt]);
  return Math.max(tick, stepNow);
}

// The livediagram folder in Google Drive, in a new tab.
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}

export function GoogleDriveSyncRow({ row }: { row: SettingsCloudSyncRowSpec }) {
  const drive = useDriveMirror();
  const { status, connecting } = drive;
  const now = useSinceNow(status.lastSyncedAt);
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
    { now, syncingLong, checking: drive.checking },
  );
  const { phase } = copy;

  // Opening Cloud Sync checks (docs/specs/022-drive-mirror/drive-mirror.md, "Opening Cloud Sync
  // checks"): when the card scrolls into view, each time it does.
  const card = useRef<HTMLDivElement>(null);
  const { requestCheck } = drive;
  useEffect(() => {
    const node = card.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) requestCheck();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [requestCheck]);
  const notice = status.notices[0] ?? null;
  const { problem } = copy;
  const problemAction = (() => {
    switch (problem?.action) {
      case 'reconnect':
        return {
          label: 'Reconnect',
          held: connecting,
          act: drive.connect,
        };
      case 'resume':
        return { label: 'Resume', held: busy === 'resume', act: run('resume', drive.resume) };
      default:
        return null;
    }
  })();
  // Connected, the description under the card says where the documents go.
  const described =
    phase === 'connected' ? { ...row, description: driveConnectedText(status.rootName) } : row;
  // The quoted folder name opens that folder in Google Drive, once its id is
  // known (our own server says so before any call to Google).
  const folderLink =
    phase === 'connected' && status.rootName && status.rootFolderId ? (
      <>
        Your documents are synced to “
        <a
          href={driveFolderUrl(status.rootFolderId)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${status.rootName}, open in Google Drive`}
          className="inline-flex items-center gap-0.5 font-medium text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          {status.rootName}
          <ArrowOutIcon />
        </a>
        ” in Google Drive.
      </>
    ) : undefined;

  return (
    <SettingsRowShell
      row={described}
      descriptionContent={folderLink}
      wrapper={() => (
        <div
          ref={card}
          data-cloud-sync={row.provider}
          data-drive-phase={phase}
          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800"
        >
          {/* Wide: one row. Narrow (a phone's Settings): the status and buttons
              wrap under the name instead of leaving the card. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              <CloudGlyph />
              {row.label}
            </span>
            <span
              data-drive-actions
              className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2"
            >
              <span aria-live="polite">
                <StatusText options={driveStatusOptions(status, phase)} current={copy.status} />
              </span>
              {phase === 'not-connected' ? (
                <span data-drive-primary>
                  <Button
                    variant="primary"
                    size="sm"
                    // aria-disabled, not disabled: a pressed button keeps focus.
                    aria-disabled={connecting}
                    onClick={() => {
                      if (!connecting) void drive.connect();
                    }}
                  >
                    Connect
                  </Button>
                </span>
              ) : (
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
            </span>
          </div>

          {problem ? (
            <div
              data-drive-problem
              role={problem.failed ? 'alert' : 'status'}
              className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 dark:border-slate-700"
            >
              <p
                className={`min-w-0 text-xs ${
                  problem.failed
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-amber-800 dark:text-amber-200'
                }`}
              >
                {problem.text}
              </p>
              {problem.action === 'showFolder' && notice && drive.canAdopt ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy !== null}
                  onClick={run('adopt', () => drive.adopt(notice))}
                >
                  Show folder
                </Button>
              ) : null}
              {problemAction ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy !== null && busy !== 'resume'}
                  aria-disabled={problemAction.held}
                  onClick={() => {
                    if (!problemAction.held) void problemAction.act();
                  }}
                >
                  <StableLabel
                    options={DRIVE_PROBLEM_LABELS}
                    current={problemAction.label}
                    itemClassName="text-optical-line"
                  />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    />
  );
}
