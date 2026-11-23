// A plan's rules on its own SQLite (docs/specs/026-plan/automations.md "A rule"; blueprint automations.md "Files",
// "Storage"). The store is @liveworkspace/automations/room's (liveworkspace/docs/specs/018-automations/blueprints/
// engine.md "The room entry"); here it is told what a plan's rules are: the event kinds each trigger hears
// (TRIGGER_EVENT_KINDS), and when a time-trigger rule next runs.
import {
  TRIGGER_EVENT_KINDS,
  isTimeTrigger,
  nextMoment,
  type AutomationEventKind,
  type AutomationRule,
} from '@liveplanner/items';
import {
  AutomationStore as RuleStore,
  LEGACY_AUTOMATION_LIMITS,
  type AutomationLimits,
  type AutomationStoreKit,
  type Sql,
} from '@liveworkspace/automations/room';

export type { AutomationLimits, Sql };
export { LEGACY_AUTOMATION_LIMITS };

export const PLAN_RULES: AutomationStoreKit<AutomationRule, AutomationEventKind> = {
  hears: (rule) => TRIGGER_EVENT_KINDS[rule.trigger.kind],
  nextAt: (rule, now) =>
    isTimeTrigger(rule.trigger) ? nextMoment(rule.trigger, rule.timeZone, now) : null,
};

export class AutomationStore extends RuleStore<AutomationRule, AutomationEventKind> {
  // `limits`: the plan's tier's (plan-room/tier/plan-tier.ts); absent, the legacy ones.
  constructor(sql: () => Sql, ready: () => boolean, limits?: () => AutomationLimits) {
    super(sql, ready, PLAN_RULES, limits);
  }
}
