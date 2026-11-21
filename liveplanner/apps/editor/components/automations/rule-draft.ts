// The rule the builder holds while it is changed (docs/specs/026-plan/automations.md "The rule builder"): the
// platform's edit ops (@liveworkspace/automations-ui/rule-draft), which answer the plan's own rule body as they took
// it, with what is the plan's alone bound here: a new rule starts on Card Created, a For Related Cards branch holds
// up to 10 actions and starts on the cards this one is blocked by. Pure.

import {
  AUTOMATION_BRANCH_ACTIONS_MAX,
  type AutomationAction,
  type AutomationBranch,
  type AutomationIf,
  type AutomationRuleBody,
} from '@liveplanner/items';
import * as shared from '@liveworkspace/automations-ui/rule-draft';
import type { RulePart, Side } from '@liveworkspace/automations-ui/rule-draft';

export {
  NEW_RULE_NAME,
  actionCount,
  addAction,
  addCondition,
  addIfElse,
  bodyOf,
  canAddAi,
  canAddCondition,
  canAddOutgoing,
  canAddWait,
  canMove,
  conditionAt,
  editPart,
  nextRuleName,
  partAt,
  pathOf,
  sameBody,
  samePart,
  setBranchAction,
  setCondition,
  setStep,
} from '@liveworkspace/automations-ui/rule-draft';
export type { RulePart, Side, StepEdit } from '@liveworkspace/automations-ui/rule-draft';

// A step holding steps of its own: an If / Else or a branch.
export type HolderStep = AutomationIf | AutomationBranch;

/** A new rule: a trigger to start from, no conditions, no steps, off until its first full save. */
export const newRuleBody = (name: string, timeZone: string): AutomationRuleBody =>
  shared.newRuleBody(name, timeZone, { kind: 'card_created' });

/** A holder's Then or Else list (a branch has no Else). */
export const sideOf = (step: HolderStep, side: Side): readonly AutomationAction[] | undefined =>
  shared.sideOf(step, side) as readonly AutomationAction[] | undefined;

/** Whether another action fits: under the rule's 20, and inside a branch under its 10. */
export const canAddAction = (body: AutomationRuleBody, holder?: number): boolean =>
  shared.canAddAction(body, holder, AUTOMATION_BRANCH_ACTIONS_MAX);

export const actionAt = (
  body: AutomationRuleBody,
  part: RulePart & { part: 'branch' },
): AutomationAction | undefined => shared.actionAt(body, part) as AutomationAction | undefined;

/** The holder a part sits in (an If / Else or a branch), if any. */
export const holderOf = (body: AutomationRuleBody, part: RulePart | null): HolderStep | undefined =>
  shared.holderOf(body, part) as HolderStep | undefined;

/** Adds a For Related Cards branch, on the cards this one is blocked by until another way is picked. */
export const addBranch = (body: AutomationRuleBody): { body: AutomationRuleBody; part: RulePart } =>
  shared.addStep(body, PLAN_BRANCH_START());

/** A branch's first form. */
export const PLAN_BRANCH_START = (): AutomationBranch => ({
  kind: 'for',
  related: { kind: 'blocked_by' },
  conditions: [],
  then: [],
});

/** Whether Duplicate fits: a condition under its list's 10; a step's actions under the rule's 20 (an outgoing action
 *  under its 5); an action inside a holder as one more there. */
export const canDuplicate = (body: AutomationRuleBody, part: RulePart): boolean =>
  shared.canDuplicate(body, part, AUTOMATION_BRANCH_ACTIONS_MAX);
