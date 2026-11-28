'use client';

// One Plan AI turn (docs/specs/026-plan/plan-ai.md "The panel"): what was asked, the answer, the list of what its
// changes did (a tick for each made, a warning for the one that couldn't be), who answered, and the turn's Undo.
import { memo } from 'react';
import { SparkleIcon } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import type { PlanAiTurnView } from './plan-ai-thread';

const UNDO_BUTTON =
  'touch-target relative shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-slate-700 outline-none ring-1 ring-inset ring-slate-200 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white';

function Tick() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-[3px] size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Warn() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-[3px] size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
    >
      <path
        d="M8 2.5l6 11H2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 6.5v3M8 11.5v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export const PlanAiTurn = memo(function PlanAiTurn({
  turn,
  answered,
  canUndo,
  onUndo,
  onAskAgain,
}: {
  turn: PlanAiTurnView;
  answered: string | null;
  canUndo: boolean;
  onUndo: () => void;
  onAskAgain: () => void;
}) {
  const made = turn.lines.filter((l) => l.ok).length;
  return (
    <div data-plan-ai-turn={turn.id} data-status={turn.status} className="flex flex-col gap-3">
      <p className="max-w-[86%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-[4px] bg-brand-700 px-3 py-2 text-sm leading-5 text-white dark:bg-brand-600">
        <span className="sr-only">You asked: </span>
        {turn.instruction}
      </p>
      {turn.status === 'failed' ? null : (
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-px flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30"
          >
            <SparkleIcon size={13} />
          </span>
          <article
            aria-label="Answer"
            aria-busy={turn.status === 'asking'}
            className="min-w-0 flex-1 text-sm leading-[23px] text-slate-800 dark:text-slate-200"
          >
            {turn.status === 'asking' ? (
              <span
                role="status"
                className="text-slate-600 motion-safe:animate-pulse dark:text-slate-400"
              >
                Working on it…
              </span>
            ) : turn.status === 'stopped' ? (
              <p className="text-[12.5px] leading-5 text-slate-600 dark:text-slate-400">
                Stopped. Nothing was changed.
              </p>
            ) : (
              <p className="whitespace-pre-wrap break-words">{turn.reply}</p>
            )}
            {turn.lines.length ? (
              <div
                data-plan-ai-changes=""
                className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {turn.undone ? 'Undone' : made === 1 ? '1 Change' : `${made} Changes`}
                </p>
                <ul
                  className={`mt-1 flex flex-col gap-1 ${turn.undone ? 'line-through opacity-60' : ''}`}
                >
                  {turn.lines.map((l, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[13px] leading-5"
                      data-ok={l.ok}
                    >
                      {l.ok ? <Tick /> : <Warn />}
                      <span className="sr-only">{l.ok ? 'Done: ' : 'Not done: '}</span>
                      <span className="min-w-0 flex-1 break-words">{l.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {turn.status === 'done' ? (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600 dark:text-slate-400">
                  {answered ? (
                    <>
                      <span className="sr-only">Answered by </span>
                      {answered}
                    </>
                  ) : null}
                </span>
                {canUndo ? (
                  <button
                    type="button"
                    data-plan-ai-undo=""
                    onClick={onUndo}
                    className={UNDO_BUTTON}
                  >
                    Undo
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>
      )}
      {turn.status === 'failed' && turn.failure ? (
        <Callout
          tone="warning"
          size="md"
          role="alert"
          title="That Could Not Be Done"
          action={{ label: 'Try Again', onSelect: onAskAgain }}
        >
          {turn.failure.message}
        </Callout>
      ) : null}
    </div>
  );
});
