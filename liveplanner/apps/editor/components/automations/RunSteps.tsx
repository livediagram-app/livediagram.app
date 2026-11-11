'use client';

// A run's steps, opened under its Run Log row (docs/specs/026-plan/automations.md "The Automations screen": Run
// Log): one line each with its mark, who did what (the trigger), each condition with what it found, each action, and
// Open Card on the last line. A test's lines say what each action would do. Lines come from the api as written.

import type { AutomationStepLine } from '@liveplanner/items';
import { CheckIcon, CloseIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideMinus } from '@liveworkspace/icons/lucide';
import { BoltIcon } from './automation-glyphs';

const AlreadyIcon = lucideGlyph(lucideMinus, 11);

const MARK = 'inline-flex size-[18px] shrink-0 items-center justify-center rounded-full';

function Mark({ line }: { line: AutomationStepLine }) {
  if (line.kind === 'trigger')
    return (
      <span
        aria-hidden
        className={`${MARK} bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300`}
      >
        <BoltIcon size={10} />
      </span>
    );
  if (line.kind === 'action' && line.already)
    return (
      <span
        aria-hidden
        className={`${MARK} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`}
      >
        <AlreadyIcon />
      </span>
    );
  return line.ok ? (
    <span
      aria-hidden
      className={`${MARK} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`}
    >
      <CheckIcon size={10} />
    </span>
  ) : (
    <span
      aria-hidden
      className={`${MARK} bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300`}
    >
      <CloseIcon size={10} />
    </span>
  );
}

// What a screen reader hears before a line, standing in for its mark.
const markWords = (line: AutomationStepLine) =>
  line.kind === 'trigger'
    ? 'Trigger: '
    : line.kind === 'action' && line.already
      ? 'Already so: '
      : line.ok
        ? 'Held: '
        : 'Did not hold: ';

export function RunSteps({
  steps,
  openCard,
}: {
  steps: readonly AutomationStepLine[];
  // Open Card, on the last line; absent when the run has no card.
  openCard?: (() => void) | undefined;
}) {
  return (
    <ol data-run-steps="" className="flex flex-col gap-2.5">
      {steps.map((line, i) => (
        <li
          key={i}
          className="flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-200"
        >
          <Mark line={line} />
          <span className="min-w-0 flex-1">
            <span className="sr-only">{markWords(line)}</span>
            {/* The trigger's line opens with who did it ("Ana Costa moved it from To Do to Done"): their name in bold. */}
            {line.kind === 'trigger' && line.by && line.text.startsWith(line.by.name) ? (
              <>
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  {line.by.name}
                </span>
                {line.text.slice(line.by.name.length)}
              </>
            ) : (
              line.text
            )}
            {line.kind === 'action' && line.already ? (
              <span className="text-slate-500 dark:text-slate-400"> (Already so)</span>
            ) : null}
          </span>
          {openCard && i === steps.length - 1 ? (
            <button
              type="button"
              onClick={openCard}
              className="touch-target-y relative shrink-0 rounded text-[13px] font-medium text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline dark:text-brand-300 dark:hover:text-brand-200"
            >
              Open Card
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
