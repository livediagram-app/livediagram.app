'use client';

// The avatar's cloud badge (docs/specs/022-drive-mirror/drive-mirror.md, "At a glance";
// blueprint "The cloud badge"): a small disc with a cloud, arrows or an
// exclamation mark, laid over the avatar's corner as a button of its own that opens
// Settings on Account > Cloud Sync. Absolutely placed, so nothing moves as it
// appears or changes. The glyph, not the colour alone, tells the states apart.

import { useEffect, useState } from 'react';
import { Glyph, Tooltip } from '@livediagram/ui';
import { DRIVE_SYNCING_MARK_DELAY_MS } from '@/lib/drive/cadence';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { useRelativeNow } from '@/lib/relative-time';
import { useDriveMirror } from './drive-mirror-context';
import { driveIndicator, type DriveIndicator } from './drive-indicator';

export function useDriveIndicator(): DriveIndicator {
  const { status, mode } = useDriveMirror();
  const now = useRelativeNow();
  // The pass that has been syncing long enough to show (D23). Compared by
  // identity, so a new status is never "long" until its own timer fires.
  const [longPass, setLongPass] = useState<DriveMirrorStatus | null>(null);
  useEffect(() => {
    if (status.state !== 'syncing') return;
    const timer = window.setTimeout(() => setLongPass(status), DRIVE_SYNCING_MARK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status]);
  return driveIndicator(status, mode, longPass === status, now);
}

// The badge's size in px: a small corner badge, about a quarter of the
// avatar's area (D24).
export const DRIVE_BADGE_PX = 12;

// Fill per state; each carries a white glyph at 3:1 or better in both themes.
const FILL: Record<Exclude<DriveIndicator['kind'], 'none'>, string> = {
  synced: 'fill-emerald-600',
  syncing: 'fill-brand-600',
  attention: 'fill-amber-600',
};

// A disc in the state's colour inside a ring in the header's background (the
// button's text colour), holding a white glyph that differs per state: a
// cloud when synced, turning arrows while syncing, an exclamation mark.
function BadgeGlyph({ kind }: { kind: Exclude<DriveIndicator['kind'], 'none'> }) {
  return (
    <Glyph size={DRIVE_BADGE_PX} units={16} weight={1.5} className="overflow-visible">
      <circle cx="8" cy="8" r="9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="7.5" className={FILL[kind]} stroke="none" />
      <g fill="none" stroke="white">
        {kind === 'synced' ? (
          <path
            fill="white"
            stroke="none"
            d="M5.1 11.2h5.9a2.1 2.1 0 0 0 .3-4.2A3 3 0 0 0 5.6 6.2a2.5 2.5 0 0 0-.5 5z"
          />
        ) : null}
        {kind === 'attention' ? (
          <>
            <path d="M8 4.4v4.4" />
            <path d="M8 11.5v.1" />
          </>
        ) : null}
        {kind === 'syncing' ? (
          <g
            data-drive-spin
            className="origin-center [transform-box:fill-box] motion-safe:animate-[spin_1.6s_linear_infinite]"
          >
            <path d="M4.6 7.4a3.5 3.5 0 0 1 6.3-1.6" />
            <path d="M11.2 3.9v2.2H9" />
            <path d="M11.4 8.6a3.5 3.5 0 0 1-6.3 1.6" />
            <path d="M4.8 12.1V9.9H7" />
          </g>
        ) : null}
      </g>
    </Glyph>
  );
}

export function DriveSyncBadge({
  indicator,
  onOpen,
}: {
  indicator: DriveIndicator;
  onOpen: () => void;
}) {
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {indicator.announce}
      </span>
      {indicator.kind !== 'none' ? (
        <Tooltip label={indicator.label}>
          <button
            type="button"
            data-drive-badge={indicator.kind}
            aria-label={indicator.label}
            onClick={onOpen}
            // A 24 px target centred 8 px right of and 15 px above the avatar's
            // centre, on its upper-right corner: the account button's glyph is
            // centred, 20 px, with its label beneath (HEADER_ACTION_BTN).
            className="absolute left-1/2 top-1/2 z-10 flex h-6 w-6 -translate-x-1 -translate-y-[27px] cursor-pointer items-center justify-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-900 dark:focus-visible:ring-brand-400"
          >
            <BadgeGlyph kind={indicator.kind} />
          </button>
        </Tooltip>
      ) : null}
    </>
  );
}

// The first mirror's progress, round the avatar itself.
export function DriveProgressRing({ indicator }: { indicator: DriveIndicator }) {
  if (!indicator.progress) return null;
  const fraction = indicator.progress.done / Math.max(1, indicator.progress.total);
  return (
    <svg
      data-drive-progress={String(fraction)}
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute -inset-[3px] -rotate-90 text-brand-500 dark:text-brand-400"
    >
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        pathLength={1}
        strokeDasharray={`${fraction} 1`}
      />
    </svg>
  );
}
