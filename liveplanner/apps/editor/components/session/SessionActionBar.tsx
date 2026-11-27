'use client';

// A Session tab's action bar under the card (docs/specs/026-plan/session-tabs.md "The action bar"): for the
// facilitator, Skip and Flag, where Refined takes the card, the timebox's time left and the Refined fill button; a
// decided card's outcome with Undo Outcome; for everyone else, who is running the session.
import type { Ref } from 'react';
import { isFlagged, type Item } from '@liveplanner/items';
import type { SessionDecision } from '@liveplanner/project';
import { FillActionButton } from './FillActionButton';
import { OUTCOME_LOOKS } from './session-kinds';
import type { SessionTimebox } from './useSessionTimebox';

// m:ss, for the time left.
export const clockOf = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const secondary =
  'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

export function SessionActionBar({
  item,
  decision,
  runs,
  holderName,
  targetName,
  statusName,
  timebox,
  refineRef,
  onDecide,
  onUndo,
}: {
  item: Item;
  decision: SessionDecision | undefined;
  // This screen runs the session.
  runs: boolean;
  // Who runs it, for everyone else; null while nobody does.
  holderName: string | null;
  // Where Refined takes the card (a column's name), or null when it stays.
  targetName: string | null;
  // The card's own column's name.
  statusName: string;
  timebox: SessionTimebox;
  refineRef?: Ref<HTMLButtonElement>;
  onDecide: (outcome: 'refined' | 'skipped' | 'flagged') => void;
  onUndo: () => void;
}) {
  const shell =
    'flex min-h-16 flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/95';
  if (decision) {
    const look = OUTCOME_LOOKS[decision.outcome];
    return (
      <div className={shell} role="group" aria-label="Outcome">
        <span className="inline-flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
          <span style={{ color: look.colour }}>
            <look.Icon size={16} aria-hidden />
          </span>
          {look.done}
          {decision.by ? ` by ${decision.by}` : ''}
        </span>
        <span className="flex-1" />
        {runs ? (
          <button type="button" className={secondary} onClick={onUndo}>
            Undo Outcome
          </button>
        ) : null}
      </div>
    );
  }
  if (!runs) {
    return (
      <div className={shell} role="status">
        <span className="text-[13px] text-slate-600 dark:text-slate-300">
          {holderName ? `${holderName} is running this session` : 'Nobody is running this session'}
        </span>
      </div>
    );
  }
  const Skip = OUTCOME_LOOKS.skipped.Icon;
  const Flag = OUTCOME_LOOKS.flagged.Icon;
  return (
    <div className={shell} role="group" aria-label="Session actions">
      <button
        type="button"
        className={secondary}
        onClick={() => onDecide('skipped')}
        aria-keyshortcuts="S"
      >
        <Skip size={15} aria-hidden />
        Skip
      </button>
      {isFlagged(item) ? null : (
        <button
          type="button"
          className={secondary}
          onClick={() => onDecide('flagged')}
          aria-keyshortcuts="F"
        >
          <span style={{ color: OUTCOME_LOOKS.flagged.colour }}>
            <Flag size={15} aria-hidden />
          </span>
          Flag
        </button>
      )}
      <span className="min-w-0 flex-1 truncate px-2 text-[13px] text-slate-500 max-sm:basis-full max-sm:order-first max-sm:px-0 dark:text-slate-400">
        {targetName ? (
          <>
            Moves to{' '}
            <strong className="font-semibold text-slate-800 dark:text-slate-100">
              {targetName}
            </strong>
          </>
        ) : (
          <>
            Stays in{' '}
            <strong className="font-semibold text-slate-800 dark:text-slate-100">
              {statusName}
            </strong>
            : its type has no later stage
          </>
        )}
      </span>
      {timebox ? (
        <span
          className={`tabular-nums text-[13px] font-medium ${timebox.up ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}
          role="timer"
          aria-label={timebox.up ? 'Time’s up' : `${clockOf(timebox.leftMs)} left`}
        >
          {timebox.up ? 'Time’s up' : clockOf(timebox.leftMs)}
        </span>
      ) : null}
      <FillActionButton
        ref={refineRef}
        label="Refined"
        shortcut="r"
        onConfirm={() => onDecide('refined')}
      />
    </div>
  );
}
