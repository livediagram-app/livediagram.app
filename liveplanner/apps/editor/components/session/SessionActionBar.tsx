'use client';

// A Session tab's action bar under the card (docs/specs/026-plan/session-tabs.md "The action bar", "Sprint Planning",
// "Bug Triage"): for the facilitator, Undo Last once anything is decided, the kind's other outcomes (Refinement's Skip
// and Flag, Sprint Planning's Skip, Bug Triage's Skip and Flag), where the completing outcome takes the card, the
// timebox's time left, a closing outcome's button (Bug Triage's Close, which opens the close tray) and the completing
// outcome's fill button (Refined, Commit, Accept); a decided card's outcome, with its Close reason and duplicate, and
// Undo Outcome; for everyone else, who is running the session.
import type { Ref } from 'react';
import { isFlagged, type Item, type SessionKindId, type SessionOutcome } from '@liveplanner/items';
import { SESSION_KINDS, type SessionDecision } from '@liveplanner/project';
import { lucideUndo2 } from '@liveworkspace/icons/lucide';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { FillActionButton } from './FillActionButton';
import { OUTCOME_LOOKS } from './session-kinds';
import type { SessionTimebox } from './useSessionTimebox';

// m:ss, for the time left.
export const clockOf = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const UndoIcon = lucideGlyph(lucideUndo2, 14);

// Undo Last's chip: the latest decision named ("Closed BUG-33"), and what pressing it does.
export type SessionUndoLast = { label: string; onUndo: () => void };

// Close: the secondary button's shape in rose, apart from Skip and Flag so a closing decision reads as one.
const closeButton =
  'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-50 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-900/70 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40';

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
  note,
  last,
  onCloseOpen,
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
  // A decided card's own words after its outcome (a Close's duplicate and reason).
  note?: string | null | undefined;
  // Undo Last, the facilitator's, once anything is decided.
  last?: SessionUndoLast | null | undefined;
  // A kind with a closing outcome: opens its close tray.
  onCloseOpen?: (() => void) | undefined;
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
          <span>
            {look.done}
            {decision.by ? ` by ${decision.by}` : ''}
            {note ? (
              <span className="text-slate-500 dark:text-slate-400" data-decision-note="">
                {' · '}
                {note}
              </span>
            ) : null}
          </span>
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
  // Flag is offered only to a card not flagged already; the closing outcome has its own button by the fill button.
  const others = kind.outcomes.filter(
    (o) => o !== kind.completes && o !== kind.closes && !(o === 'flagged' && isFlagged(item)),
  );
  const completes = OUTCOME_LOOKS[kind.completes];
  const closes = kind.closes && onCloseOpen ? OUTCOME_LOOKS[kind.closes] : null;
  return (
    <div className={shell} role="group" aria-label="Session actions">
      {last ? (
        <Tooltip label={`Undo ${last.label} (U)`}>
          <button
            type="button"
            onClick={last.onUndo}
            aria-keyshortcuts="U"
            aria-label={`Undo ${last.label}`}
            data-undo-last=""
            className="inline-flex h-8 max-w-[14rem] cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 pl-2.5 pr-3 text-[12px] text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <UndoIcon aria-hidden className="shrink-0" />
            <span className="truncate text-optical-centre">{last.label}</span>
            <span className="shrink-0 font-semibold text-brand-700 text-optical-centre dark:text-brand-300">
              Undo
            </span>
          </button>
        </Tooltip>
      ) : null}
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
            {closes ? `${completes.label} moves to` : 'Moves to'}{' '}
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
            : no open stage comes after it
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
      {closes ? (
        <button
          type="button"
          className={closeButton}
          onClick={onCloseOpen}
          aria-keyshortcuts={closes.key.toUpperCase()}
          aria-haspopup="true"
        >
          <closes.Icon size={15} aria-hidden />
          {closes.label}
        </button>
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
