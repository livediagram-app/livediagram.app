'use client';

// A rule's sentence as the Rules list draws it (docs/specs/026-plan/automations.md "The Automations screen"): small
// joining words between chips, the trigger's chip in the brand tint. The parts come from ruleSentence.

import type { RuleSentencePart } from '@liveplanner/items';

export const CHIP =
  'inline-flex max-w-full items-center truncate rounded-md bg-slate-100 px-2 py-px text-[12px] font-medium leading-[18px] text-slate-700 dark:bg-slate-800 dark:text-slate-200';
export const TRIGGER_CHIP =
  'inline-flex max-w-full items-center truncate rounded-md bg-brand-50 px-2 py-px text-[12px] font-medium leading-[18px] text-brand-700 dark:bg-brand-500/15 dark:text-brand-300';

export function SentenceChips({
  parts,
  className = '',
}: {
  parts: readonly RuleSentencePart[];
  className?: string;
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
            {p.chip}
          </span>
        ),
      )}
    </span>
  );
}
