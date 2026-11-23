'use client';

// One run in the Audit Trail (liveplanner/docs/specs/026-plan/automations.md "The Automations screen": Audit Trail):
// When, Rule, what it was about, Result, Took and a chevron that opens its steps. A skipped or failed run says why
// under the row; a waiting one, when it goes on. On a phone the row stacks. What a run is about, how it is said in
// short and where it opens are the app's (kit.audit).

import { useId, useState } from 'react';
import { ChevronDownIcon, Chip } from '@liveworkspace/ui';
import { useAutomationsKit } from './kit-context';
import { RunSteps } from './RunSteps';
import { RESULT_LABELS, RESULT_PILL, nextRunWords, runWhen, tookWords } from './run-words';
import type { ListedRun } from './types';

type Subject = { id: string; title: string } | null;

export const RUN_GRID =
  'grid grid-cols-[96px_minmax(0,1.2fr)_minmax(0,1.4fr)_112px_72px_40px] items-center gap-4';

export function ResultPill({ result }: { result: ListedRun['result'] }) {
  return (
    <Chip
      data-run-result={result}
      icon={<span aria-hidden className="size-1.5 rounded-full bg-current" />}
      className={`gap-1.5 whitespace-nowrap px-2.5 py-0.5 text-[12px] font-semibold leading-4 ${RESULT_PILL[result]}`}
    >
      {RESULT_LABELS[result]}
    </Chip>
  );
}

function SubjectRef({ subject }: { subject: Subject }) {
  const { audit } = useAutomationsKit();
  const refOf = audit.useRef();
  if (!subject) return <span className="text-slate-500 dark:text-slate-400">{audit.none}</span>;
  return (
    <span className="min-w-0 truncate">
      <span className="mr-1.5 tabular-nums text-slate-500 dark:text-slate-400">
        {refOf(subject)}
      </span>
      {subject.title}
    </span>
  );
}

const reasonTone = (run: ListedRun) =>
  run.result === 'failed'
    ? 'text-red-700 dark:text-red-300'
    : run.result === 'waiting'
      ? 'text-sky-700 dark:text-sky-300'
      : 'text-amber-800 dark:text-amber-300';

export function RunRow({
  run,
  now,
  phone,
  defaultOpen = false,
  onOpenSubject,
}: {
  run: ListedRun;
  now: number;
  phone: boolean;
  defaultOpen?: boolean;
  // Opens what the run was about (and closes the screen); absent: no link.
  onOpenSubject?: ((id: string) => void) | undefined;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const stepsId = useId();
  const { audit, sentence } = useAutomationsKit();
  const refOf = audit.useRef();
  const reason =
    run.result === 'waiting' && run.waitsUntil !== undefined
      ? `Goes on ${nextRunWords(run.waitsUntil, now)}`
      : run.reason && (run.result === 'failed' || run.result === 'skipped')
        ? sentence.gone(run.reason, run.gone)
        : null;
  const subject: Subject = audit.subjectOf(run);
  const openSubject = subject && onOpenSubject ? () => onOpenSubject(subject.id) : undefined;
  const chevron = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={stepsId}
      aria-label={`${open ? 'Collapse' : 'Expand'} run: ${run.ruleName}${subject ? `, ${refOf(subject)}` : ''}`}
      onClick={() => setOpen((v) => !v)}
      className="flex size-7 cursor-pointer after:absolute after:inset-0 after:rounded-xl after:content-[''] items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
        <div className="relative flex items-start gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-semibold text-slate-900 dark:text-slate-50">
              {run.ruleName}
            </span>
            <SubjectRef subject={subject} />
            <span className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
              <ResultPill result={run.result} />
              {runWhen(run.at, now)} · {tookWords(run.tookMs)}
            </span>
          </div>
          {chevron}
        </div>
      ) : (
        <div className={`${RUN_GRID} relative px-4 py-3`}>
          <span className="tabular-nums">{runWhen(run.at, now)}</span>
          <span className="truncate font-semibold text-slate-900 dark:text-slate-50">
            {run.ruleName}
          </span>
          <SubjectRef subject={subject} />
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
        {open ? <RunSteps steps={run.steps} openSubject={openSubject} /> : null}
      </div>
    </li>
  );
}
