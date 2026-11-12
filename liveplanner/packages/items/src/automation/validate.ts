// Automations: a rule as a person wrote it, checked (docs/specs/026-plan/automations.md "A rule", "Limits"; blueprint
// automations.md "Files", "Routes"). `readRuleBody` answers the rule as it is kept (unknown keys dropped), or the first
// refusal with the `path` of the part at fault (`steps.2.text`) for the builder to mark. What a rule names that the
// plan lacks is not a refusal: it needs attention (attention.ts). Also the rule's name rules. Pure.

import { ITEM_LABEL_MAX, ITEM_TITLE_MAX } from '../limits';
import { isRuleTimeZone } from '../repeat-dates';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_BRANCH_ACTIONS_MAX,
  AUTOMATION_CREATED_PER_RUN,
  AUTOMATION_NAME_MAX,
  AUTOMATION_OUTGOING_MAX,
  AUTOMATION_ROTATE_MAX,
  AUTOMATION_ROTATE_MIN,
  AUTOMATION_TEXT_MAX,
  isPersonless,
  isTimeTrigger,
  AUTOMATION_AI_STEPS_MAX,
  type AutomationAction,
  type AutomationAi,
  type AutomationBranch,
  type AutomationCondition,
  type AutomationOutgoing,
  type AutomationRelated,
  type AutomationRuleBody,
  type AutomationSetValue,
  type AutomationStep,
} from './types';
import type { ValuePlace } from './values';
import { readAiStep } from './ai-steps';
import {
  ID_MAX,
  Refused,
  day,
  id,
  ids,
  isObj,
  obj,
  optionalIds,
  refuse,
  text,
  unsupported,
  type Obj,
  type RuleRefusal,
} from './validate-read';
import { readConditions, readTrigger } from './validate-conditions';

export { AUTOMATION_LIST_MAX, type RuleRefusal } from './validate-read';

export const AUTOMATION_SUBJECT_MAX = 200;
const COPIES = new Set(['assignee', 'labels', 'due']);
const VIA = new Set(['webhook', 'slack', 'teams']);
// The steps a branch may not hold, and an If / Else's actions neither.
const NOT_IN_BRANCH = new Set(['if', 'for', 'create_card', 'notify', 'ai']);
const NOT_IN_IF = new Set(['if', 'for', 'notify', 'ai']);

function readSetValue(v: unknown, path: string, place: ValuePlace): AutomationSetValue {
  const o = obj(v, path);
  if (o['text'] !== undefined)
    return { text: text(o['text'], `${path}.text`, AUTOMATION_TEXT_MAX, place) };
  if (o['number'] !== undefined) {
    if (typeof o['number'] !== 'number' || !Number.isFinite(o['number']))
      refuse(`${path}.number`, `${path}.number must be a number`);
    return { number: o['number'] as number };
  }
  if (o['list'] !== undefined) return { list: ids(o['list'], `${path}.list`) };
  if (o['date'] !== undefined) return { date: day(o['date'], `${path}.date`) };
  if (o['from'] !== undefined) return { from: id(o['from'], `${path}.from`) };
  return refuse(path, `${path} must be text, a number, a list, a day or a field`);
}

function readRotate(v: unknown, path: string): string[] {
  if (!Array.isArray(v)) refuse(path, `${path} must be a list of people`);
  const people = ids(v, path);
  if (people.length < AUTOMATION_ROTATE_MIN || people.length > AUTOMATION_ROTATE_MAX)
    refuse(path, `${path} must name ${AUTOMATION_ROTATE_MIN} to ${AUTOMATION_ROTATE_MAX} people`);
  return people;
}

function readAction(v: unknown, path: string, place: ValuePlace = {}): AutomationAction {
  const a = obj(v, path);
  const text_ = (x: unknown, p: string, max: number) => text(x, p, max, place);
  switch (a['kind']) {
    case 'move':
      return { kind: 'move', status: id(a['status'], `${path}.status`) };
    case 'set_field':
      return {
        kind: 'set_field',
        field: id(a['field'], `${path}.field`),
        value: readSetValue(a['value'], `${path}.value`, place),
      };
    case 'clear_field':
      return { kind: 'clear_field', field: id(a['field'], `${path}.field`) };
    case 'assign': {
      const to = obj(a['to'], `${path}.to`);
      if (to['person'] !== undefined)
        return { kind: 'assign', to: { person: id(to['person'], `${path}.to.person`) } };
      if (to['trigger'] === true) return { kind: 'assign', to: { trigger: true } };
      if (to['nobody'] === true) return { kind: 'assign', to: { nobody: true } };
      if (to['rotate'] !== undefined)
        return { kind: 'assign', to: { rotate: readRotate(to['rotate'], `${path}.to.rotate`) } };
      return refuse(
        `${path}.to`,
        `${path}.to must be a person, whoever triggered it, nobody, or people in turn`,
      );
    }
    case 'add_label':
    case 'remove_label':
      return { kind: a['kind'], label: text_(a['label'], `${path}.label`, ITEM_LABEL_MAX).trim() };
    case 'comment':
      return { kind: 'comment', text: text_(a['text'], `${path}.text`, AUTOMATION_TEXT_MAX) };
    case 'flag':
    case 'unflag':
    case 'archive':
      return { kind: a['kind'] };
    case 'create_card': {
      const copy = optionalIds(a['copy'], `${path}.copy`);
      if (copy?.some((c) => !COPIES.has(c)))
        refuse(`${path}.copy`, `${path}.copy copies assignee, labels or due`);
      return {
        kind: 'create_card',
        type: id(a['type'], `${path}.type`),
        title: text_(a['title'], `${path}.title`, ITEM_TITLE_MAX),
        ...(a['status'] !== undefined ? { status: id(a['status'], `${path}.status`) } : {}),
        ...(copy?.length ? { copy: copy as ('assignee' | 'labels' | 'due')[] } : {}),
        ...(a['linkField'] !== undefined
          ? { linkField: id(a['linkField'], `${path}.linkField`) }
          : {}),
      };
    }
    case 'email': {
      const to = obj(a['to'], `${path}.to`);
      const recipient =
        to['assignee'] === true
          ? { assignee: true as const }
          : to['trigger'] === true
            ? { trigger: true as const }
            : to['person'] !== undefined
              ? { person: id(to['person'], `${path}.to.person`) }
              : refuse(
                  `${path}.to`,
                  `${path}.to must be the assignee, whoever triggered it, or a person`,
                );
      return {
        kind: 'email',
        to: recipient,
        subject: text_(a['subject'], `${path}.subject`, AUTOMATION_SUBJECT_MAX),
        body: text_(a['body'], `${path}.body`, AUTOMATION_TEXT_MAX),
      };
    }
    default:
      return refuse(`${path}.kind`, `${path}.kind is not an action`);
  }
}

// The actions of an If / Else or a branch: never a step `refused` names (said as `where`).
function readActions(
  v: unknown,
  path: string,
  refused: ReadonlySet<string>,
  where: string,
  place: ValuePlace = {},
): AutomationAction[] {
  if (!Array.isArray(v)) refuse(path, `${path} must be a list`);
  return (v as unknown[]).map((a, i) => {
    const kind = isObj(a) ? a['kind'] : undefined;
    if (typeof kind === 'string' && refused.has(kind))
      unsupported('automation_step_unsupported', `${path}.${i}`, `${where} can't hold ${kind}`);
    return readAction(a, `${path}.${i}`, place);
  });
}

function readNotify(s: Obj, path: string, place: ValuePlace): AutomationOutgoing {
  const via = s['via'];
  if (typeof via !== 'string' || !VIA.has(via))
    refuse(`${path}.via`, `${path}.via must be webhook, slack or teams`);
  return {
    kind: 'notify',
    via: via as AutomationOutgoing['via'],
    webhook: id(s['webhook'], `${path}.webhook`),
    ...(s['name'] !== undefined ? { name: text(s['name'], `${path}.name`, ID_MAX).trim() } : {}),
    text: text(s['text'], `${path}.text`, AUTOMATION_TEXT_MAX, place),
  };
}

function readRelated(v: unknown, path: string): AutomationRelated {
  const r = obj(v, path);
  switch (r['kind']) {
    case 'linked':
      return r['field'] === undefined
        ? { kind: 'linked' }
        : { kind: 'linked', field: id(r['field'], `${path}.field`) };
    case 'blocked_by':
    case 'blocking':
    case 'children':
      return { kind: r['kind'] };
    case 'saved_filter':
      return {
        kind: 'saved_filter',
        tab: id(r['tab'], `${path}.tab`),
        filter: id(r['filter'], `${path}.filter`),
      };
    default:
      return refuse(`${path}.kind`, `${path}.kind is not a way to pick related cards`);
  }
}

function readBranch(s: Obj, path: string, place: ValuePlace): AutomationBranch {
  const then = readActions(s['then'], `${path}.then`, NOT_IN_BRANCH, 'a branch', {
    ...place,
    branch: true,
  });
  if (then.length === 0 || then.length > AUTOMATION_BRANCH_ACTIONS_MAX)
    refuse(`${path}.then`, `a branch holds 1 to ${AUTOMATION_BRANCH_ACTIONS_MAX} actions`);
  return {
    kind: 'for',
    related: readRelated(s['related'], `${path}.related`),
    conditions: readConditions(s['conditions'] ?? [], `${path}.conditions`),
    then,
  };
}

// `place`: an Incoming Webhook rule's text may name the call's values.
function readStep(v: unknown, path: string, place: ValuePlace): AutomationStep {
  const s = obj(v, path);
  if (s['kind'] === 'notify') return readNotify(s, path, place);
  if (s['kind'] === 'for') return readBranch(s, path, place);
  if (s['kind'] === 'ai') {
    const read = readAiStep(s);
    return 'step' in read ? read.step : refuse(`${path}${read.path}`, read.message);
  }
  if (s['kind'] !== 'if') return readAction(s, path, place);
  const conditions = readConditions(s['conditions'], `${path}.conditions`);
  if (conditions.length === 0) refuse(`${path}.conditions`, 'an If needs a condition');
  return {
    kind: 'if',
    conditions,
    then: readActions(s['then'], `${path}.then`, NOT_IN_IF, 'an If', place),
    else: readActions(s['else'], `${path}.else`, NOT_IN_IF, 'an If', place),
  };
}

const creates = (actions: readonly AutomationAction[]) =>
  actions.filter((a) => a.kind === 'create_card').length;

// The actions a step holds: an If / Else's both lists, a branch's, else the step itself.
export function stepActions(
  s: AutomationStep,
): readonly (AutomationAction | AutomationOutgoing | AutomationAi)[] {
  if (s.kind === 'if') return [...s.then, ...s.else];
  return s.kind === 'for' ? s.then : [s];
}

// How many actions the steps hold, counting those inside an If / Else and a branch.
export function countActions(steps: readonly AutomationStep[]): number {
  return steps.reduce((n, s) => n + stepActions(s).length, 0);
}

// The most cards one run of the steps could make: the top level's, and the larger branch of each If (a branch makes
// none).
function createsPerRun(steps: readonly AutomationStep[]): number {
  return steps.reduce(
    (n, s) =>
      n +
      (s.kind === 'if'
        ? Math.max(creates(s.then), creates(s.else))
        : s.kind === 'create_card'
          ? 1
          : 0),
    0,
  );
}

// A time trigger or an incoming webhook (`who` says which) has no person behind it: no Who Did It condition, and
// nobody to assign or email as whoever triggered it, anywhere in the rule.
function checkPersonless(
  conditions: readonly AutomationCondition[],
  steps: readonly AutomationStep[],
  who: string,
) {
  const no = (path: string, what: string) =>
    unsupported('automation_condition_unsupported', path, `${who} has no ${what}`);
  const checkConditions = (list: readonly AutomationCondition[], path: string) =>
    list.forEach((c, i) => {
      if (c.kind === 'who') no(`${path}.${i}`, 'person behind it to check');
    });
  checkConditions(conditions, 'conditions');
  steps.forEach((s, i) => {
    if (s.kind === 'if' || s.kind === 'for') checkConditions(s.conditions, `steps.${i}.conditions`);
    for (const a of stepActions(s))
      if ((a.kind === 'assign' || a.kind === 'email') && 'trigger' in a.to)
        no(`steps.${i}`, 'person who triggered it');
  });
}

// Whether the rule does something: an action anywhere in its steps. A rule turns on at its first save with one.
export const ruleHasAction = (body: Pick<AutomationRuleBody, 'steps'>): boolean =>
  countActions(body.steps) > 0;

export function readRuleBody(v: unknown): { body: AutomationRuleBody } | RuleRefusal {
  try {
    const r = obj(v, 'rule');
    const name = typeof r['name'] === 'string' ? r['name'].trim() : '';
    if (!name || name.length > AUTOMATION_NAME_MAX)
      refuse('name', `name must be 1 to ${AUTOMATION_NAME_MAX} characters`);
    if (!isRuleTimeZone(r['timeZone'])) refuse('timeZone', 'timeZone must name a time zone');
    if (r['chain'] !== undefined && typeof r['chain'] !== 'boolean')
      refuse('chain', 'chain must be true or false');
    const trigger = readTrigger(r['trigger']);
    const conditions = readConditions(r['conditions'] ?? [], 'conditions');
    if (!Array.isArray(r['steps'])) refuse('steps', 'steps must be a list');
    const place: ValuePlace = trigger.kind === 'incoming_webhook' ? { webhook: true } : {};
    const steps = (r['steps'] as unknown[]).map((s, i) => readStep(s, `steps.${i}`, place));
    if (countActions(steps) > AUTOMATION_ACTIONS_MAX)
      refuse('steps', `a rule holds up to ${AUTOMATION_ACTIONS_MAX} actions`);
    if (createsPerRun(steps) > AUTOMATION_CREATED_PER_RUN)
      refuse('steps', `a run makes up to ${AUTOMATION_CREATED_PER_RUN} card`);
    if (steps.filter((s) => s.kind === 'notify').length > AUTOMATION_OUTGOING_MAX)
      refuse('steps', `a rule holds up to ${AUTOMATION_OUTGOING_MAX} outgoing actions`);
    if (steps.filter((s) => s.kind === 'ai').length > AUTOMATION_AI_STEPS_MAX)
      refuse('steps', `a rule holds up to ${AUTOMATION_AI_STEPS_MAX} AI actions`);
    if (isPersonless(trigger))
      checkPersonless(
        conditions,
        steps,
        isTimeTrigger(trigger) ? 'A time trigger' : 'An incoming webhook',
      );
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

// ---- Names ---------------------------------------------------------------------------------------------------------

const nameKey = (name: string) => name.trim().toLowerCase();

// Whether another rule of the plan has this name (case aside).
export const ruleNameTaken = (
  name: string,
  rules: readonly { id: string; name: string }[],
  exceptId?: string,
): boolean => rules.some((r) => r.id !== exceptId && nameKey(r.name) === nameKey(name));

// The first free name from `base`: "New Rule", then "New Rule 2" and on. Cut so the number always fits.
export function freeRuleName(base: string, rules: readonly { id: string; name: string }[]): string {
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? '' : ` ${n}`;
    const name = `${base.trim().slice(0, AUTOMATION_NAME_MAX - suffix.length)}${suffix}`;
    if (!ruleNameTaken(name, rules)) return name;
  }
}
