'use client';

// A Session tab's action bar under the card (docs/specs/026-plan/session-tabs.md "The action bar", "Sprint Planning"):
// for the facilitator, the kind's other outcomes (Refinement's Skip and Flag, Sprint Planning's Skip), where the
// completing outcome takes the card, the timebox's time left and that outcome's fill button (Refined, Commit); a
// decided card's outcome with Undo Outcome; for everyone else, who is running the session.
import type { Ref } from 'react';
import { isFlagged, type Item, type SessionKindId, type SessionOutcome } from '@liveplanner/items';
import { SESSION_KINDS, type SessionDecision } from '@liveplanner/project';
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
  sessionKind,
  item,
  decision,
  runs,
  holderName,
  targetName,
  statusName,
  timebox,
  completeRef,
  onDecide,
  onUndo,
}: {
  sessionKind: SessionKindId;
  item: Item;
  decision: SessionDecision | undefined;
  // This screen runs the session.
  runs: boolean;
  // Who runs it, for everyone else; null while nobody does.
  holderName: string | null;
  // Where the completing outcome takes the card (a column's name), or null when it stays.
  targetName: string | null;
  // The card's own column's name.
  statusName: string;
  timebox: SessionTimebox;
  // The fill button, which the kind's key presses so the fill plays.
  completeRef?: Ref<HTMLButtonElement>;
  onDecide: (outcome: SessionOutcome) => void;
  onUndo: () => void;
}) {
  const shell =
    'flex min-h-16 flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 xl:pr-[20rem] dark:border-slate-800 dark:bg-slate-900/95';
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
  const kind = SESSION_KINDS[sessionKind];
  // Flag is offered only to a card not flagged already.
  const others = kind.outcomes.filter(
    (o) => o !== kind.completes && !(o === 'flagged' && isFlagged(item)),
  );
  const completes = OUTCOME_LOOKS[kind.completes];
  return (
    <div className={shell} role="group" aria-label="Session actions">
      {others.map((o) => {
        const look = OUTCOME_LOOKS[o];
        return (
          <button
            key={o}
            type="button"
            className={secondary}
            onClick={() => onDecide(o)}
            aria-keyshortcuts={look.key.toUpperCase()}
          >
            {/* Skip's arrow takes the text's colour; Flag's is the flag colour. */}
            <span style={o === 'skipped' ? undefined : { color: look.colour }}>
              <look.Icon size={15} aria-hidden />
            </span>
            {look.label}
          </button>
        );
      })}
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
        ref={completeRef}
        label={completes.label}
        shortcut={completes.key}
        onConfirm={() => onDecide(kind.completes)}
      />
    </div>
  );
}
