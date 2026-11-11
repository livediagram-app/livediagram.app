'use client';

// One run in the Run Log (docs/specs/026-plan/automations.md "The Automations screen": Run Log): When, Rule, Card
// (its number and title), Result as a pill, Took, and the chevron that opens its steps. A failed or skipped run shows
// its reason under it. An open row is tinted violet, its steps under it. On a phone the parts stack.

import { useId, useState } from 'react';
import type { AutomationRun } from '@liveplanner/items';
import { ChevronDownIcon } from '@liveplanner/ui';
import { RunSteps } from './RunSteps';
import { RESULT_LABELS, RESULT_PILL, runWhen, tookWords } from './run-words';

export const RUN_GRID =
  'grid grid-cols-[96px_minmax(0,1.2fr)_minmax(0,1.4fr)_112px_72px_40px] items-center gap-4';

export function ResultPill({ result }: { result: AutomationRun['result'] }) {
  return (
    <span
      data-run-result={result}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold leading-4 ${RESULT_PILL[result]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {RESULT_LABELS[result]}
    </span>
  );
}

function CardRef({ card }: { card: AutomationRun['card'] }) {
  if (!card) return <span className="text-slate-500 dark:text-slate-400">No card</span>;
  return (
    <span className="min-w-0 truncate">
      <span className="mr-1.5 tabular-nums text-slate-500 dark:text-slate-400">#{card.key}</span>
      {card.title}
    </span>
  );
}

const reasonTone = (run: AutomationRun) =>
  run.result === 'failed' ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300';

export function RunRow({
  run,
  now,
  phone,
  defaultOpen = false,
  onOpenCard,
}: {
  run: AutomationRun;
  now: number;
  phone: boolean;
  defaultOpen?: boolean;
  // Opens the run's card (and closes the screen); absent: no Open Card.
  onOpenCard?: ((cardId: string) => void) | undefined;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const stepsId = useId();
  const reason =
    run.reason && (run.result === 'failed' || run.result === 'skipped') ? run.reason : null;
  const card = run.card;
  const openCard = card && onOpenCard ? () => onOpenCard(card.id) : undefined;
  const chevron = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={stepsId}
      aria-label={open ? 'Collapse run' : 'Expand run'}
      onClick={() => setOpen((v) => !v)}
      className="touch-target relative flex size-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <span
        className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
      >
        <ChevronDownIcon />
      </span>
    </button>
  );
  const tint = open ? 'bg-brand-50/60 dark:bg-brand-500/[0.07]' : '';
  return (
    <li
      data-run-row={run.id}
      className={`rounded-xl border-b border-slate-100 text-[13px] text-slate-700 last:border-b-0 dark:border-slate-800 dark:text-slate-200 ${tint}`}
    >
      {phone ? (
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-semibold text-slate-900 dark:text-slate-50">
              {run.ruleName}
            </span>
            <CardRef card={card} />
            <span className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
              <ResultPill result={run.result} />
              {runWhen(run.at, now)} · {tookWords(run.tookMs)}
            </span>
          </div>
          {chevron}
        </div>
      ) : (
        <div className={`${RUN_GRID} px-4 py-3`}>
          <span className="tabular-nums">{runWhen(run.at, now)}</span>
          <span className="truncate font-semibold text-slate-900 dark:text-slate-50">
            {run.ruleName}
          </span>
          <CardRef card={card} />
          <span>
            <ResultPill result={run.result} />
          </span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            {tookWords(run.tookMs)}
          </span>
          <span className="flex justify-center">{chevron}</span>
        </div>
      )}
      {reason ? (
        <p
          data-run-reason=""
          className={`pb-3 text-[12px] ${reasonTone(run)} ${phone ? 'px-4' : 'pl-[128px] pr-4'}`}
        >
          {reason}
        </p>
      ) : null}
      <div id={stepsId} hidden={!open} className={`pb-4 ${phone ? 'px-4' : 'pl-[128px] pr-4'}`}>
        {open ? <RunSteps steps={run.steps} openCard={openCard} /> : null}
      </div>
    </li>
  );
}
