// What a wake of the plan's Automations did, counted (docs/specs/026-plan/automations.md "Telemetry"; blueprint
// automations.md "Run telemetry"). The tally is @liveworkspace/automations/room's; a plan's runs are counted under
// `Plan`, each call written out here so the dashboard's emitter scan reads it. Only fixed tokens go in: never a rule's
// name, a card or the plan.
import { pascalToken, type TelemetryAction, type TelemetryCategory } from '@liveplanner/api-schema';
import type { AutomationResult, AutomationTriggerKind } from '@liveplanner/items';
import {
  AUTOMATION_TRIGGER_TYPE_PREFIX,
  AutomationTally as Tally,
} from '@liveworkspace/automations/room';
import { reportServerEvents } from '../../server-telemetry';
import type { Env } from '../../types';

export class AutomationTally extends Tally<TelemetryCategory, TelemetryAction> {}

// The tally's events so far, posted as one batch to liveplanner's telemetry.
export const flushTally = (tally: AutomationTally, env: Env): Promise<void> =>
  tally.flush((events) => reportServerEvents(env, events));

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
  tally.track('Plan', 'Ran', `${AUTOMATION_TRIGGER_TYPE_PREFIX}${pascalToken(trigger)}`);
}
