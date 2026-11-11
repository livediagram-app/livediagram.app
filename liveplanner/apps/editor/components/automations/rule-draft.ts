// The rule the builder holds while it is changed (docs/specs/026-plan/automations.md "The rule builder"): a new rule's
// first form and name, every step change (add, move, duplicate, delete, replace), and the paths that name a part of
// the rule. A path is the api's own (`trigger`, `conditions.2`, `steps.1`, `steps.1.then.0`,
// `steps.1.conditions.0`), so a refusal's `path` ("steps.2.text") marks the part at fault. Pure.

import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_RULES_MAX,
  type AutomationAction,
  type AutomationCondition,
  type AutomationRuleBody,
  type AutomationStep,
} from '@liveplanner/items';

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
export function newRuleBody(name: string, timeZone: string): AutomationRuleBody {
  return {
    name,
    trigger: { kind: 'card_created' },
    conditions: [],
    steps: [],
    chain: false,
    timeZone,
  };
}

/** The rule's own parts, the stamps left off: what is saved and what is tested. */
export function bodyOf(rule: AutomationRuleBody): AutomationRuleBody {
  return {
    name: rule.name,
    trigger: rule.trigger,
    conditions: rule.conditions,
    steps: rule.steps,
    chain: rule.chain,
    timeZone: rule.timeZone,
  };
}

/** Whether two bodies say the same (the builder's "unsaved changes"). */
export function sameBody(a: AutomationRuleBody, b: AutomationRuleBody): boolean {
  return JSON.stringify(bodyOf(a)) === JSON.stringify(bodyOf(b));
}

/** The actions a rule holds, counting those inside an If / Else (the 20-action limit's count). */
export function actionCount(steps: readonly AutomationStep[]): number {
  return steps.reduce((n, s) => n + (s.kind === 'if' ? s.then.length + s.else.length : 1), 0);
}

export const canAddAction = (body: AutomationRuleBody) =>
  actionCount(body.steps) < AUTOMATION_ACTIONS_MAX;
export const canAddCondition = (conditions: readonly unknown[]) =>
  conditions.length < AUTOMATION_CONDITIONS_MAX;

// ---- Paths ------------------------------------------------------------------------------------------------------

export type RulePart =
  | { part: 'trigger' }
  | { part: 'condition'; index: number; ifStep?: number }
  | { part: 'step'; index: number }
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
export function partAt(body: AutomationRuleBody, path: string): RulePart | null {
  const [head, a, b, c] = path.split('.');
  if (head === 'trigger' || head === 'name') return head === 'trigger' ? { part: 'trigger' } : null;
  const i = index(a);
  if (i === null) return null;
  if (head === 'conditions')
    return i < body.conditions.length ? { part: 'condition', index: i } : null;
  if (head !== 'steps' || i >= body.steps.length) return null;
  const step = body.steps[i]!;
  const j = index(c);
  if (step.kind === 'if' && j !== null) {
    if (b === 'conditions' && j < step.conditions.length)
      return { part: 'condition', index: j, ifStep: i };
    if ((b === 'then' || b === 'else') && j < step[b].length)
      return { part: 'branch', step: i, side: b, index: j };
  }
  return { part: 'step', index: i };
}

export function samePart(a: RulePart | null, b: RulePart | null): boolean {
  return !!a && !!b && pathOf(a) === pathOf(b);
}

// ---- Reading and writing one part ------------------------------------------------------------------------------

export function conditionAt(body: AutomationRuleBody, part: RulePart & { part: 'condition' }) {
  if (part.ifStep === undefined) return body.conditions[part.index];
  const step = body.steps[part.ifStep];
  return step?.kind === 'if' ? step.conditions[part.index] : undefined;
}

export function actionAt(
  body: AutomationRuleBody,
  part: RulePart & { part: 'branch' },
): AutomationAction | undefined {
  const step = body.steps[part.step];
  return step?.kind === 'if' ? step[part.side][part.index] : undefined;
}

const replaceAt = <T>(list: readonly T[], i: number, value: T): T[] =>
  list.map((v, k) => (k === i ? value : v));

// The If / Else step at `i`, changed; anything else at `i` is left as it is.
function withIf(
  body: AutomationRuleBody,
  i: number,
  change: (step: AutomationStep & { kind: 'if' }) => AutomationStep,
): AutomationRuleBody {
  const step = body.steps[i];
  if (step?.kind !== 'if') return body;
  return { ...body, steps: replaceAt(body.steps, i, change(step)) };
}

export function setCondition(
  body: AutomationRuleBody,
  part: RulePart & { part: 'condition' },
  condition: AutomationCondition,
): AutomationRuleBody {
  if (part.ifStep === undefined)
    return { ...body, conditions: replaceAt(body.conditions, part.index, condition) };
  return withIf(body, part.ifStep, (s) => ({
    ...s,
    conditions: replaceAt(s.conditions, part.index, condition),
  }));
}

export function setStep(body: AutomationRuleBody, index: number, step: AutomationStep) {
  return { ...body, steps: replaceAt(body.steps, index, step) };
}

export function setBranchAction(
  body: AutomationRuleBody,
  part: RulePart & { part: 'branch' },
  action: AutomationAction,
): AutomationRuleBody {
  return withIf(body, part.step, (s) => ({
    ...s,
    [part.side]: replaceAt(s[part.side], part.index, action),
  }));
}

// ---- Adding ------------------------------------------------------------------------------------------------------

/** Adds a condition (to the rule, or to an If / Else), answering the rule and the new condition's part. */
export function addCondition(
  body: AutomationRuleBody,
  condition: AutomationCondition,
  ifStep?: number,
): { body: AutomationRuleBody; part: RulePart } {
  if (ifStep === undefined)
    return {
      body: { ...body, conditions: [...body.conditions, condition] },
      part: { part: 'condition', index: body.conditions.length },
    };
  const step = body.steps[ifStep];
  const at = step?.kind === 'if' ? step.conditions.length : 0;
  return {
    body: withIf(body, ifStep, (s) => ({ ...s, conditions: [...s.conditions, condition] })),
    part: { part: 'condition', index: at, ifStep },
  };
}

/** Adds an action at the end, or to an If / Else's Then or Else list. */
export function addAction(
  body: AutomationRuleBody,
  action: AutomationAction,
  branch?: { step: number; side: 'then' | 'else' },
): { body: AutomationRuleBody; part: RulePart } {
  if (!branch)
    return {
      body: { ...body, steps: [...body.steps, action] },
      part: { part: 'step', index: body.steps.length },
    };
  const step = body.steps[branch.step];
  const at = step?.kind === 'if' ? step[branch.side].length : 0;
  return {
    body: withIf(body, branch.step, (s) => ({ ...s, [branch.side]: [...s[branch.side], action] })),
    part: { part: 'branch', ...branch, index: at },
  };
}

export function addIfElse(body: AutomationRuleBody): { body: AutomationRuleBody; part: RulePart } {
  return {
    body: { ...body, steps: [...body.steps, { kind: 'if', conditions: [], then: [], else: [] }] },
    part: { part: 'step', index: body.steps.length },
  };
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
export function canMove(body: AutomationRuleBody, part: RulePart, dir: 'up' | 'down'): boolean {
  const len = siblingsOf(body, part).length;
  const i = part.part === 'trigger' ? 0 : part.index;
  return dir === 'up' ? i > 0 : i < len - 1;
}

function siblingsOf(body: AutomationRuleBody, part: RulePart): readonly unknown[] {
  switch (part.part) {
    case 'trigger':
      return [body.trigger];
    case 'condition': {
      if (part.ifStep === undefined) return body.conditions;
      const s = body.steps[part.ifStep];
      return s?.kind === 'if' ? s.conditions : [];
    }
    case 'step':
      return body.steps;
    case 'branch': {
      const s = body.steps[part.step];
      return s?.kind === 'if' ? s[part.side] : [];
    }
  }
}

/** One step edit on a condition, a step or a branch action, answering the rule and the part to select after it. */
export function editPart(
  body: AutomationRuleBody,
  part: RulePart,
  edit: StepEdit,
): { body: AutomationRuleBody; part: RulePart | null } {
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
      if (step?.kind !== 'if') return { body, part: null };
      const { list, at } = editList(step.conditions, part.index, edit);
      return {
        body: setStep(body, ifStep, { ...step, conditions: list }),
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
      if (step?.kind !== 'if') return { body, part: null };
      const { list, at } = editList(step[part.side], part.index, edit);
      return {
        body: setStep(body, part.step, { ...step, [part.side]: list }),
        part: at === null ? null : { ...part, index: at },
      };
    }
  }
}
