'use client';

// Stand-up's action bar under the card (docs/specs/026-plan/session-tabs.md "Stand-up", "Running it"): for the
// facilitator, Undo Last, Blocked (opens the Blocked dialog; only for a card not flagged yet) and the Stage picker on
// the left, the person line, the timebox's time left, and the person's Done fill button; a Done person's card reads who
// marked them Done with Undo Done instead of the fill button. Everyone else sees who is running the session. One row on
// a phone.
import type { Ref } from 'react';
import { lucideFlag } from '@liveworkspace/icons/lucide';
import { Select } from '@liveworkspace/ui';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { FLAG_COLOUR } from '@liveplanner/project';
import { FillActionButton } from '../FillActionButton';
import {
  BAR_SHELL,
  PHONE_HIDDEN,
  UndoLastChip,
  clockOf,
  compact,
  secondary,
  type SessionUndoLast,
} from '../SessionActionBar';
import type { SessionTimebox } from '../useSessionTimebox';

const FlagIcon = lucideGlyph(lucideFlag, 15);

export const DONE_KEY = 'd';
export const BLOCKED_KEY = 'b';

export function StandupActionBar({
  runs,
  holderName,
  name,
  line,
  cardRef,
  flagged,
  stage,
  stages,
  statusName,
  doneBy,
  timebox,
  last,
  completeRef,
  onBlocked,
  onStage,
  onDone,
  onUndoDone,
}: {
  // This screen runs the session.
  runs: boolean;
  holderName: string | null;
  // The room's person's name, and the line about where the room is ("Ana · card 1 of 3").
  name: string;
  line: string;
  cardRef: string;
  // The card is flagged already: Blocked is not offered.
  flagged: boolean;
  // The card's stage, the stages its type uses, and their names.
  stage: string;
  stages: readonly string[];
  statusName: (id: string) => string;
  // Who marked the person Done, or null while they are not.
  doneBy: string | null;
  timebox: SessionTimebox;
  last: SessionUndoLast | null;
  completeRef?: Ref<HTMLButtonElement>;
  onBlocked: () => void;
  onStage: (to: string) => void;
  onDone: () => void;
  onUndoDone: () => void;
}) {
  if (!runs) {
    return (
      <div className={BAR_SHELL} role="status">
        <span className="text-[13px] text-slate-600 dark:text-slate-300">
          {holderName ? `${holderName} is running this session` : 'Nobody is running this session'}
        </span>
      </div>
    );
  }
  return (
    <div className={BAR_SHELL} role="group" aria-label="Session actions">
      {last ? <UndoLastChip last={last} /> : null}
      {flagged ? null : (
        <Tooltip label={`Mark Blocked (${BLOCKED_KEY.toUpperCase()})`}>
          <button
            type="button"
            className={compact}
            onClick={onBlocked}
            aria-keyshortcuts={BLOCKED_KEY.toUpperCase()}
            aria-haspopup="dialog"
          >
            <span style={{ color: FLAG_COLOUR }}>
              <FlagIcon aria-hidden />
            </span>
            <span className={PHONE_HIDDEN}>Blocked</span>
          </button>
        </Tooltip>
      )}
      <Select
        aria-label={`Stage of ${cardRef}`}
        value={stage}
        onChange={(e) => onStage(e.target.value)}
        selectClassName="text-[13px]"
        className="w-40 shrink-0 max-sm:w-28"
      >
        {stages.map((s) => (
          <option key={s} value={s}>
            {statusName(s)}
          </option>
        ))}
      </Select>
      {/* The person line has a row of its own above the controls, so it reads in full (a long Blocked reason wraps
          to a second line) and the controls keep one row. */}
      <span
        className="order-first line-clamp-2 min-w-0 basis-full text-[13px] text-slate-500 max-sm:text-[12px] dark:text-slate-400"
        data-standup-line=""
      >
        {doneBy ? `${name} done by ${doneBy}` : line}
      </span>
      <span aria-hidden className="flex-1" />
      {timebox ? (
        <span
          className={`tabular-nums text-[13px] font-medium ${timebox.up ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}
          role="timer"
          aria-label={timebox.up ? 'Time’s up' : `${clockOf(timebox.leftMs)} left`}
        >
          {timebox.up ? 'Time’s up' : clockOf(timebox.leftMs)}
        </span>
      ) : null}
      {doneBy ? (
        <button type="button" className={secondary} onClick={onUndoDone}>
          Undo Done
        </button>
      ) : (
        <FillActionButton
          ref={completeRef}
          label="Done"
          name={`Done: ${name}`}
          shortcut={DONE_KEY}
          onConfirm={onDone}
        />
      )}
    </div>
  );
}
