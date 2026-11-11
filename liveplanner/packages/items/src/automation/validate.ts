// Automations: a rule as a person wrote it, checked (docs/specs/026-plan/automations.md "A rule", "Limits"; blueprint
// automations.md "Files", "Routes"). `readRuleBody` answers the rule as it is kept (unknown keys dropped), or the first
// refusal with the `path` of the part at fault (`steps.2.text`) for the builder to mark. What a rule names that the
// plan lacks is not a refusal: it needs attention (attention.ts). Also the rule's name rules. Pure.

import { ITEM_LABEL_MAX, ITEM_TITLE_MAX } from '../limits';
import { isRuleTimeZone, isDay } from '../repeat-dates';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_CREATED_PER_RUN,
  AUTOMATION_NAME_MAX,
  AUTOMATION_TEXT_MAX,
  AUTOMATION_TRIGGER_KINDS,
  type AutomationAction,
  type AutomationCondition,
  type AutomationDay,
  type AutomationFieldOp,
  type AutomationRuleBody,
  type AutomationSetValue,
  type AutomationStep,
  type AutomationTrigger,
  type AutomationWho,
} from './types';
import { unknownValueIn } from './values';

export type RuleRefusal = {
  error: 'automation_invalid' | 'automation_value_unknown';
  path: string;
  message: string;
};

export const AUTOMATION_SUBJECT_MAX = 200;
// The most ids one list in a rule names (columns, types, fields, people).
export const AUTOMATION_LIST_MAX = 50;
const ID_MAX = 80;
const DAYS_MAX = 3650;

const FIELD_OPS: ReadonlySet<string> = new Set<AutomationFieldOp>([
  'is',
  'is_not',
  'empty',
  'not_empty',
  'contains',
  'not_contains',
  'before',
  'after',
  'on_or_before',
  'on_or_after',
  'less_than',
  'more_than',
]);
const DATE_OPS = new Set(['before', 'after', 'on_or_before', 'on_or_after']);
const NUMBER_OPS = new Set(['less_than', 'more_than']);
const ROLES = new Set(['editor', 'participant', 'agent']);
const COPIES = new Set(['assignee', 'labels', 'due']);

// A refusal thrown inside the walk and caught at its top, so each check is one line.
class Refused extends Error {
  readonly refusal: RuleRefusal;
  constructor(refusal: RuleRefusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}
const refuse = (path: string, message: string): never => {
  throw new Refused({ error: 'automation_invalid', path, message });
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const obj = (v: unknown, path: string): Obj =>
  isObj(v) ? v : refuse(path, `${path} must be an object`);

const id = (v: unknown, path: string): string =>
  typeof v === 'string' && v.length > 0 && v.length <= ID_MAX
    ? v
    : refuse(path, `${path} must name one`);

function ids(v: unknown, path: string, opts: { min?: number } = {}): string[] {
  if (!Array.isArray(v) || v.length < (opts.min ?? 0) || v.length > AUTOMATION_LIST_MAX)
    refuse(path, `${path} must be a list of ${opts.min ?? 0} to ${AUTOMATION_LIST_MAX}`);
  return [...new Set((v as unknown[]).map((x, i) => id(x, `${path}.${i}`)))];
}

const optionalIds = (v: unknown, path: string) => (v === undefined ? undefined : ids(v, path));

// Text a rule writes: within its bound, every value one the builder knows.
function text(v: unknown, path: string, max: number, opts: { empty?: boolean } = {}): string {
  if (typeof v !== 'string' || v.length > max || (!opts.empty && v.trim() === ''))
    refuse(path, `${path} must be text of up to ${max} characters`);
  const unknown = unknownValueIn(v as string);
  if (unknown !== null)
    throw new Refused({
      error: 'automation_value_unknown',
      path,
      message: `{{${unknown}}} is not a value`,
    });
  return v as string;
}

const not = (v: unknown, path: string): { not?: true } =>
  v === undefined || v === false
    ? {}
    : v === true
      ? { not: true }
      : refuse(path, `${path} must be true`);

function day(v: unknown, path: string): AutomationDay {
  const o = obj(v, path);
  if (typeof o['day'] === 'string' && isDay(o['day'])) return { day: o['day'] };
  const n = o['today'];
  if (typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= DAYS_MAX) return { today: n };
  return refuse(path, `${path} must be a day or today ± days`);
}

function readTrigger(v: unknown): AutomationTrigger {
  const t = obj(v, 'trigger');
  const kind = t['kind'];
  if (!AUTOMATION_TRIGGER_KINDS.includes(kind as AutomationTrigger['kind']))
    refuse('trigger.kind', 'trigger.kind is not a trigger');
  switch (kind as AutomationTrigger['kind']) {
    case 'card_created':
      return t['status'] === undefined
        ? { kind: 'card_created' }
        : { kind: 'card_created', status: id(t['status'], 'trigger.status') };
    case 'form_response':
      return t['formTab'] === undefined
        ? { kind: 'form_response' }
        : { kind: 'form_response', formTab: id(t['formTab'], 'trigger.formTab') };
    case 'card_moved': {
      const from = optionalIds(t['from'], 'trigger.from');
      const to = optionalIds(t['to'], 'trigger.to');
      return { kind: 'card_moved', ...(from ? { from } : {}), ...(to ? { to } : {}) };
    }
    case 'field_changed':
      return { kind: 'field_changed', fields: ids(t['fields'], 'trigger.fields', { min: 1 }) };
    case 'comment_added':
      return { kind: 'comment_added' };
    case 'manual':
      return { kind: 'manual' };
  }
}

function readWho(v: unknown, path: string): AutomationWho {
  const w = obj(v, path);
  if (w['person'] !== undefined) return { person: id(w['person'], `${path}.person`) };
  if (typeof w['role'] === 'string' && ROLES.has(w['role']))
    return { role: w['role'] as 'editor' | 'participant' | 'agent' };
  return refuse(path, `${path} must be a person or a role`);
}

type FieldValue = Extract<AutomationCondition, { kind: 'field' }>['value'];

// A field condition's value for its comparison: none for empty, a day for the date ones, a number for the number
// ones, else text, a number or a list.
function readFieldValue(op: string, v: unknown, path: string): { value?: FieldValue } {
  if (op === 'empty' || op === 'not_empty') return {};
  if (DATE_OPS.has(op)) return { value: day(v, path) };
  if (NUMBER_OPS.has(op)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) refuse(path, `${path} must be a number`);
    return { value: v as number };
  }
  if (typeof v === 'number' && Number.isFinite(v)) return { value: v };
  if (Array.isArray(v)) return { value: ids(v, path, { min: 1 }) };
  return { value: text(v, path, AUTOMATION_TEXT_MAX) };
}

function readCondition(v: unknown, path: string): AutomationCondition {
  const c = obj(v, path);
  switch (c['kind']) {
    case 'type':
      return {
        kind: 'type',
        ...not(c['not'], `${path}.not`),
        types: ids(c['types'], `${path}.types`, { min: 1 }),
      };
    case 'column':
      return {
        kind: 'column',
        ...not(c['not'], `${path}.not`),
        statuses: ids(c['statuses'], `${path}.statuses`, { min: 1 }),
      };
    case 'field': {
      const op = c['op'];
      if (typeof op !== 'string' || !FIELD_OPS.has(op))
        refuse(`${path}.op`, `${path}.op is not a comparison`);
      const field = id(c['field'], `${path}.field`);
      return {
        kind: 'field',
        field,
        op: op as AutomationFieldOp,
        ...readFieldValue(op as string, c['value'], `${path}.value`),
      };
    }
    case 'who': {
      if (
        !Array.isArray(c['who']) ||
        c['who'].length === 0 ||
        c['who'].length > AUTOMATION_LIST_MAX
      )
        refuse(`${path}.who`, `${path}.who must name someone`);
      const who = (c['who'] as unknown[]).map((w, i) => readWho(w, `${path}.who.${i}`));
      return { kind: 'who', ...not(c['not'], `${path}.not`), who };
    }
    case 'saved_filter':
      return {
        kind: 'saved_filter',
        tab: id(c['tab'], `${path}.tab`),
        filter: id(c['filter'], `${path}.filter`),
      };
    default:
      return refuse(`${path}.kind`, `${path}.kind is not a condition`);
  }
}

function readConditions(v: unknown, path: string): AutomationCondition[] {
  if (!Array.isArray(v) || v.length > AUTOMATION_CONDITIONS_MAX)
    refuse(path, `${path} must be a list of up to ${AUTOMATION_CONDITIONS_MAX}`);
  return (v as unknown[]).map((c, i) => readCondition(c, `${path}.${i}`));
}

function readSetValue(v: unknown, path: string): AutomationSetValue {
  const o = obj(v, path);
  if (o['text'] !== undefined)
    return { text: text(o['text'], `${path}.text`, AUTOMATION_TEXT_MAX) };
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

function readAction(v: unknown, path: string): AutomationAction {
  const a = obj(v, path);
  switch (a['kind']) {
    case 'move':
      return { kind: 'move', status: id(a['status'], `${path}.status`) };
    case 'set_field':
      return {
        kind: 'set_field',
        field: id(a['field'], `${path}.field`),
        value: readSetValue(a['value'], `${path}.value`),
      };
    case 'clear_field':
      return { kind: 'clear_field', field: id(a['field'], `${path}.field`) };
    case 'assign': {
      const to = obj(a['to'], `${path}.to`);
      if (to['person'] !== undefined)
        return { kind: 'assign', to: { person: id(to['person'], `${path}.to.person`) } };
      if (to['trigger'] === true) return { kind: 'assign', to: { trigger: true } };
      if (to['nobody'] === true) return { kind: 'assign', to: { nobody: true } };
      return refuse(`${path}.to`, `${path}.to must be a person, whoever triggered it, or nobody`);
    }
    case 'add_label':
    case 'remove_label':
      return { kind: a['kind'], label: text(a['label'], `${path}.label`, ITEM_LABEL_MAX).trim() };
    case 'comment':
      return { kind: 'comment', text: text(a['text'], `${path}.text`, AUTOMATION_TEXT_MAX) };
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
        title: text(a['title'], `${path}.title`, ITEM_TITLE_MAX),
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
        subject: text(a['subject'], `${path}.subject`, AUTOMATION_SUBJECT_MAX),
        body: text(a['body'], `${path}.body`, AUTOMATION_TEXT_MAX),
      };
    }
    default:
      return refuse(`${path}.kind`, `${path}.kind is not an action`);
  }
}

function readActions(v: unknown, path: string): AutomationAction[] {
  if (!Array.isArray(v)) refuse(path, `${path} must be a list`);
  return (v as unknown[]).map((a, i) => readAction(a, `${path}.${i}`));
}

function readStep(v: unknown, path: string): AutomationStep {
  const s = obj(v, path);
  if (s['kind'] !== 'if') return readAction(s, path);
  const conditions = readConditions(s['conditions'], `${path}.conditions`);
  if (conditions.length === 0) refuse(`${path}.conditions`, 'an If needs a condition');
  return {
    kind: 'if',
    conditions,
    then: readActions(s['then'], `${path}.then`),
    else: readActions(s['else'], `${path}.else`),
  };
}

const creates = (actions: readonly AutomationAction[]) =>
  actions.filter((a) => a.kind === 'create_card').length;

// How many actions the steps hold, counting those inside an If / Else.
export function countActions(steps: readonly AutomationStep[]): number {
  return steps.reduce((n, s) => n + (s.kind === 'if' ? s.then.length + s.else.length : 1), 0);
}

// The most cards one run of the steps could make: the top level's, and the larger branch of each If.
function createsPerRun(steps: readonly AutomationStep[]): number {
  return steps.reduce(
    (n, s) => n + (s.kind === 'if' ? Math.max(creates(s.then), creates(s.else)) : creates([s])),
    0,
  );
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
    const steps = (r['steps'] as unknown[]).map((s, i) => readStep(s, `steps.${i}`));
    if (countActions(steps) > AUTOMATION_ACTIONS_MAX)
      refuse('steps', `a rule holds up to ${AUTOMATION_ACTIONS_MAX} actions`);
    if (createsPerRun(steps) > AUTOMATION_CREATED_PER_RUN)
      refuse('steps', `a run makes up to ${AUTOMATION_CREATED_PER_RUN} card`);
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
