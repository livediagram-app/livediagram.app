'use client';

// The Repeat dialog (docs/specs/026-plan/items.md "Repeating cards"): Every (Day, Weekday, Week, Month), the week's
// days as toggles Monday first or the month's date, Ends (Never or On a date), Lands In (Starting State or a column),
// then Cancel and Repeat, or Save and Stop Repeating on a card that already repeats. The choices live in
// repeat-draft.ts; the caller stamps the setter's day and time zone and saves.
import { useId, useState } from 'react';
import {
  REPEAT_EVERY,
  mondayFirst,
  ordinal,
  weekdayWord,
  type RepeatEvery,
  type RepeatRule,
} from '@liveplanner/items';
import {
  ACTIVE_SEGMENT,
  Button,
  CheckIcon,
  CloseIcon,
  DateInput,
  SEGMENT_TRACK,
  Select,
} from '@liveplanner/ui';
import { SegmentSlider } from '@liveworkspace/workbench/components/primitives/SegmentSlider';
import { PlanModal, SheetRow } from './PlanModal';
import { PlanTypeGlyph } from './plan-type-glyph';
import { draftProblem, draftRule, repeatDraft, toggleDay, untilFor } from './repeat-draft';

const EVERY_LABEL: Record<RepeatEvery, string> = {
  day: 'Day',
  weekday: 'Weekday',
  week: 'Week',
  month: 'Month',
};
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DATES = Array.from({ length: 31 }, (_, i) => i + 1);
const ENDS = [
  { on: false, label: 'Never' },
  { on: true, label: 'On a date' },
];

const segment = (active: boolean) =>
  `relative z-10 flex min-w-0 items-center justify-center rounded-md px-1.5 py-1.5 text-[12px] font-semibold transition-colors ${
    active
      ? 'text-white'
      : // slate-600: slate-500 reads 4.3:1 on the slate-100 track, under AA for 12px text.
        'cursor-pointer text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
  }`;

export function RepeatDialog({
  rule,
  statuses,
  today,
  timeZone,
  onSave,
  onStop,
  onClose,
}: {
  // The card's rule when it repeats already (Save and Stop Repeating), else undefined (Repeat).
  rule: RepeatRule | undefined;
  // Lands In's columns, by name.
  statuses: readonly { status: string; name: string }[];
  // The setter's day and time zone, stamped on the saved rule.
  today: string;
  timeZone: string;
  onSave: (rule: RepeatRule) => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const base = useId();
  const [draft, setDraft] = useState(() => repeatDraft(rule, today));
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const problem = draftProblem(draft, today);
  const save = () => {
    const next = draftRule(draft, today, timeZone);
    if (next) onSave(next);
  };
  // A rule naming a column no board shows any more still offers it, so Save keeps it.
  const columns =
    draft.status && !statuses.some((s) => s.status === draft.status)
      ? [...statuses, { status: draft.status, name: draft.status }]
      : statuses;
  return (
    <PlanModal
      label="Repeat"
      onClose={onClose}
      header={
        <h2 className="flex items-center gap-2 truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
          <PlanTypeGlyph glyph="repeat" size={15} />
          Repeat
        </h2>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="mb-4 text-[13px] text-slate-600 dark:text-slate-300">
          A fresh copy of this card is made on each day the rule names, starting after today.
        </p>
        <SheetRow label="Every">
          <div
            role="radiogroup"
            aria-label="Every"
            className={`relative grid grid-cols-4 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
          >
            <SegmentSlider
              count={REPEAT_EVERY.length}
              index={REPEAT_EVERY.indexOf(draft.every)}
              className={ACTIVE_SEGMENT}
            />
            {REPEAT_EVERY.map((every) => (
              <button
                key={every}
                type="button"
                role="radio"
                aria-checked={draft.every === every}
                onClick={() => set({ every })}
                className={segment(draft.every === every)}
              >
                <span className="truncate">{EVERY_LABEL[every]}</span>
              </button>
            ))}
          </div>
        </SheetRow>
        {draft.every === 'week' ? (
          <SheetRow label="On">
            <div role="group" aria-label="Days of the week" className="grid grid-cols-7 gap-1">
              {[...WEEK].sort(mondayFirst).map((day) => {
                const on = draft.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ days: toggleDay(draft.days, day) })}
                    className={`h-8 min-w-0 cursor-pointer rounded-md text-[12px] font-semibold transition-colors ${
                      on
                        ? ACTIVE_SEGMENT
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {weekdayWord(day)}
                  </button>
                );
              })}
            </div>
          </SheetRow>
        ) : null}
        {draft.every === 'month' ? (
          <SheetRow label="On the" htmlFor={`${base}-date`}>
            <Select
              id={`${base}-date`}
              className="w-full"
              selectClassName="text-[13px]"
              value={draft.date}
              onChange={(e) => set({ date: Number(e.target.value) })}
            >
              {DATES.map((d) => (
                <option key={d} value={d}>
                  {ordinal(d)}
                </option>
              ))}
            </Select>
            {draft.date > 28 ? (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                A shorter month repeats on its last day.
              </p>
            ) : null}
          </SheetRow>
        ) : null}
        <SheetRow label="Ends">
          <div
            role="radiogroup"
            aria-label="Ends"
            className={`relative grid grid-cols-2 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
          >
            <SegmentSlider
              count={ENDS.length}
              index={draft.until === null ? 0 : 1}
              className={ACTIVE_SEGMENT}
            />
            {ENDS.map((e) => {
              const active = (draft.until !== null) === e.on;
              return (
                <button
                  key={e.label}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    if (!active) set({ until: untilFor(e.on, today) });
                  }}
                  className={segment(active)}
                >
                  {e.label}
                </button>
              );
            })}
          </div>
          {draft.until !== null ? (
            <DateInput
              aria-label="Last day"
              className="mt-2"
              compact
              value={draft.until}
              onCommit={(day) => set({ until: day ?? today })}
            />
          ) : null}
        </SheetRow>
        <SheetRow label="Lands In" htmlFor={`${base}-status`}>
          <Select
            id={`${base}-status`}
            className="w-full"
            selectClassName="text-[13px]"
            value={draft.status}
            onChange={(e) => set({ status: e.target.value })}
          >
            <option value="">Starting State</option>
            {columns.map((s) => (
              <option key={s.status} value={s.status}>
                {s.name}
              </option>
            ))}
          </Select>
        </SheetRow>
        {problem ? (
          <p className="mt-3 text-[12px] text-red-600 dark:text-red-400" role="note">
            {problem}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {rule ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mr-auto"
              onClick={onStop}
            >
              Stop Repeating
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            <CloseIcon size={12} />
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!!problem}>
            <CheckIcon size={12} />
            {rule ? 'Save' : 'Repeat'}
          </Button>
        </div>
      </form>
    </PlanModal>
  );
}
