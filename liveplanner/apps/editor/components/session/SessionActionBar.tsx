'use client';

// A Session tab's action bar under the card (docs/specs/026-plan/session-tabs.md "The action bar", "Sprint Planning",
// "Bug Triage"): for the facilitator, Undo Last once anything is decided, the kind's other outcomes (Refinement's Skip
// and Flag, Sprint Planning's Skip, Bug Triage's Skip and Flag), where the completing outcome takes the card, the
// timebox's time left, a closing outcome's button (Bug Triage's Close, which opens the Close dialog) and the completing
// outcome's fill button (Refined, Commit, Accept); a decided card's outcome, with its Close reason and duplicate, and
// Undo Outcome; for everyone else, who is running the session.
import type { ReactNode, Ref } from 'react';
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

export const BAR_SHELL =
  'flex min-h-16 flex-wrap items-center gap-2 border-t max-sm:gap-x-2 max-sm:gap-y-1.5 max-sm:py-2.5 border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 xl:pr-[20rem] dark:border-slate-800 dark:bg-slate-900/95';
export const secondary =
  'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
// On a phone the other outcomes are square icon buttons (their names read to a screen reader), so they and the fill
// button share one row and the card keeps the screen.
export const compact = `${secondary} shrink-0 max-sm:w-10 max-sm:justify-center max-sm:px-0`;
export const PHONE_HIDDEN = 'max-sm:sr-only';

// Undo Last (docs/specs/026-plan/session-tabs.md "Undo"): the latest decision named ("Closed BUG-33") with Undo, in the
// action bar and on Session Complete; a round icon button on a phone.
export function UndoLastChip({ last }: { last: SessionUndoLast }) {
  return (
    <Tooltip label={`Undo ${last.label} (U)`}>
      <button
        type="button"
        onClick={last.onUndo}
        aria-keyshortcuts="U"
        aria-label={`Undo ${last.label}`}
        data-undo-last=""
        className="inline-flex h-8 max-w-[14rem] shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 pl-2.5 pr-3 text-[12px] text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:size-10 max-sm:justify-center max-sm:p-0 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <UndoIcon aria-hidden className="shrink-0" />
        <span className={`truncate text-optical-centre ${PHONE_HIDDEN}`}>{last.label}</span>
        <span
          className={`shrink-0 font-semibold text-brand-700 text-optical-centre dark:text-brand-300 ${PHONE_HIDDEN}`}
        >
          Undo
        </span>
      </button>
    </Tooltip>
  );
}

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
  extra,
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
  // A kind with a closing outcome: opens its Close dialog.
  onCloseOpen?: (() => void) | undefined;
  // A kind's own action after its other outcomes (Sprint Review's Follow-up), for the facilitator.
  extra?: ReactNode;
  onDecide: (outcome: SessionOutcome) => void;
  onUndo: () => void;
}) {
  const shell = BAR_SHELL;
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
      {last ? <UndoLastChip last={last} /> : null}
      {others.map((o) => {
        const look = OUTCOME_LOOKS[o];
        return (
          <button
            key={o}
            type="button"
            className={compact}
            onClick={() => onDecide(o)}
            aria-keyshortcuts={look.key.toUpperCase()}
          >
            {/* Skip's arrow takes the text's colour; Flag's is the flag colour. */}
            <span style={o === 'skipped' ? undefined : { color: look.colour }}>
              <look.Icon size={15} aria-hidden />
            </span>
            <span className={PHONE_HIDDEN}>{look.label}</span>
          </button>
        );
      })}
      {extra}
      <span className="min-w-0 flex-1 truncate px-2 text-[13px] text-slate-500 max-sm:basis-full max-sm:order-first max-sm:px-0 max-sm:text-[12px] dark:text-slate-400">
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
            {kind.stays ? null : ': no open stage comes after it'}
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
          // A close looks like any other action in its place (no red: docs/specs/004-interface-design).
          className={compact}
          onClick={onCloseOpen}
          aria-keyshortcuts={closes.key.toUpperCase()}
          aria-haspopup="dialog"
        >
          <closes.Icon size={15} aria-hidden />
          <span className={PHONE_HIDDEN}>{closes.label}</span>
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
