// Automations: a rule as a person wrote it, checked (liveworkspace/docs/specs/018-automations/automations.md "A
// rule", "Runs, limits and loops"; blueprint engine.md "The check"). The shell every app's check shares: the rule's
// name, time zone and chain, the walk over its trigger, conditions and steps with the app's readers for its own
// kinds, the caps on what a rule holds, and the readers of the steps every app has (Wait, a message through a
// connection, If / Else). `readRuleShell` answers the rule as it is kept (unknown keys dropped), or the first refusal
// with the `path` of the part at fault (`steps.2.text`) for the builder to mark. Also the rule's name rules. Pure.

import { CROSS_APP_STEPS_MAX, isCrossAppKind } from '@liveworkspace/index-client';
import { cutText } from '@liveworkspace/model-core/text-cut';
import { isRuleTimeZone } from './dates';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_AI_STEPS_MAX,
  AUTOMATION_NAME_MAX,
  AUTOMATION_OUTGOING_MAX,
  AUTOMATION_TEXT_MAX,
  AUTOMATION_WAITS_MAX,
  AUTOMATION_WAIT_HOURS_MAX,
  AUTOMATION_WAIT_HOURS_MIN,
} from './limits';
import type {
  AutomationIf,
  AutomationKind,
  AutomationOutgoing,
  AutomationRuleBody,
  AutomationWait,
} from './types';
import {
  ID_MAX,
  Refused,
  id,
  isObj,
  obj,
  refuse,
  text,
  unsupported,
  type Obj,
  type RuleRefusal,
  type TextCheck,
} from './validate-read';

const VIA = new Set(['webhook', 'slack', 'teams']);

// ---- The steps every app has -----------------------------------------------------------------------------------------

export function readWait(s: Obj, path: string): AutomationWait {
  const hours = s['hours'];
  if (
    typeof hours !== 'number' ||
    !Number.isInteger(hours) ||
    hours < AUTOMATION_WAIT_HOURS_MIN ||
    hours > AUTOMATION_WAIT_HOURS_MAX
  )
    refuse(
      `${path}.hours`,
      `${path}.hours must be a whole number from ${AUTOMATION_WAIT_HOURS_MIN} to ${AUTOMATION_WAIT_HOURS_MAX}`,
    );
  return { kind: 'wait', hours: hours as number };
}

// `check`: the app's check of the values the message may hold.
export function readNotify(s: Obj, path: string, check: TextCheck = {}): AutomationOutgoing {
  const via = s['via'];
  if (typeof via !== 'string' || !VIA.has(via))
    refuse(`${path}.via`, `${path}.via must be webhook, slack or teams`);
  return {
    kind: 'notify',
    via: via as AutomationOutgoing['via'],
    webhook: id(s['webhook'], `${path}.webhook`),
    ...(s['name'] !== undefined ? { name: text(s['name'], `${path}.name`, ID_MAX).trim() } : {}),
    text: text(s['text'], `${path}.text`, AUTOMATION_TEXT_MAX, check),
  };
}

// The actions of a step that holds a list of them: never a step `refused` names (said as `where`).
export function readActions<Action>(
  v: unknown,
  path: string,
  refused: ReadonlySet<string>,
  where: string,
  read: (v: unknown, path: string) => Action,
): Action[] {
  if (!Array.isArray(v)) refuse(path, `${path} must be a list`);
  return (v as unknown[]).map((a, i) => {
    const kind = isObj(a) ? a['kind'] : undefined;
    if (typeof kind === 'string' && refused.has(kind))
      unsupported('automation_step_unsupported', `${path}.${i}`, `${where} can't hold ${kind}`);
    return read(a, `${path}.${i}`);
  });
}

// An If / Else: at least one condition, and two lists of the app's actions, never a step `refused` names.
export function readIf<Condition, Action>(
  s: Obj,
  path: string,
  read: {
    conditions: (v: unknown, path: string) => Condition[];
    action: (v: unknown, path: string) => Action;
    refused: ReadonlySet<string>;
  },
): AutomationIf<Condition, Action> {
  const conditions = read.conditions(s['conditions'], `${path}.conditions`);
  if (conditions.length === 0) refuse(`${path}.conditions`, 'an If needs a condition');
  return {
    kind: 'if',
    conditions,
    then: readActions(s['then'], `${path}.then`, read.refused, 'an If', read.action),
    else: readActions(s['else'], `${path}.else`, read.refused, 'an If', read.action),
  };
}

// ---- Counting --------------------------------------------------------------------------------------------------------

// The actions a step holds: an If / Else's both lists, none for a Wait (it only holds the ones after it), else the
// step itself.
export function stepActions<Step extends AutomationKind>(s: Step): readonly AutomationKind[] {
  if (s.kind === 'if') {
    const branch = s as unknown as AutomationIf;
    return [...branch.then, ...branch.else];
  }
  return s.kind === 'wait' ? [] : [s];
}

// How many actions the steps hold, counting those inside a step that holds a list.
export const countActions = <Step extends AutomationKind>(
  steps: readonly Step[],
  actions: (s: Step) => readonly unknown[] = stepActions,
): number => steps.reduce((n, s) => n + actions(s).length, 0);

// The cap on a rule's actions, counted the app's way.
export function checkActionsCap<Step extends AutomationKind>(
  steps: readonly Step[],
  actions?: (s: Step) => readonly unknown[],
): void {
  if (countActions(steps, actions) > AUTOMATION_ACTIONS_MAX)
    refuse('steps', `a rule holds up to ${AUTOMATION_ACTIONS_MAX} actions`);
}

// The caps on the steps every app has: messages through connections, AI steps and Waits, at the rule's top level.
export function checkStepCaps(steps: readonly AutomationKind[]): void {
  const count = (kind: string) => steps.filter((s) => s.kind === kind).length;
  if (count('notify') > AUTOMATION_OUTGOING_MAX)
    refuse('steps', `a rule holds up to ${AUTOMATION_OUTGOING_MAX} outgoing actions`);
  if (count('ai') > AUTOMATION_AI_STEPS_MAX)
    refuse('steps', `a rule holds up to ${AUTOMATION_AI_STEPS_MAX} AI actions`);
  if (count('wait') > AUTOMATION_WAITS_MAX)
    refuse('steps', `a rule holds up to ${AUTOMATION_WAITS_MAX} Waits`);
  if (steps.filter((s) => isCrossAppKind(s.kind)).length > CROSS_APP_STEPS_MAX)
    refuse('steps', `a rule holds up to ${CROSS_APP_STEPS_MAX} steps in other apps`);
}

// ---- The shell -------------------------------------------------------------------------------------------------------

// What an app hands the check: how its trigger, conditions and each step read (each throws a `Refused`), and the
// checks over the rule read whole. Absent, `check` holds the rule to the shared caps.
export interface RuleReaders<
  Trigger extends AutomationKind,
  Condition extends AutomationKind,
  Step extends AutomationKind,
> {
  trigger: (v: unknown) => Trigger;
  conditions: (v: unknown, path: string) => Condition[];
  // `trigger`: the rule's, as read (it says which values the step's text may hold).
  step: (v: unknown, path: string, trigger: Trigger) => Step;
  check?: (rule: { trigger: Trigger; conditions: Condition[]; steps: Step[] }) => void;
}

export function readRuleShell<
  Trigger extends AutomationKind,
  Condition extends AutomationKind,
  Step extends AutomationKind,
>(
  v: unknown,
  readers: RuleReaders<Trigger, Condition, Step>,
): { body: AutomationRuleBody<Trigger, Condition, Step> } | RuleRefusal {
  try {
    const r = obj(v, 'rule');
    const name = typeof r['name'] === 'string' ? r['name'].trim() : '';
    if (!name || name.length > AUTOMATION_NAME_MAX)
      refuse('name', `name must be 1 to ${AUTOMATION_NAME_MAX} characters`);
    if (!isRuleTimeZone(r['timeZone'])) refuse('timeZone', 'timeZone must name a time zone');
    if (r['chain'] !== undefined && typeof r['chain'] !== 'boolean')
      refuse('chain', 'chain must be true or false');
    const trigger = readers.trigger(r['trigger']);
    const conditions = readers.conditions(r['conditions'] ?? [], 'conditions');
    if (!Array.isArray(r['steps'])) refuse('steps', 'steps must be a list');
    const steps = (r['steps'] as unknown[]).map((s, i) => readers.step(s, `steps.${i}`, trigger));
    if (readers.check) readers.check({ trigger, conditions, steps });
    else {
      checkActionsCap(steps);
      checkStepCaps(steps);
    }
    return {
      body: {
        name,
        trigger,
        conditions,
        steps,
        chain: r['chain'] === true,
        timeZone: r['timeZone'] as string,
      },
    };
  } catch (error) {
    if (error instanceof Refused) return error.refusal;
    throw error;
  }
}

// ---- Names -----------------------------------------------------------------------------------------------------------

const nameKey = (name: string) => name.trim().toLowerCase();

// Whether another rule of the item has this name (case aside).
export const ruleNameTaken = (
  name: string,
  rules: readonly { id: string; name: string }[],
  exceptId?: string,
): boolean => rules.some((r) => r.id !== exceptId && nameKey(r.name) === nameKey(name));

// The first free name from `base` and its `tail`: "New Rule", then "New Rule 2" and on, or with a tail of " copy",
// "Triage copy", then "Triage copy 2". The base is cut, never the tail or the number, so both always fit.
export function freeRuleName(
  base: string,
  rules: readonly { id: string; name: string }[],
  tail = '',
): string {
  for (let n = 1; ; n += 1) {
    const suffix = `${tail}${n === 1 ? '' : ` ${n}`}`;
    const name = `${cutText(base.trim(), AUTOMATION_NAME_MAX - suffix.length)}${suffix}`;
    if (!ruleNameTaken(name, rules)) return name;
  }
}
