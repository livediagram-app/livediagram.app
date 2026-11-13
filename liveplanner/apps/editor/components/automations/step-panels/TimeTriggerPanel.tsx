'use client';

// A time trigger's own fields (docs/specs/026-plan/automations.md "Time triggers"): Scheduled's Every (Day, Weekday,
// Week with its days, Month with its day) and At; Due In's days and At; Overdue's At. Every time is on the quarter
// hour, in the time zone the rule is saved in, which a line under the fields names ("Times are Europe/London"). A
// time rule with no conditions runs on every card in the plan, so the panel warns while it has none.

import {
  AUTOMATION_DUE_DAYS_MAX,
  AUTOMATION_STUCK_DAYS_MAX,
  clockWords,
  type AutomationClock,
  type AutomationTimeTrigger,
} from '@liveplanner/items';
import { SegmentedToggle, lucideGlyph, type SegmentedOption } from '@liveplanner/ui';
import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { ChipToggles, PanelField, PanelSelect } from './panel-parts';

const AlertIcon = lucideGlyph(lucideTriangleAlert, 13);

type Scheduled = AutomationTimeTrigger & { kind: 'scheduled' };
type Every = Scheduled['every'];

const EVERY: readonly SegmentedOption<Every>[] = [
  { value: 'day', label: 'Day', description: 'Every day of the week.' },
  { value: 'weekday', label: 'Weekday', description: 'Monday to Friday.' },
  { value: 'week', label: 'Week', description: 'On the days you pick, each week.' },
  { value: 'month', label: 'Month', description: 'On one day of each month.' },
];

// The week as the chips read it, Monday first; the values are the trigger's (0 Sunday … 6 Saturday).
const WEEK = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
] as const;

// Every quarter hour of the day, "00:00" to "23:45".
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

/** A time trigger's first form, as picking it from the Trigger list starts it: 9:00, on weekdays, or 2 days ahead. */
export function freshTimeTrigger(kind: AutomationTimeTrigger['kind']): AutomationTimeTrigger {
  if (kind === 'scheduled') return { kind, every: 'weekday', at: '09:00' };
  if (kind === 'due_in') return { kind, days: 2, at: '09:00' };
  if (kind === 'stuck') return { kind, days: 5, at: '09:00' };
  return { kind, at: '09:00' };
}

/** Scheduled with another Every: a week keeps its days (Monday when it has none), a month its day (the 1st). */
export function withEvery(trigger: Scheduled, every: Every): Scheduled {
  const { days: _days, dayOfMonth: _day, ...rest } = trigger;
  if (every === 'week') return { ...rest, every, days: trigger.days?.length ? trigger.days : [1] };
  if (every === 'month') return { ...rest, every, dayOfMonth: trigger.dayOfMonth ?? 1 };
  return { ...rest, every };
}

function AtField({ at, onChange }: { at: AutomationClock; onChange: (at: string) => void }) {
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

export function TimeTriggerPanel({
  trigger,
  onChange,
  timeZone,
  conditions,
  columns,
}: {
  trigger: AutomationTimeTrigger;
  onChange: (next: AutomationTimeTrigger) => void;
  // The plan's columns, which Card Stuck may narrow to.
  columns: readonly { value: string; label: string }[];
  // The zone the rule is saved in: this browser's.
  timeZone: string;
  // How many conditions the rule has: none, and the panel warns.
  conditions: number;
}) {
  const at = (next: string) => onChange({ ...trigger, at: next });
  return (
    <div className="flex flex-col gap-4">
      {trigger.kind === 'scheduled' ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              Every
            </span>
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
      ) : null}
      {trigger.kind === 'due_in' ? (
        <PanelField label="Days Before It’s Due">
          {(id) => (
            <PanelSelect
              id={id}
              value={String(trigger.days)}
              onChange={(e) => onChange({ ...trigger, days: Number(e.target.value) })}
            >
              {Array.from({ length: AUTOMATION_DUE_DAYS_MAX }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? '1 Day' : `${d} Days`}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
      {trigger.kind === 'stuck' ? (
        <>
          <PanelField label="Unchanged For" hint="Any change to the card starts the count again.">
            {(id) => (
              <PanelSelect
                id={id}
                value={String(trigger.days)}
                onChange={(e) => onChange({ ...trigger, days: Number(e.target.value) })}
              >
                {Array.from({ length: AUTOMATION_STUCK_DAYS_MAX }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? '1 Day' : `${d} Days`}
                  </option>
                ))}
              </PanelSelect>
            )}
          </PanelField>
          <ChipToggles
            label="In Columns"
            options={columns}
            value={trigger.statuses ?? []}
            hint="None picked: any column that is not done."
            gone="A column no longer here"
            onChange={(statuses) => {
              const { statuses: _s, ...rest } = trigger;
              onChange(statuses.length ? { ...rest, statuses } : rest);
            }}
          />
        </>
      ) : null}
      <AtField at={trigger.at} onChange={at} />
      <p data-time-zone="" className="text-[12px] text-slate-500 dark:text-slate-400">
        Times are {timeZone}
        {trigger.kind === 'overdue' ? ', on the day after the card was due.' : '.'}
      </p>
      {conditions === 0 && trigger.kind !== 'stuck' ? <EveryCardWarning /> : null}
    </div>
  );
}

/** The warning a time rule with no conditions wears, in its panel and (`compact`, one line) on its When card. */
export function EveryCardWarning({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <span
        data-every-card=""
        className="flex items-center gap-1.5 text-[12px] font-medium text-amber-800 dark:text-amber-300"
      >
        <AlertIcon aria-hidden />
        Runs on every card in the plan
      </span>
    );
  return (
    <p
      data-every-card=""
      className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <span className="mt-0.5 shrink-0">
        <AlertIcon aria-hidden />
      </span>
      <span>
        <span className="font-semibold">Runs on every card in the plan.</span> Add a condition to
        pick the cards it runs on.
      </span>
    </p>
  );
}
