'use client';

// Setup Board's steps as a wizard stepper (docs/specs/026-plan/plan-board.md "Setup Board"): a numbered circle per
// step joined by a line, the step's name beside it (under it on a narrow card, a container query on the card). The
// current step's circle is filled in the brand colour and its name bold; a done step's circle holds a tick, the line
// up to the current step is filled, and a done step is a button back to it; a step ahead is muted.
import { Fragment } from 'react';
import { CheckIcon, GlyphDisc } from '@livediagram/ui';
import type { PlanPalette } from './plan-palette';

export function SetupStepper<Id extends string>({
  steps,
  at,
  palette,
  onStep,
}: {
  steps: readonly { id: Id; label: string }[];
  // The current step's index.
  at: number;
  palette: PlanPalette;
  onStep: (id: Id) => void;
}) {
  return (
    <ol aria-label="Steps" className="@container flex items-start">
      {steps.map((x, i) => {
        const current = i === at;
        const done = i < at;
        const circle = (
          <GlyphDisc
            size={24}
            aria-hidden
            className={`shrink-0 text-[12px] font-semibold tabular-nums transition-colors motion-reduce:transition-none ${
              current || done ? 'bg-brand-500 text-white dark:bg-brand-600' : 'border'
            }`}
            style={
              current || done
                ? undefined
                : { borderColor: palette.cardBorder, color: palette.muted }
            }
          >
            {done ? <CheckIcon size={12} /> : String(i + 1)}
          </GlyphDisc>
        );
        const label = (
          <span
            className={`text-center text-[12px] leading-tight @md:text-left @md:text-[13px] ${
              current ? 'font-semibold' : 'font-medium'
            }`}
            style={{ color: current || done ? palette.text : palette.muted }}
          >
            {x.label}
          </span>
        );
        const body = 'flex flex-col items-center gap-1 @md:flex-row @md:gap-2';
        return (
          <Fragment key={x.id}>
            <li className="flex shrink-0" aria-current={current ? 'step' : undefined}>
              {done ? (
                <button
                  type="button"
                  className={`${body} cursor-pointer rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 hover:opacity-80`}
                  aria-label={`${x.label}, done: go back`}
                  onClick={() => onStep(x.id)}
                >
                  {circle}
                  {label}
                </button>
              ) : (
                <span className={`${body} px-1 py-0.5`}>
                  {circle}
                  {label}
                </span>
              )}
            </li>
            {i < steps.length - 1 ? (
              <li
                aria-hidden
                className="mx-1 mt-[15px] h-0.5 min-w-4 flex-1 rounded-full @md:mx-2 @md:mt-[15px]"
                style={{ backgroundColor: i < at ? 'var(--color-brand-500)' : palette.cardBorder }}
              />
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
