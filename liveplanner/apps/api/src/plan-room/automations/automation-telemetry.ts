// What a wake of the plan's Automations did, counted (docs/specs/026-plan/automations.md "Telemetry"; blueprint
// automations.md "Run telemetry"). A wake fills one tally and posts it once when it ends, so a busy plan is one
// request a wake however many rules ran. Only fixed tokens go in: never a rule's name, a card or the plan.
import { pascalToken, type TelemetryAction, type TelemetryCategory } from '@liveplanner/api-schema';
import type { AutomationResult, AutomationTriggerKind } from '@liveplanner/items';
import { TELEMETRY_BATCH_MAX, type TelemetryWireEvent } from '@liveworkspace/telemetry';
import { reportServerEvents } from '../../server-telemetry';
import type { Env } from '../../types';

const TRIGGER_PREFIX = 'AutomationTrigger.';

export class AutomationTally {
  // Results and trouble first, the trigger kinds after, so a wake past the batch cap drops the least telling.
  private readonly first: TelemetryWireEvent[] = [];
  private readonly after: TelemetryWireEvent[] = [];

  // A bound `track`, so the dashboard's emitter scan reads each literal call where it is made.
  track(category: TelemetryCategory, action: TelemetryAction, type: string): void {
    (type.startsWith(TRIGGER_PREFIX) ? this.after : this.first).push({ category, action, type });
  }

  get size(): number {
    return this.first.length + this.after.length;
  }

  // The events so far, at most one batch, emptying the tally. Nothing to send sends nothing.
  flush(env: Env): Promise<void> {
    const events = [...this.first, ...this.after].slice(0, TELEMETRY_BATCH_MAX);
    this.first.length = 0;
    this.after.length = 0;
    return events.length ? reportServerEvents(env, events) : Promise.resolve();
  }
}

// A finished run: its result and its trigger's kind.
export function tallyRun(
  tally: AutomationTally,
  result: AutomationResult,
  trigger: AutomationTriggerKind,
): void {
  switch (result) {
    case 'done':
      tally.track('Plan', 'Ran', 'AutomationDone');
      break;
    case 'failed':
      tally.track('Plan', 'Ran', 'AutomationFailed');
      break;
    case 'skipped':
      tally.track('Plan', 'Ran', 'AutomationSkipped');
      break;
    case 'waiting':
      tally.track('Plan', 'Ran', 'AutomationWaiting');
      break;
    case 'no_match':
      tally.track('Plan', 'Ran', 'AutomationNoMatch');
      break;
  }
  tally.track('Plan', 'Ran', `${TRIGGER_PREFIX}${pascalToken(trigger)}`);
}
