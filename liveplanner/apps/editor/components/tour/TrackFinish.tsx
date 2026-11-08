'use client';

// The finish of a track that changed the real plan (Card Types, Board Setup; docs/specs/026-plan/plan-tour.md): a line,
// Keep and Put It Back, and Learn More. The Practice Sprint's finish is its own (Clear Them, Keep as Real Cards).

import type { ReactNode } from 'react';
import { Button } from '@liveplanner/ui';

export function TrackFinish({
  heading,
  line,
  keepLabel,
  onKeep,
  onPutBack,
  learnMore,
}: {
  heading: string;
  line: string;
  keepLabel: string;
  onKeep: () => void;
  onPutBack: () => void;
  learnMore: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
          {heading}
        </h3>
        <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">{line}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onKeep}>
          {keepLabel}
        </Button>
        <Button variant="secondary" size="sm" onClick={onPutBack}>
          Put It Back
        </Button>
        <span className="flex-1" />
        {learnMore}
      </div>
    </div>
  );
}
