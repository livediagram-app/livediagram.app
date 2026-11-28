'use client';

// Set Up Sprint Planning's Capacity (docs/specs/026-plan/session-tabs.md "Sprint Planning"): an optional number of
// estimate points the committed cards are tallied against, empty for none. Also the note under Card Types for a picked
// type with no Estimate field, whose cards always count as no estimate.
import type { ItemTypeDef } from '@liveplanner/items';
import { SESSION_CAPACITY_MAX, sessionCapacity } from '@liveplanner/project';
import { noEstimateNote, typesWithoutEstimate } from './planning-words';

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function CapacityPart({
  id,
  capacity,
  onChange,
}: {
  // The dialog's id, the heading's id built from it.
  id: string;
  capacity: number | undefined;
  onChange: (capacity: number | undefined) => void;
}) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby={`${id}-capacity`}>
      <h3 id={`${id}-capacity`} className={HEADING}>
        Capacity
      </h3>
      <label className="inline-flex flex-wrap items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={SESSION_CAPACITY_MAX}
          value={capacity ?? ''}
          placeholder="None"
          aria-label="Capacity in points"
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : sessionCapacity(Number(e.target.value)))
          }
          className="h-8 w-24 rounded-md border border-slate-200 bg-white px-2 text-[13px] tabular-nums dark:border-slate-700 dark:bg-slate-900"
        />
        points
        <span className="text-[12px] text-slate-500 dark:text-slate-400">
          Optional. The tally turns amber near it and red past it, and never stops a Commit.
        </span>
      </label>
    </section>
  );
}

// The note under Card Types: which picked types have no Estimate field, or nothing.
export function NoEstimateNote({ picked }: { picked: readonly ItemTypeDef[] }) {
  const note = noEstimateNote(typesWithoutEstimate(picked));
  return note ? (
    <p className="text-[12px] text-amber-700 dark:text-amber-400" data-no-estimate-note="">
      {note}
    </p>
  ) : null;
}
