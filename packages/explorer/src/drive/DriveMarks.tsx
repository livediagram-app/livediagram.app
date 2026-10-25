'use client';

// The Explorer's Google Drive marks (liveworkspace/docs/drive.md "The Explorer shows each item's sync", after
// livediagram/docs/specs/022-drive-mirror "The Explorer shows each document's sync"): beside an item's Updated time,
// a small cloud saying where it stands with Drive; beside its name, the unseen-folder mark when its file sits in a
// Drive folder liveworkspace can't see (that mark instead of the cloud). Only items the service mirrors carry
// either: it answers marks for the person's own work alone. And, while Google refuses the stored grant, a quiet
// banner with Reconnect.
import { useEffect, useState, type ReactNode } from 'react';
import { Tooltip } from '@liveworkspace/ui';
import { driveConnectUrl, withCloudSyncOpen } from '@liveworkspace/drive/client';
import type { DriveMarkState } from '@liveworkspace/drive';
import type { RenderItemMark } from '../types';
import { CloseIcon, Glyph } from '../ui/icons';
import type { DriveMarks } from './useDriveMarks';

export const DRIVE_MARK_LABEL: Record<DriveMarkState, string> = {
  synced: 'Synced to Google Drive',
  waiting: 'Waiting to sync to Google Drive',
  syncing: 'Syncing to Google Drive…',
  failed: 'Couldn’t sync to Google Drive. Trying again automatically.',
};
export const DRIVE_NOTICE_LABEL = 'Moved to a Drive folder liveworkspace can’t see.';

// Lucide's cloud glyphs (cloud-check, cloud-upload, cloud-sync, cloud-alert), on their 24-unit grid, split into the
// cloud, which stays as quiet as the metadata beside it, and the symbol on it, which alone takes a colour.
const CLOUD: Record<DriveMarkState, string> = {
  synced: 'M5.516 16.07A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.501 7.327',
  waiting: 'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242',
  syncing: 'M20.996 15.251A4.5 4.5 0 0 0 17.495 8h-1.79a7 7 0 1 0-12.709 5.607',
  failed: 'M8.128 16.949A7 7 0 1 1 15.71 8h1.79a1 1 0 0 1 0 9h-1.642',
};
const SYMBOL: Record<DriveMarkState, readonly string[]> = {
  synced: ['m17 15-5.5 5.5L9 18'],
  waiting: ['M12 13v8', 'm8 17 4-4 4 4'],
  syncing: ['m17 18-1.535 1.605a5 5 0 0 1-8-1.5', 'M17 22v-4h-4', 'M7 10v4h4', 'm7 14 1.535-1.605a5 5 0 0 1 8 1.5'],
  failed: ['M12 12v4', 'M12 20h.01'],
};
const ACCENT: Record<DriveMarkState, string> = {
  synced: 'text-emerald-600 dark:text-emerald-400',
  waiting: 'text-blue-600 dark:text-blue-400',
  // Pulsing while it runs; still with reduced motion.
  syncing: 'text-blue-600 dark:text-blue-400 animate-pulse motion-reduce:animate-none',
  failed: 'text-amber-600 dark:text-amber-400',
};

// Lucide's folder-lock.
const FOLDER_LOCK = [
  'M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v2.5',
  'M20 17v-2a2 2 0 1 0-4 0v2',
] as const;

export function DriveSyncMark({ state }: { state: DriveMarkState }) {
  const label = DRIVE_MARK_LABEL[state];
  return (
    <Tooltip label={label}>
      <span
        role="img"
        tabIndex={0}
        aria-label={label}
        data-drive-mark={state}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-slate-400 focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <Glyph size={14} units={24}>
          <path d={CLOUD[state]} />
          <g className={ACCENT[state]}>
            {SYMBOL[state].map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </Glyph>
      </span>
    </Tooltip>
  );
}

export function DriveNoticeMark() {
  return (
    <Tooltip label={DRIVE_NOTICE_LABEL}>
      <span
        role="img"
        tabIndex={0}
        aria-label={DRIVE_NOTICE_LABEL}
        data-drive-notice=""
        className="inline-flex shrink-0 items-center rounded-sm text-amber-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-amber-400"
      >
        <Glyph size={13} units={24}>
          <rect x={14} y={17} width={8} height={5} rx={1} />
          {FOLDER_LOCK.map((d) => (
            <path key={d} d={d} />
          ))}
        </Glyph>
      </span>
    </Tooltip>
  );
}

/** The host's own marks with Drive's after them: the notice beside the name, else the cloud beside the time. */
export function withDriveMarks(host: RenderItemMark | undefined, marks: DriveMarks): RenderItemMark | undefined {
  if (marks.byId.size === 0) return host;
  return (item, at) => {
    const own = host?.(item, at) ?? null;
    const mark = marks.byId.get(item.id);
    if (!mark) return own;
    const drive: ReactNode =
      at === 'title' ? (
        mark.notice ? (
          <DriveNoticeMark />
        ) : null
      ) : mark.notice ? null : (
        <DriveSyncMark state={mark.state} />
      );
    if (!drive) return own;
    return own ? (
      <>
        {own}
        {drive}
      </>
    ) : (
      drive
    );
  };
}

// Closed for this browser tab's session: the connection still needs reconnecting, and Cloud Sync still says so.
const DISMISS_KEY = 'liveworkspace:drive-reconnect-banner-dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** The quiet banner while Google refuses the stored grant (liveworkspace/docs/drive.md "Tokens"): bottom-left,
 *  dismissible for the session. Nothing is deleted meanwhile. */
export function DriveReconnectBanner({
  workspaceOrigin,
  settingsParam = 'profile',
}: {
  workspaceOrigin: string;
  // How this page's Settings deep link names Account > Profile, to come back with Cloud Sync open.
  settingsParam?: string;
}) {
  // Read after the first paint, so a prerendered page and the browser agree.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => setDismissed(readDismissed()), []);
  if (dismissed) return null;
  return (
    <div
      role="status"
      data-drive-reconnect=""
      className="fixed bottom-[calc(1rem+var(--explorer-floor,0px))] left-3 z-40 flex max-w-[22rem] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-black/30"
    >
      <span className="min-w-0 flex-1">Google Drive sync is paused.</span>
      <a
        href={driveConnectUrl(workspaceOrigin, '')}
        onClick={(event) => {
          event.preventDefault();
          const back = withCloudSyncOpen(window.location.href, settingsParam);
          window.location.assign(driveConnectUrl(workspaceOrigin, back));
        }}
        className="shrink-0 rounded-md px-2 py-1 font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-800"
      >
        Reconnect
      </a>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISS_KEY, '1');
          } catch {
            // A convenience only.
          }
          setDismissed(true);
        }}
        className="flex size-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
