'use client';

// The Collaborate panel's empty state (docs/specs/012-collaboration/assigned-actions.md §5 "Empty states"): a
// glyph in a soft brand disc, a Title Case heading, one line. The same shape
// the refreshed Collaborate cards use for theirs.

import { lucideCircleCheck, lucideSparkles } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import { emptyCopy, type CollaborateKind, type CollaborateSide } from './collaborate-model';

const SparklesGlyph = lucideGlyph(lucideSparkles, 18);
const CircleCheckGlyph = lucideGlyph(lucideCircleCheck, 18);

export function CollaborateEmpty({ side, kind }: { side: CollaborateSide; kind: CollaborateKind }) {
  const { heading, line } = emptyCopy(side, kind);
  return (
    <div className="flex animate-fade-in flex-col items-center gap-1.5 px-3 py-5 text-center">
      <span
        aria-hidden
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300"
      >
        {side === 'open' ? <SparklesGlyph /> : <CircleCheckGlyph />}
      </span>
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">{heading}</p>
      <p className="max-w-[13rem] text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {line}
      </p>
    </div>
  );
}
