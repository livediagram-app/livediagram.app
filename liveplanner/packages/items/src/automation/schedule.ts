// Automations: when a time trigger's moments come (docs/specs/026-plan/automations.md "Time triggers"). The sums are
// @liveworkspace/automations' (liveworkspace/docs/specs/018-automations/blueprints/engine.md "The schedule"): a
// Scheduled trigger falls on the days its recurrence does, Due In, Overdue and Card Stuck on every day, each at its
// quarter-hour time in the rule's time zone. Here, the plan's time triggers named. Pure.

import type { AutomationTimeTriggerKind, AutomationTrigger } from './types';

export {
  clockMinutes,
  clockWords,
  firesOn,
  latestMissed,
  momentOn,
  nextMoment,
} from '@liveworkspace/automations';

export type AutomationTimeTrigger = Extract<AutomationTrigger, { kind: AutomationTimeTriggerKind }>;
