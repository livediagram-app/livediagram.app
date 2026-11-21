'use client';

// A rule's sentence as the Rules list draws it (liveplanner/docs/specs/026-plan/automations.md "The Automations screen"): small
// joining words between chips, the trigger's chip in the brand tint. The parts come from ruleSentence.

import type { RuleSentencePart } from '@liveworkspace/automations';
import { ChipText, type ValueLabels } from './value-labels';

// A step's chip: a slate fill that reads on the dialog in both themes (dark's slate-800 all but vanished on its
// slate-900).
export const CHIP =
  'inline-flex max-w-full items-center truncate rounded-md bg-slate-100 px-2 py-px text-[12px] font-medium leading-[18px] text-slate-700 dark:bg-slate-700/70 dark:text-slate-100';
export const TRIGGER_CHIP =
  'inline-flex max-w-full items-center truncate rounded-md bg-brand-50 px-2 py-px text-[12px] font-medium leading-[18px] text-brand-700 dark:bg-brand-500/15 dark:text-brand-300';

export function SentenceChips({
  parts,
  className = '',
  labels,
}: {
  parts: readonly RuleSentencePart[];
  className?: string;
  // The app's value labels (useValueLabels): a value in a chip reads as its label, never its braces.
  labels?: ValueLabels | undefined;
}) {
  return (
    <span
      data-rule-sentence=""
      className={`flex min-w-0 flex-wrap items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400 ${className}`}
    >
      {parts.map((p, i) =>
        'word' in p ? (
          <span key={i}>{p.word}</span>
        ) : (
          <span key={i} className={p.trigger ? TRIGGER_CHIP : CHIP}>
            <ChipText text={p.chip} labels={labels} />
          </span>
        ),
      )}
    </span>
  );
}
