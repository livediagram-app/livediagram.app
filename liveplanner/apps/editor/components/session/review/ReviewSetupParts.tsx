'use client';

// Set Up Sprint Review's own parts (docs/specs/026-plan/session-tabs.md "Sprint Review"): the Done Range (chips for
// since the last review, 7, 14 and 30 days and all time, then From and To dates) and the Presenter (the assignee, or
// none). The range is kept as dates, so a running session's queue holds still.
import { useState } from 'react';
import { DAY_MS, doneRangeFrom, type ReviewRangePreset } from '@liveplanner/items';
import type { SessionSetup } from '@liveplanner/project';
import { ChoicePills } from '@/components/primitives/ChoicePills';

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const DATE =
  'h-8 rounded-md border border-slate-200 bg-white px-2 text-[13px] tabular-nums dark:border-slate-700 dark:bg-slate-900 dark:[color-scheme:dark]';
// A chip reads pressed while the range starts within this of its date (the dialog's own clock moved on meanwhile).
const NEAR_MS = 60_000;

const DAY_CHIPS: readonly { id: ReviewRangePreset; label: string }[] = [
  { id: '7', label: 'Last 7 Days' },
  { id: '14', label: 'Last 14 Days' },
  { id: '30', label: 'Last 30 Days' },
  { id: 'all', label: 'All Time' },
];

// A moment as a date field's value (local), and back: From is the day's start, To its end.
export const dateValue = (ms: number | undefined): string => {
  if (ms === undefined) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const dayStart = (value: string): number | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : undefined;
};

// The range the set-up keeps: `since` and `until` set, or each dropped when undefined.
export function withRange(
  s: SessionSetup,
  since: number | undefined,
  until: number | undefined,
): SessionSetup {
  const { since: _s, until: _u, ...rest } = s;
  return {
    ...rest,
    ...(since !== undefined ? { since } : {}),
    ...(until !== undefined && (since === undefined || until >= since) ? { until } : {}),
  };
}

export function ReviewSetupParts({
  id,
  setup,
  lastReviewAt,
  onChange,
}: {
  // The dialog's id, the headings' ids built from it.
  id: string;
  setup: SessionSetup;
  // When the plan's last Sprint Review decided a card, or null (no Since Last Review chip).
  lastReviewAt: number | null;
  onChange: (change: (s: SessionSetup) => SessionSetup) => void;
}) {
  // The dialog's clock, read once as it opens.
  const [now] = useState(() => Date.now());
  const chips = lastReviewAt
    ? [{ id: 'since-last' as const, label: 'Since Last Review' }, ...DAY_CHIPS]
    : DAY_CHIPS;
  const pressed = (preset: string) => {
    if (setup.until !== undefined) return false;
    const from = doneRangeFrom(preset as ReviewRangePreset, now, lastReviewAt);
    if (from === undefined || setup.since === undefined) return from === setup.since;
    return Math.abs(from - setup.since) < NEAR_MS;
  };
  return (
    <>
      <section className="flex flex-col gap-2" aria-labelledby={`${id}-range`}>
        <h3 id={`${id}-range`} className={HEADING}>
          Done Range
        </h3>
        <ChoicePills
          label="Done range"
          data="session-range"
          pills={chips}
          pressed={pressed}
          onPick={(preset) =>
            onChange((s) =>
              withRange(
                s,
                doneRangeFrom(preset as ReviewRangePreset, now, lastReviewAt),
                undefined,
              ),
            )
          }
        />
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate-600 dark:text-slate-300">
          <label className="inline-flex items-center gap-1.5">
            From
            <input
              type="date"
              className={DATE}
              value={dateValue(setup.since)}
              onChange={(e) => onChange((s) => withRange(s, dayStart(e.target.value), s.until))}
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            To
            <input
              type="date"
              className={DATE}
              value={dateValue(setup.until)}
              onChange={(e) => {
                const start = dayStart(e.target.value);
                onChange((s) =>
                  withRange(s, s.since, start === undefined ? undefined : start + DAY_MS - 1),
                );
              }}
            />
          </label>
          <span className="text-[12px] text-slate-500 dark:text-slate-400">
            By when each card entered its stage.
          </span>
        </div>
      </section>
      <section className="flex flex-col gap-2" aria-labelledby={`${id}-presenter`}>
        <h3 id={`${id}-presenter`} className={HEADING}>
          Presenter
        </h3>
        <ChoicePills
          label="Presenter"
          data="session-presenter"
          pills={[
            { id: 'assignee', label: 'Assignee' },
            { id: 'none', label: 'None' },
          ]}
          pressed={(p) => (p === 'none') === (setup.presenter === 'none')}
          onPick={(p) =>
            onChange((s) => {
              const { presenter: _p, ...rest } = s;
              return p === 'none' ? { ...rest, presenter: 'none' } : rest;
            })
          }
        />
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Each card’s assignee presents it; the facilitator can name someone else for a card.
        </p>
      </section>
    </>
  );
}
