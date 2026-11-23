'use client';

// A time trigger's own fields (docs/specs/026-plan/automations.md "Time triggers"): Scheduled's Every (Day, Weekday,
// Week with its days, Month with its day) and At, which are the platform's (ScheduledPanel's parts); Due In's days
// and At; Overdue's At; Card Stuck's days and columns. Every time is on the quarter hour, in the time zone the rule
// is saved in, which a line under the fields names ("Times are Europe/London"). A time rule with no conditions runs
// on every card in the plan, so the panel warns while it has none; one that runs once for the plan (its snapshot steps)
// says so instead.

import {
  AUTOMATION_DUE_DAYS_MAX,
  AUTOMATION_STUCK_DAYS_MAX,
  isTimeTrigger,
  runsForPlan,
  type AutomationRuleBody,
  type AutomationTimeTrigger,
} from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideClock, lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { useRuleContext } from '@liveworkspace/automations-ui/rule-context';
import {
  ChipToggles,
  PanelField,
  PanelSelect,
} from '@liveworkspace/automations-ui/step-panels/panel-parts';
import {
  AtField,
  ScheduledFields,
  TimeZoneNote,
  withEvery as withScheduledEvery,
} from '@liveworkspace/automations-ui/step-panels/ScheduledPanel';
import { Callout } from '@liveworkspace/ui/callout';

export { QUARTER_HOURS } from '@liveworkspace/automations-ui/step-panels/ScheduledPanel';

const AlertIcon = lucideGlyph(lucideTriangleAlert, 13);
const ClockIcon = lucideGlyph(lucideClock, 13);

type Scheduled = AutomationTimeTrigger & { kind: 'scheduled' };

/** A time trigger's first form, as picking it from the Trigger list starts it: 9:00, on weekdays, or 2 days ahead. */
export function freshTimeTrigger(kind: AutomationTimeTrigger['kind']): AutomationTimeTrigger {
  if (kind === 'scheduled') return { kind, every: 'weekday', at: '09:00' };
  if (kind === 'due_in') return { kind, days: 2, at: '09:00' };
  if (kind === 'stuck') return { kind, days: 5, at: '09:00' };
  return { kind, at: '09:00' };
}

/** Scheduled with another Every: a week keeps its days (Monday when it has none), a month its day (the 1st). */
export const withEvery = (trigger: Scheduled, every: Scheduled['every']): Scheduled =>
  withScheduledEvery(trigger, every);

export function TimeTriggerPanel({
  trigger,
  onChange,
  timeZone,
  conditions,
  columns,
}: {
  trigger: AutomationTimeTrigger;
  onChange: (next: AutomationTimeTrigger) => void;
  // The plan's columns, for Card Stuck's In Columns.
  columns: readonly { value: string; label: string }[];
  // The zone the rule is saved in (this browser's), named under the fields.
  timeZone: string;
  // How many conditions the rule has: none, and the panel warns.
  conditions: number;
}) {
  const at = (next: string) => onChange({ ...trigger, at: next });
  return (
    <div className="flex flex-col gap-4">
      {trigger.kind === 'scheduled' ? (
        <ScheduledFields trigger={trigger} onChange={onChange} />
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
      <TimeZoneNote
        timeZone={timeZone}
        tail={trigger.kind === 'overdue' ? ', on the day after the card was due.' : '.'}
      />
      {conditions === 0 && trigger.kind !== 'stuck' ? <TimeRuleNote /> : null}
    </div>
  );
}

// The rule the builder holds: a Scheduled rule that runs for the plan (its snapshot steps) says so, not a warning.
function TimeRuleNote() {
  const body = useRuleContext().body as AutomationRuleBody | null;
  return body && runsForPlan(body) ? <ForPlanNote /> : <EveryCardWarning />;
}

/** What a Scheduled rule that runs once a moment for the plan says (spec "Snapshot steps"), in its panel and
 *  (`compact`) on its When card. */
export function ForPlanNote({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <span
        data-for-plan=""
        className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300"
      >
        <ClockIcon aria-hidden />
        Runs once for the plan, not for each card
      </span>
    );
  return (
    <Callout tone="info" title="Runs once for the plan, not for each card.">
      Its snapshot steps act on the whole plan, so it runs once each time, with no card.
    </Callout>
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
    <Callout tone="warning" title="Runs on every card in the plan.">
      Add a condition to pick the cards it runs on.
    </Callout>
  );
}

/** The When card's note (the platform's kit.sentence.TriggerNote): a time rule with no conditions says what it runs
 *  on. */
export function PlanTriggerNote({
  body,
  compact,
}: {
  body: AutomationRuleBody;
  compact?: boolean;
}) {
  if (!isTimeTrigger(body.trigger) || body.conditions.length > 0) return null;
  return runsForPlan(body) ? (
    <ForPlanNote compact={compact ?? false} />
  ) : (
    <EveryCardWarning compact={compact ?? false} />
  );
}
