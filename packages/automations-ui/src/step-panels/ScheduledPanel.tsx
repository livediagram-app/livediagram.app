'use client';

// The Scheduled trigger's fields (liveworkspace/docs/specs/018-automations/automations.md "Triggers every app has"):
// Every (Day, Weekday, Week, Month), the days of a week or the day of a month, At (on the quarter hour) and the line
// saying whose time zone the times are in. ScheduledPanel is the whole panel, for an app whose Scheduled has nothing
// more; an app with time triggers of its own builds theirs from the parts (AtField, TimeZoneNote).

import {
  clockWords,
  type AutomationClock,
  type AutomationScheduled,
} from '@liveworkspace/automations';
import { SegmentedToggle, type SegmentedOption } from '@liveworkspace/ui';
import type { TriggerPanelProps } from '../kit';
import { ChipToggles, PanelField, PanelSelect } from './panel-parts';

type Every = AutomationScheduled['every'];

const EVERY: readonly SegmentedOption<Every>[] = [
  { value: 'day', label: 'Day', description: 'Every day of the week.' },
  { value: 'weekday', label: 'Weekday', description: 'Monday to Friday.' },
  { value: 'week', label: 'Week', description: 'On the days you pick, each week.' },
  { value: 'month', label: 'Month', description: 'On one day of each month.' },
];

const WEEK = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
] as const;

export const QUARTER_HOURS: readonly AutomationClock[] = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0');
  const m = String((i % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
};

/** Scheduled's first form, as picking it starts it: weekdays at 9:00. */
export const freshScheduled = (): AutomationScheduled => ({
  kind: 'scheduled',
  every: 'weekday',
  at: '09:00',
});

/** Scheduled with another Every: a week keeps its days (Monday when it has none), a month its day (the 1st). */
export function withEvery<T extends AutomationScheduled>(trigger: T, every: Every): T {
  const { days: _days, dayOfMonth: _day, ...rest } = trigger;
  if (every === 'week')
    return { ...rest, every, days: trigger.days?.length ? trigger.days : [1] } as T;
  if (every === 'month') return { ...rest, every, dayOfMonth: trigger.dayOfMonth ?? 1 } as T;
  return { ...rest, every } as T;
}

/** At: a time of day, on the quarter hour. */
export function AtField({ at, onChange }: { at: AutomationClock; onChange: (at: string) => void }) {
  return (
    <PanelField label="At">
      {(id) => (
        <PanelSelect id={id} value={at} onChange={(e) => onChange(e.target.value)}>
          {QUARTER_HOURS.map((q) => (
            <option key={q} value={q}>
              {clockWords(q)}
            </option>
          ))}
        </PanelSelect>
      )}
    </PanelField>
  );
}

/** "Times are Europe/London." (`tail`: an app's own ending, in place of the full stop). */
export function TimeZoneNote({ timeZone, tail = '.' }: { timeZone: string; tail?: string }) {
  return (
    <p data-time-zone="" className="text-[12px] text-slate-500 dark:text-slate-400">
      Times are {timeZone}
      {tail}
    </p>
  );
}

/** Scheduled's own fields: Every, and the days of a week or the day of a month. */
export function ScheduledFields<T extends AutomationScheduled>({
  trigger,
  onChange,
}: {
  trigger: T;
  onChange: (next: T) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Every</span>
        <SegmentedToggle
          label="Every"
          value={trigger.every}
          options={EVERY}
          onChange={(every) => onChange(withEvery(trigger, every))}
          className="self-start"
        />
      </div>
      {trigger.every === 'week' ? (
        <ChipToggles
          label="On"
          options={WEEK}
          value={(trigger.days ?? []).map(String)}
          hint="Pick at least one day."
          onChange={(next) =>
            onChange({ ...trigger, days: next.map(Number).sort((a, b) => a - b) })
          }
        />
      ) : null}
      {trigger.every === 'month' ? (
        <PanelField
          label="On the"
          hint="Past the month’s end, its last day (the 31st is 30 April’s 30th)."
        >
          {(id) => (
            <PanelSelect
              id={id}
              value={String(trigger.dayOfMonth ?? 1)}
              onChange={(e) => onChange({ ...trigger, dayOfMonth: Number(e.target.value) })}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {ordinal(d)}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
    </>
  );
}

/** The Scheduled trigger's whole panel, for an app that adds nothing to it. */
export function ScheduledPanel({
  trigger,
  onChange,
  timeZone,
}: TriggerPanelProps<AutomationScheduled, unknown>) {
  return (
    <>
      <ScheduledFields trigger={trigger} onChange={onChange} />
      <AtField at={trigger.at} onChange={(at) => onChange({ ...trigger, at })} />
      <TimeZoneNote timeZone={timeZone} />
    </>
  );
}
