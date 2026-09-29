'use client';

// The avatar's cloud badge (docs/specs/022-drive-mirror/drive-mirror.md, "At a glance";
// blueprint "The cloud badge"): a cloud with a tick, arrows or an exclamation
// mark, laid over the avatar's corner as a button of its own that opens
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

// Fill per state; each carries a white glyph at 3:1 or better in both themes.
const FILL: Record<Exclude<DriveIndicator['kind'], 'none'>, string> = {
  synced: 'fill-emerald-600',
  syncing: 'fill-brand-600',
  attention: 'fill-amber-600',
};

function CloudGlyph({ kind }: { kind: Exclude<DriveIndicator['kind'], 'none'> }) {
  const cloud = (
    <>
      <circle cx="6" cy="10.5" r="3.8" />
      <circle cx="11.5" cy="7.2" r="5" />
      <circle cx="16.5" cy="10.3" r="3.9" />
      <rect x="6" y="9" width="10.5" height="5.3" />
    </>
  );
  return (
    // Square like every Glyph: the 22 × 16 cloud sits 3 units down.
    <Glyph size={26} units={22} weight={2} className="overflow-visible">
      <g transform="translate(0 3)">
        {/* A halo in the header's own colour (the button's text colour) parts the
            cloud from the avatar. */}
        <g fill="currentColor" stroke="currentColor" strokeWidth="3">
          {cloud}
        </g>
        <g className={FILL[kind]} stroke="none">
          {cloud}
        </g>
        <g
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {kind === 'synced' ? <path d="M8.4 10.7l1.8 1.8 3.4-3.6" /> : null}
          {kind === 'attention' ? (
            <>
              <path d="M11.2 7.4v3.3" />
              <circle cx="11.2" cy="12.9" r="0.4" fill="white" />
            </>
          ) : null}
          {kind === 'syncing' ? (
            <g
              data-drive-spin
              className="origin-center [transform-box:fill-box] motion-safe:animate-[spin_1.6s_linear_infinite]"
            >
              <path d="M8.6 10.4a2.7 2.7 0 0 1 4.8-1.3" />
              <path d="M13.6 7.7v1.6H12" />
              <path d="M13.8 11.4a2.7 2.7 0 0 1-4.8 1.3" />
              <path d="M8.8 14.1v-1.6h1.6" />
            </g>
          ) : null}
        </g>
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
            // Over the avatar's upper-right corner (a 28 px target): the account
            // button's glyph is centred, 20 px, with its label beneath (HEADER_ACTION_BTN).
            className="absolute left-1/2 top-1/2 z-10 flex h-7 w-7 translate-x-0.5 -translate-y-[27px] cursor-pointer items-center justify-center rounded-md text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-900 dark:focus-visible:ring-brand-400"
          >
            <CloudGlyph kind={indicator.kind} />
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
