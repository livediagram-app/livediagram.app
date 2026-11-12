// Automations: a rule's trigger and its conditions, checked (docs/specs/026-plan/automations.md "A rule", "Limits").
// Read with the primitives of validate-read.ts, so a part at fault throws its refusal for readRuleBody (validate.ts)
// to answer. Pure.

import {
  AUTOMATION_COLUMN_LIMIT_MAX,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_DUE_DAYS_MAX,
  AUTOMATION_STUCK_DAYS_MAX,
  AUTOMATION_TEXT_MAX,
  AUTOMATION_TRIGGER_KINDS,
  type AutomationCondition,
  type AutomationFieldOp,
  type AutomationTrigger,
  type AutomationWho,
} from './types';
import {
  AUTOMATION_LIST_MAX,
  clock,
  day,
  id,
  ids,
  not,
  obj,
  optionalIds,
  refuse,
  text,
  whole,
  type Obj,
} from './validate-read';

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
const EVERY = new Set(['day', 'weekday', 'week', 'month']);

function readWeekdays(v: unknown, path: string): number[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 7)
    refuse(path, `${path} must name 1 to 7 days`);
  const days = (v as unknown[]).map((d, i) => whole(d, `${path}.${i}`, 0, 6));
  return [...new Set(days)].sort((a, b) => a - b);
}

function readScheduled(t: Obj): AutomationTrigger {
  const every = t['every'];
  if (typeof every !== 'string' || !EVERY.has(every))
    refuse('trigger.every', 'trigger.every must be day, weekday, week or month');
  const at = clock(t['at'], 'trigger.at');
  if (every === 'week')
    return { kind: 'scheduled', every, days: readWeekdays(t['days'], 'trigger.days'), at };
  if (every === 'month')
    return {
      kind: 'scheduled',
      every,
      dayOfMonth: whole(t['dayOfMonth'], 'trigger.dayOfMonth', 1, 31),
      at,
    };
  return { kind: 'scheduled', every: every as 'day' | 'weekday', at };
}

export function readTrigger(v: unknown): AutomationTrigger {
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
    case 'scheduled':
      return readScheduled(t);
    case 'due_in':
      return {
        kind: 'due_in',
        days: whole(t['days'], 'trigger.days', 1, AUTOMATION_DUE_DAYS_MAX),
        at: clock(t['at'], 'trigger.at'),
      };
    case 'overdue':
      return { kind: 'overdue', at: clock(t['at'], 'trigger.at') };
    case 'incoming_webhook':
    case 'card_archived':
    case 'card_restored':
    case 'checklist_completed':
    case 'threads_resolved':
    case 'card_unblocked':
      return { kind: kind as 'card_archived' };
    case 'mentioned': {
      const people = optionalIds(t['people'], 'trigger.people');
      return { kind: 'mentioned', ...(people?.length ? { people } : {}) };
    }
    case 'related_done':
      if (t['related'] !== 'children' && t['related'] !== 'linked')
        refuse('trigger.related', 'trigger.related must be children or linked');
      return { kind: 'related_done', related: t['related'] as 'children' | 'linked' };
    case 'column_limit':
      return {
        kind: 'column_limit',
        status: id(t['status'], 'trigger.status'),
        limit: whole(t['limit'], 'trigger.limit', 1, AUTOMATION_COLUMN_LIMIT_MAX),
      };
    case 'stuck': {
      const statuses = optionalIds(t['statuses'], 'trigger.statuses');
      return {
        kind: 'stuck',
        days: whole(t['days'], 'trigger.days', 1, AUTOMATION_STUCK_DAYS_MAX),
        at: clock(t['at'], 'trigger.at'),
        ...(statuses?.length ? { statuses } : {}),
      };
    }
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

export function readConditions(v: unknown, path: string): AutomationCondition[] {
  if (!Array.isArray(v) || v.length > AUTOMATION_CONDITIONS_MAX)
    refuse(path, `${path} must be a list of up to ${AUTOMATION_CONDITIONS_MAX}`);
  return (v as unknown[]).map((c, i) => readCondition(c, `${path}.${i}`));
}
