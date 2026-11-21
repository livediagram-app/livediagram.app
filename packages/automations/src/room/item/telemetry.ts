// What a wake of an item's Automations did, counted under the app's own category (liveworkspace/docs/specs/018-
// automations/automations.md "Telemetry"; blueprint item-engine.md "Wiring an app" 13). Only fixed tokens: never a
// rule's name, a tab or the item.
import { pascalToken } from '@liveworkspace/telemetry/error-tokens';
import type { AutomationResult } from '../../types';
import { AUTOMATION_TRIGGER_TYPE_PREFIX, type AutomationTally } from '../automation-telemetry';

export const ITEM_TELEMETRY_ACTION = 'Ran';

const RESULT_TYPES: Readonly<Record<AutomationResult, string>> = {
  done: 'AutomationDone',
  failed: 'AutomationFailed',
  skipped: 'AutomationSkipped',
  waiting: 'AutomationWaiting',
  no_match: 'AutomationNoMatch',
};

/** A finished run: its result and its trigger's kind. */
export function tallyItemRun(
  tally: AutomationTally,
  category: string,
  result: AutomationResult,
  trigger: string,
): void {
  tally.track(category, ITEM_TELEMETRY_ACTION, RESULT_TYPES[result]);
  tally.track(
    category,
    ITEM_TELEMETRY_ACTION,
    `${AUTOMATION_TRIGGER_TYPE_PREFIX}${pascalToken(trigger)}`,
  );
}
