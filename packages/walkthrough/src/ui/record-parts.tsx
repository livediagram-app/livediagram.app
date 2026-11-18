'use client';

// What the recording's set-up (RecordSetup, inside Tools) and its dock (RecordDock) share: a problem's note.
import type { ReactNode } from 'react';
import { WarningIcon } from './icons';

export function Problem({
  children,
  tone = 'amber',
}: {
  children: ReactNode;
  tone?: 'amber' | 'rose';
}) {
  return (
    <p
      role="alert"
      className={`flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[12px] leading-snug ${
        tone === 'rose'
          ? 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100'
          : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100'
      }`}
    >
      <WarningIcon aria-hidden className="mt-px shrink-0" />
      {children}
    </p>
  );
}
