'use client';

// The avatar's sync mark (docs/specs/022-drive-mirror/drive-mirror.md, "At a glance"):
// a small dot, and a progress ring while the first mirror copies, laid over
// the account menu's avatar. Absolutely placed, so the button never moves as
// it appears or changes. A polite status region, always mounted, says the
// same words; the button's own name carries them too (the caller adds
// `indicator.label`). Details stay in the Drive panel.

import { useEffect, useState } from 'react';
import { DRIVE_SYNCING_MARK_DELAY_MS } from '@/lib/drive/cadence';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import { useDriveMirror } from './drive-mirror-context';
import { driveIndicator, type DriveIndicator } from './drive-indicator';

export function useDriveIndicator(): DriveIndicator {
  const { status, mode } = useDriveMirror();
  // The pass that has been syncing long enough to show (D23). Compared by
  // identity, so a new status is never "long" until its own timer fires.
  const [longPass, setLongPass] = useState<DriveMirrorStatus | null>(null);
  useEffect(() => {
    if (status.state !== 'syncing') return;
    const timer = window.setTimeout(() => setLongPass(status), DRIVE_SYNCING_MARK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status]);
  return driveIndicator(status, mode, longPass === status);
}

const DOT: Record<Exclude<DriveIndicator['kind'], 'none'>, string> = {
  syncing: 'bg-brand-500 motion-safe:animate-pulse',
  synced: 'bg-emerald-500',
  attention: 'bg-amber-500',
};

export function DriveSyncMark({ indicator }: { indicator: DriveIndicator }) {
  const fraction = indicator.progress
    ? indicator.progress.done / Math.max(1, indicator.progress.total)
    : null;
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {indicator.label}
      </span>
      {fraction !== null ? (
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
      ) : null}
      {indicator.kind !== 'none' ? (
        <span
          data-drive-mark={indicator.kind}
          aria-hidden="true"
          className={`pointer-events-none absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${DOT[indicator.kind]}`}
        />
      ) : null}
    </>
  );
}
