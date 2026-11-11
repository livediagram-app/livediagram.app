'use client';

// A run's steps, opened under its Audit Trail row (docs/specs/026-plan/automations.md "The Automations screen": Run
// Log): one line each with its mark, who did what (the trigger), each condition with what it found, each action, and
// Open Card on the last line. A test's lines say what each action would do. A branch's line ("For each Child Card: on
// 3 related cards") wears the branch mark, and each related card's lines after it, headed by its number, sit inset
// under it. An outgoing action's line says where it was queued ("Queued for Launch Channel"); an AI step's wears the
// sparkle. Lines come from the api as written.

import type { AutomationStepLine } from '@liveplanner/items';
import { CheckIcon, CloseIcon, SparkleIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideListTree, lucideMinus } from '@liveworkspace/icons/lucide';
import { BoltIcon } from './automation-glyphs';

const AlreadyIcon = lucideGlyph(lucideMinus, 11);
const BranchIcon = lucideGlyph(lucideListTree, 11);

// A related card's own line in a branch: "#12 Removed the label blocked".
const RELATED = /^(#\d+) (.*)$/s;

const MARK = 'inline-flex size-[18px] shrink-0 items-center justify-center rounded-full';

function Mark({ line }: { line: AutomationStepLine }) {
  if (line.kind === 'branch')
    return (
      <span
        aria-hidden
        className={`${MARK} ${line.ok ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'}`}
      >
        <BranchIcon />
      </span>
    );
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
  line.kind === 'branch'
    ? line.ok
      ? 'Branch: '
      : 'Branch, failed: '
    : line.kind === 'trigger'
      ? 'Trigger: '
      : line.kind === 'action' && line.already
        ? 'Already so: '
        : line.ok
          ? 'Held: '
          : 'Did not hold: ';

/** Which lines sit under a branch: the related cards' own, from the branch's line until one that names no card. */
export function insetLines(steps: readonly AutomationStepLine[]): boolean[] {
  const out: boolean[] = [];
  let inBranch = false;
  for (const line of steps) {
    if (line.kind === 'branch') inBranch = true;
    else inBranch = inBranch && line.kind !== 'trigger' && RELATED.test(line.text);
    out.push(line.kind !== 'branch' && inBranch);
  }
  return out;
}

// A related card's line, its number first in the card's own weight.
function RelatedText({ text }: { text: string }) {
  const [, key = '', rest = text] = RELATED.exec(text) ?? [];
  return (
    <>
      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{key}</span>{' '}
      {rest}
    </>
  );
}

export function RunSteps({
  steps,
  openCard,
}: {
  steps: readonly AutomationStepLine[];
  // Open Card, on the last line; absent when the run has no card.
  openCard?: (() => void) | undefined;
}) {
  const inset = insetLines(steps);
  return (
    <ol data-run-steps="" className="flex flex-col gap-2.5">
      {steps.map((line, i) => (
        <li
          key={i}
          data-run-related={inset[i] ? '' : undefined}
          className={`flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-200 ${inset[i] ? 'ml-7' : ''}`}
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
            ) : inset[i] ? (
              <RelatedText text={line.text} />
            ) : (
              line.text
            )}
            {line.kind === 'action' && line.already ? (
              <span className="text-slate-500 dark:text-slate-400"> (Already so)</span>
            ) : null}
            {/* An AI step's call: the sparkle, said as "Generated by AI". */}
            {line.kind === 'action' && line.ai ? (
              <Tooltip label="Generated by AI">
                <span className="ml-1.5 inline-flex translate-y-[2px] text-brand-700 dark:text-brand-300">
                  <SparkleIcon size={12} aria-hidden />
                  <span className="sr-only"> Generated by AI</span>
                </span>
              </Tooltip>
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
