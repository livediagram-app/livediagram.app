'use client';

// The open plan's rules, read once and shared (docs/specs/026-plan/automations.md "Where it shows"): the platform's
// list (@liveworkspace/automations-ui/use-automations) over this editor's routes, typed with the plan's own rule and
// run. The footer's amber dot, the Automations screen and a card's Run Rule all read the one list per plan.

import type {
  AutomationHookInfo,
  AutomationListedRule,
  AutomationRuleBody,
  AutomationRunResponse,
  AutomationsListResponse,
} from '@liveplanner/api-schema';
import {
  foldHook as foldSharedHook,
  forgetAutomations,
  readAutomations as readShared,
  readAutomationsFor as readSharedFor,
  useAutomations as useShared,
  type AutomationsStatus,
} from '@liveworkspace/automations-ui/use-automations';
import type { AutomationsScope } from './automations-client';
import { PLAN_AUTOMATIONS_CLIENT } from './plan-client';

export { forgetAutomations };
export type { AutomationsStatus };

export type AutomationsState = {
  status: AutomationsStatus;
  data: AutomationsListResponse | null;
};

export type AutomationsApi = AutomationsState & {
  reload: () => void;
  save: (id: string | null, body: AutomationRuleBody) => Promise<AutomationListedRule>;
  toggle: (id: string, enabled: boolean) => Promise<AutomationListedRule>;
  duplicate: (id: string) => Promise<AutomationListedRule>;
  remove: (id: string) => Promise<void>;
  // Test on a Card (the rule as the builder holds it, unsaved) and Run Rule: the run, as the Audit Trail shows it.
  test: (rule: AutomationRuleBody, item: string) => Promise<AutomationRunResponse>;
  run: (id: string, item: string) => Promise<AutomationRunResponse>;
};

/** Reads the list (once at a time). Resolves false when the read failed. */
export const readAutomations = (scope: AutomationsScope): Promise<boolean> =>
  readShared(PLAN_AUTOMATIONS_CLIENT, scope);

/** Reads the list again for a rule a reader names that it lacks: once per name per plan. */
export const readAutomationsFor = (scope: AutomationsScope, name: string): void =>
  readSharedFor(PLAN_AUTOMATIONS_CLIENT, scope, name);

export const foldHook = (scope: AutomationsScope, ruleId: string, hook: AutomationHookInfo): void =>
  foldSharedHook(scope, ruleId, hook);

/** The plan's list and its changes; `read` asks for the list when nothing has been read yet. */
export function useAutomations(scope: AutomationsScope | null, read = true): AutomationsApi {
  // The list holds the plan's own rules and runs: the platform's hook types them openly.
  return useShared(PLAN_AUTOMATIONS_CLIENT, scope, read) as unknown as AutomationsApi;
}
