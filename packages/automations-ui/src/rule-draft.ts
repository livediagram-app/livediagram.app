// The rule the builder holds while it is changed (liveworkspace/docs/specs/018-automations/automations.md "A rule";
// blueprint ui.md "The draft"): a new rule's first form and name, every step change (add, move, duplicate, delete,
// replace), and the paths that name a part of the rule. A path is the api's own (`trigger`, `conditions.2`,
// `steps.1`, `steps.1.then.0`, `steps.1.conditions.0`), so a refusal's `path` ("steps.2.text") marks the part at
// fault. An If / Else and an app's branch both hold steps of their own (a "holder", told by its shape): its
// conditions and its Then list (an If's Else too). Generic over the app's rule body, which every function answers
// as it took it. Pure.

import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_AI_STEPS_MAX,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_OUTGOING_MAX,
  AUTOMATION_RULES_MAX,
  AUTOMATION_WAITS_MAX,
  type AutomationKind,
} from '@liveworkspace/automations';
import { CROSS_APP_STEPS_MAX, isCrossAppKind } from '@liveworkspace/automations/cross-app';
import { isHolder, type HolderStep, type RuleBody } from './types';

export type { HolderStep } from './types';

type StepOf<B extends RuleBody> = B['steps'][number];
type ConditionOf<B extends RuleBody> = B['conditions'][number];

export const NEW_RULE_NAME = 'New Rule';

/** "New Rule", then "New Rule 2" and on: the first not taken (names are unique, case aside). */
export function nextRuleName(taken: readonly string[]): string {
  const names = new Set(taken.map((n) => n.trim().toLowerCase()));
  if (!names.has(NEW_RULE_NAME.toLowerCase())) return NEW_RULE_NAME;
  for (let n = 2; n <= AUTOMATION_RULES_MAX + 1; n++) {
    const name = `${NEW_RULE_NAME} ${n}`;
    if (!names.has(name.toLowerCase())) return name;
  }
  return `${NEW_RULE_NAME} ${taken.length + 1}`;
}

/** A new rule: a trigger to start from, no conditions, no steps, off until its first full save. */
export function newRuleBody<Trigger extends AutomationKind>(
  name: string,
  timeZone: string,
  trigger: Trigger,
): RuleBody<Trigger, never, never> {
  return { name, trigger, conditions: [], steps: [], chain: false, timeZone };
}

/** The rule's own parts, the stamps left off: what is saved and what is tested. */
export function bodyOf<B extends RuleBody>(rule: B): B {
  return {
    name: rule.name,
    trigger: rule.trigger,
    conditions: rule.conditions,
    steps: rule.steps,
    chain: rule.chain,
    timeZone: rule.timeZone,
  } as B;
}

/** Whether two bodies say the same (the builder's "unsaved changes"). */
export function sameBody(a: RuleBody, b: RuleBody): boolean {
  return JSON.stringify(bodyOf(a)) === JSON.stringify(bodyOf(b));
}

/** The actions a rule holds, counting those inside an If / Else and a branch, none for a Wait (the 20-action
 *  limit's count). */
export const actionCount = (steps: readonly AutomationKind[]): number =>
  steps.reduce(
    (n, s) => n + (isHolder(s) ? s.then.length + (s.else?.length ?? 0) : s.kind === 'wait' ? 0 : 1),
    0,
  );

export type Side = 'then' | 'else';

// A branch is a holder with no Else.
const isBranch = (s: AutomationKind | undefined): s is HolderStep => isHolder(s) && !s.else;

/** A holder's Then or Else list (a branch has no Else). */
export function sideOf(step: HolderStep, side: Side): readonly AutomationKind[] | undefined {
  return side === 'then' ? step.then : step.else;
}

/** Whether another action fits: under the rule's 20, and inside a branch under its own most (`branchMax`). */
export function canAddAction(body: RuleBody, holder?: number, branchMax = Infinity): boolean {
  if (actionCount(body.steps) >= AUTOMATION_ACTIONS_MAX) return false;
  const s = holder === undefined ? undefined : body.steps[holder];
  return !isBranch(s) || s.then.length < branchMax;
}

/** Whether another message step fits (5 a rule, at its top level). */
export const canAddOutgoing = (body: RuleBody): boolean =>
  canAddAction(body) &&
  body.steps.filter((s) => s.kind === 'notify').length < AUTOMATION_OUTGOING_MAX;

/** Whether another AI step fits (3 a rule, at its top level). */
export const canAddAi = (body: RuleBody): boolean =>
  canAddAction(body) && body.steps.filter((s) => s.kind === 'ai').length < AUTOMATION_AI_STEPS_MAX;

/** Whether another step in another app fits (5 a rule, at its top level). */
export const canAddCrossApp = (body: RuleBody): boolean =>
  canAddAction(body) &&
  body.steps.filter((s) => isCrossAppKind(s.kind)).length < CROSS_APP_STEPS_MAX;

/** Whether another Wait fits (3 a rule, at its top level). */
export const canAddWait = (body: RuleBody): boolean =>
  body.steps.filter((s) => s.kind === 'wait').length < AUTOMATION_WAITS_MAX;

export const canAddCondition = (conditions: readonly unknown[]) =>
  conditions.length < AUTOMATION_CONDITIONS_MAX;

// ---- Paths ------------------------------------------------------------------------------------------------------

export type RulePart =
  | { part: 'trigger' }
  | { part: 'condition'; index: number; ifStep?: number }
  | { part: 'step'; index: number }
  // An action inside an If / Else (Then or Else) or a branch (Then).
  | { part: 'branch'; step: number; side: 'then' | 'else'; index: number };

export function pathOf(part: RulePart): string {
  switch (part.part) {
    case 'trigger':
      return 'trigger';
    case 'condition':
      return part.ifStep === undefined
        ? `conditions.${part.index}`
        : `steps.${part.ifStep}.conditions.${part.index}`;
    case 'step':
      return `steps.${part.index}`;
    case 'branch':
      return `steps.${part.step}.${part.side}.${part.index}`;
  }
}

const index = (s: string | undefined) => (s !== undefined && /^\d+$/.test(s) ? Number(s) : null);

/** The part a path (or a refusal's longer path) names, if the rule has it. */
export function partAt(body: RuleBody, path: string): RulePart | null {
  const [head, a, b, c] = path.split('.');
  if (head === 'trigger' || head === 'name') return head === 'trigger' ? { part: 'trigger' } : null;
  const i = index(a);
  if (i === null) return null;
  if (head === 'conditions')
    return i < body.conditions.length ? { part: 'condition', index: i } : null;
  if (head !== 'steps' || i >= body.steps.length) return null;
  const step = body.steps[i]!;
  const j = index(c);
  if (isHolder(step) && j !== null) {
    if (b === 'conditions' && j < step.conditions.length)
      return { part: 'condition', index: j, ifStep: i };
    const list = b === 'then' || b === 'else' ? sideOf(step, b) : undefined;
    if (list && j < list.length) return { part: 'branch', step: i, side: b as Side, index: j };
  }
  return { part: 'step', index: i };
}

export function samePart(a: RulePart | null, b: RulePart | null): boolean {
  return !!a && !!b && pathOf(a) === pathOf(b);
}

// ---- Reading and writing one part ------------------------------------------------------------------------------

export function conditionAt<B extends RuleBody>(
  body: B,
  part: RulePart & { part: 'condition' },
): ConditionOf<B> | undefined {
  if (part.ifStep === undefined) return body.conditions[part.index];
  const step = body.steps[part.ifStep];
  return isHolder(step) ? step.conditions[part.index] : undefined;
}

export function actionAt<B extends RuleBody>(
  body: B,
  part: RulePart & { part: 'branch' },
): StepOf<B> | undefined {
  const step = body.steps[part.step];
  return isHolder(step) ? sideOf(step, part.side)?.[part.index] : undefined;
}

/** The holder a part sits in (an If / Else or a branch), if any. */
export function holderOf(body: RuleBody, part: RulePart | null): HolderStep | undefined {
  const i =
    part?.part === 'branch' ? part.step : part?.part === 'condition' ? part.ifStep : undefined;
  const s = i === undefined ? undefined : body.steps[i];
  return isHolder(s) ? s : undefined;
}

const replaceAt = <T>(list: readonly T[], i: number, value: T): T[] =>
  list.map((v, k) => (k === i ? value : v));

// The holder at `i`, changed; anything else at `i` is left as it is.
function withHolder<B extends RuleBody>(
  body: B,
  i: number,
  change: (step: HolderStep) => HolderStep,
): B {
  const step = body.steps[i];
  if (!isHolder(step)) return body;
  return { ...body, steps: replaceAt(body.steps, i, change(step)) };
}

// A holder with one of its lists replaced (a branch takes only Then).
function withSide(step: HolderStep, side: Side, list: AutomationKind[]): HolderStep {
  if (!step.else) return side === 'then' ? { ...step, then: list } : step;
  return { ...step, [side]: list };
}

export function setCondition<B extends RuleBody>(
  body: B,
  part: RulePart & { part: 'condition' },
  condition: ConditionOf<B>,
): B {
  if (part.ifStep === undefined)
    return { ...body, conditions: replaceAt(body.conditions, part.index, condition) };
  return withHolder(body, part.ifStep, (s) => ({
    ...s,
    conditions: replaceAt(s.conditions, part.index, condition),
  }));
}

export function setStep<B extends RuleBody>(body: B, index: number, step: StepOf<B>): B {
  return { ...body, steps: replaceAt(body.steps, index, step) };
}

export function setBranchAction<B extends RuleBody>(
  body: B,
  part: RulePart & { part: 'branch' },
  action: StepOf<B>,
): B {
  return withHolder(body, part.step, (s) =>
    withSide(s, part.side, replaceAt(sideOf(s, part.side) ?? [], part.index, action)),
  );
}

// ---- Adding ------------------------------------------------------------------------------------------------------

/** Adds a condition (to the rule, or to an If / Else or a branch), answering the rule and the new condition's part. */
export function addCondition<B extends RuleBody>(
  body: B,
  condition: ConditionOf<B>,
  ifStep?: number,
): { body: B; part: RulePart } {
  if (ifStep === undefined)
    return {
      body: { ...body, conditions: [...body.conditions, condition] },
      part: { part: 'condition', index: body.conditions.length },
    };
  const step = body.steps[ifStep];
  const at = isHolder(step) ? step.conditions.length : 0;
  return {
    body: withHolder(body, ifStep, (s) => ({ ...s, conditions: [...s.conditions, condition] })),
    part: { part: 'condition', index: at, ifStep },
  };
}

/** The steps that go at the rule's top level whatever list they were asked into: a message, an AI step, a Wait. */
export const isTopOnly = (step: AutomationKind): boolean =>
  step.kind === 'notify' || step.kind === 'ai' || step.kind === 'wait';

/** Adds a step at the end, or an action to an If / Else's Then or Else list or a branch's Then. A step of the top
 *  level alone (`top`) goes at the top level (the pickers never offer one inside). */
export function addAction<B extends RuleBody>(
  body: B,
  action: StepOf<B>,
  branch?: { step: number; side: Side },
  top: boolean = isTopOnly(action),
): { body: B; part: RulePart } {
  if (!branch || top) return addStep(body, action);
  const step = body.steps[branch.step];
  const at = isHolder(step) ? (sideOf(step, branch.side)?.length ?? 0) : 0;
  return {
    body: withHolder(body, branch.step, (s) =>
      withSide(s, branch.side, [...(sideOf(s, branch.side) ?? []), action]),
    ),
    part: { part: 'branch', ...branch, index: at },
  };
}

/** Adds a step at the end of the rule's top level (an app's branch, in its first form). */
export function addStep<B extends RuleBody>(body: B, step: StepOf<B>): { body: B; part: RulePart } {
  return {
    body: { ...body, steps: [...body.steps, step] },
    part: { part: 'step', index: body.steps.length },
  };
}

export function addIfElse<B extends RuleBody>(body: B): { body: B; part: RulePart } {
  return addStep(body, { kind: 'if', conditions: [], then: [], else: [] } as StepOf<B>);
}

// ---- Move Up, Move Down, Duplicate, Delete ------------------------------------------------------------------------

export type StepEdit = 'up' | 'down' | 'duplicate' | 'delete';

function editList<T>(
  list: readonly T[],
  i: number,
  edit: StepEdit,
): { list: T[]; at: number | null } {
  const out = [...list];
  if (edit === 'delete') {
    out.splice(i, 1);
    return { list: out, at: null };
  }
  if (edit === 'duplicate') {
    out.splice(i + 1, 0, structuredClone(list[i]!));
    return { list: out, at: i + 1 };
  }
  const j = edit === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return { list: out, at: i };
  [out[i], out[j]] = [out[j]!, out[i]!];
  return { list: out, at: j };
}

/** Whether a part may move that way (Move Up on the first, Move Down on the last, are greyed). */
export function canMove(body: RuleBody, part: RulePart, dir: 'up' | 'down'): boolean {
  const len = siblingsOf(body, part).length;
  const i = part.part === 'trigger' ? 0 : part.index;
  return dir === 'up' ? i > 0 : i < len - 1;
}

function siblingsOf(body: RuleBody, part: RulePart): readonly unknown[] {
  switch (part.part) {
    case 'trigger':
      return [body.trigger];
    case 'condition': {
      if (part.ifStep === undefined) return body.conditions;
      const s = body.steps[part.ifStep];
      return isHolder(s) ? s.conditions : [];
    }
    case 'step':
      return body.steps;
    case 'branch': {
      const s = body.steps[part.step];
      return (isHolder(s) && sideOf(s, part.side)) || [];
    }
  }
}

/** One step edit on a condition, a step or a branch action, answering the rule and the part to select after it. */
export function editPart<B extends RuleBody>(
  body: B,
  part: RulePart,
  edit: StepEdit,
): { body: B; part: RulePart | null } {
  switch (part.part) {
    case 'trigger':
      return { body, part };
    case 'condition': {
      const { ifStep } = part;
      if (ifStep === undefined) {
        const { list, at } = editList(body.conditions, part.index, edit);
        return {
          body: { ...body, conditions: list },
          part: at === null ? null : { ...part, index: at },
        };
      }
      const step = body.steps[ifStep];
      if (!isHolder(step)) return { body, part: null };
      const { list, at } = editList(step.conditions, part.index, edit);
      return {
        body: setStep(body, ifStep, { ...step, conditions: list } as StepOf<B>),
        part: at === null ? null : { ...part, index: at },
      };
    }
    case 'step': {
      const { list, at } = editList(body.steps, part.index, edit);
      return {
        body: { ...body, steps: list },
        part: at === null ? null : { part: 'step', index: at },
      };
    }
    case 'branch': {
      const step = body.steps[part.step];
      const side = isHolder(step) ? sideOf(step, part.side) : undefined;
      if (!isHolder(step) || !side) return { body, part: null };
      const { list, at } = editList(side, part.index, edit);
      return {
        body: setStep(body, part.step, withSide(step, part.side, list)),
        part: at === null ? null : { ...part, index: at },
      };
    }
  }
}

/** Whether Duplicate fits: a condition under its list's 10; a step's actions under the rule's 20 (a message step
 *  under its 5, an AI step and a Wait under their 3); an action inside a holder as one more there. */
export function canDuplicate(body: RuleBody, part: RulePart, branchMax = Infinity): boolean {
  switch (part.part) {
    case 'trigger':
      return false;
    case 'condition':
      return canAddCondition(siblingsOf(body, part));
    case 'branch':
      return canAddAction(body, part.step, branchMax);
    case 'step': {
      const step = body.steps[part.index];
      if (!step) return false;
      if (step.kind === 'notify') return canAddOutgoing(body);
      if (step.kind === 'ai') return canAddAi(body);
      if (step.kind === 'wait') return canAddWait(body);
      if (isCrossAppKind(step.kind)) return canAddCrossApp(body);
      return actionCount(body.steps) + actionCount([step]) <= AUTOMATION_ACTIONS_MAX;
    }
  }
}
