'use client';

// Sprint Planning's tally under the progress bar (docs/specs/026-plan/session-tabs.md "Sprint Planning"): the
// committed points against the capacity as words and a meter, the room's card's estimate as a lighter segment after
// them (what Commit would add), amber when near the capacity and red past it, with a capacity mark once over. Committed
// cards with no estimate are counted apart under it. It never stops a Commit.
import { capacityState, measureNumber, type SessionTally } from '@liveplanner/items';
import { capacityWords, pointsWord, tallyWords, unestimatedWords } from './planning-words';

// The meter's fill and its lighter "would add" segment, per state.
const TONES = {
  none: { fill: 'bg-brand-600 dark:bg-brand-500', add: 'bg-brand-300 dark:bg-brand-800', text: '' },
  under: {
    fill: 'bg-brand-600 dark:bg-brand-500',
    add: 'bg-brand-300 dark:bg-brand-800',
    text: '',
  },
  near: {
    fill: 'bg-amber-500',
    add: 'bg-amber-200 dark:bg-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
  },
  over: {
    fill: 'bg-red-600 dark:bg-red-500',
    add: 'bg-red-200 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-400',
  },
} as const;

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function PlanningTally({
  tally,
  capacity,
  adding,
}: {
  tally: SessionTally;
  capacity: number | undefined;
  // The room's card's estimate, still to decide; null when it has none or is decided.
  adding: number | null;
}) {
  const { points } = tally;
  const state = capacityState(points, capacity);
  const tone = TONES[state];
  const said = capacityWords(state, points, capacity);
  // The meter's whole: the capacity, or what is committed (and would be) once past it.
  const whole = Math.max(capacity ?? 0, points + (adding ?? 0), 1);
  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
      data-tally-state={state}
    >
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-semibold text-slate-800 dark:text-slate-100">Committed</span>
        <span className="tabular-nums text-slate-600 dark:text-slate-300">
          <b className="font-semibold text-slate-900 dark:text-slate-50">{measureNumber(points)}</b>
          {capacity ? ` of ${pointsWord(capacity)}` : points === 1 ? ' point' : ' points'}
        </span>
      </div>
      {capacity ? (
        <div
          role="meter"
          aria-label="Committed points"
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={points}
          aria-valuetext={[tallyWords(points, capacity), said].filter(Boolean).join(', ')}
          className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        >
          <span
            className={`absolute inset-y-0 left-0 transition-[width] duration-200 ease-out motion-reduce:transition-none ${tone.fill}`}
            style={{ width: pct(points / whole) }}
          />
          {adding ? (
            <span
              data-tally-adding=""
              className={`absolute inset-y-0 transition-[left,width] duration-200 ease-out motion-reduce:transition-none ${tone.add}`}
              style={{ left: pct(points / whole), width: pct(adding / whole) }}
            />
          ) : null}
          {whole > capacity ? (
            // Where the capacity ends, once the meter runs past it.
            <span
              aria-hidden
              className="absolute inset-y-0 w-0.5 bg-slate-900/70 dark:bg-white/80"
              style={{ left: pct(capacity / whole) }}
            />
          ) : null}
        </div>
      ) : null}
      {said ? (
        <p className={`mt-1.5 text-[11px] font-medium ${tone.text}`} role="status">
          {said}
        </p>
      ) : null}
      {tally.unestimated ? (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
          {unestimatedWords(tally.unestimated)}
        </p>
      ) : null}
      {!capacity && points === 0 && !tally.unestimated ? (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          No capacity set: the points add up as you commit.
        </p>
      ) : null}
    </div>
  );
}

// Session Complete's line: "21 of 30 points committed".
export function PlanningSummary({
  tally,
  capacity,
}: {
  tally: SessionTally;
  capacity: number | undefined;
}) {
  const state = capacityState(tally.points, capacity);
  const said = capacityWords(state, tally.points, capacity);
  return (
    <p className="text-[13px] text-slate-600 dark:text-slate-300" data-tally-state={state}>
      {tallyWords(tally.points, capacity)} committed
      {said ? <span className={`font-medium ${TONES[state].text}`}> · {said}</span> : null}
      {tally.unestimated ? (
        <span className="block text-[12px] text-amber-700 dark:text-amber-400">
          {unestimatedWords(tally.unestimated)}
        </span>
      ) : null}
    </p>
  );
}
