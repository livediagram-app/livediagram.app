// Automations: a rule as a person wrote it, checked (docs/specs/026-plan/automations.md "A rule", "Limits"; blueprint
// automations.md "Files", "Routes"). `readRuleBody` answers the rule as it is kept (unknown keys dropped), or the first
// refusal with the `path` of the part at fault (`steps.2.text`) for the builder to mark. What a rule names that the
// plan lacks is not a refusal: it needs attention (attention.ts). Also the rule's name rules. Pure.

import { ITEM_CHECKLIST_TEXT_MAX, ITEM_LABEL_MAX, ITEM_TITLE_MAX } from '../limits';
import { itemColourValue } from '../item-colour';
import { isRuleTimeZone, isDay } from '../repeat-dates';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_BRANCH_ACTIONS_MAX,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_CREATED_PER_RUN,
  AUTOMATION_DUE_DAYS_MAX,
  AUTOMATION_NAME_MAX,
  AUTOMATION_OUTGOING_MAX,
  AUTOMATION_ROTATE_MAX,
  AUTOMATION_ROTATE_MIN,
  AUTOMATION_TEXT_MAX,
  AUTOMATION_TRIGGER_KINDS,
  isPersonless,
  isTimeTrigger,
  AUTOMATION_AI_STEPS_MAX,
  AUTOMATION_CHECKLIST_ITEMS_MAX,
  AUTOMATION_COLUMN_LIMIT_MAX,
  AUTOMATION_STUCK_DAYS_MAX,
  AUTOMATION_WAITS_MAX,
  AUTOMATION_WAIT_HOURS_MAX,
  AUTOMATION_WAIT_HOURS_MIN,
  type AutomationAction,
  type AutomationAi,
  type AutomationBranch,
  type AutomationCondition,
  type AutomationOutgoing,
  type AutomationRelated,
  type AutomationDay,
  type AutomationFieldOp,
  type AutomationRuleBody,
  type AutomationSetValue,
  type AutomationStep,
  type AutomationTrigger,
  type AutomationWait,
  type AutomationWho,
} from './types';
import { unknownValueIn, type ValuePlace } from './values';
import { clockMinutes } from './schedule';
import { readAiStep } from './ai-steps';

export type RuleRefusal = {
  error:
    | 'automation_invalid'
    | 'automation_value_unknown'
    | 'automation_condition_unsupported'
    | 'automation_step_unsupported';
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
const EVERY = new Set(['day', 'weekday', 'week', 'month']);
const VIA = new Set(['webhook', 'slack', 'teams']);
// The steps a branch may not hold, and an If / Else's actions neither.
const NOT_IN_BRANCH = new Set(['if', 'for', 'create_card', 'copy_card', 'notify', 'ai', 'wait']);
const NOT_IN_IF = new Set(['if', 'for', 'notify', 'ai', 'wait']);

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
const unsupported = (
  error: 'automation_condition_unsupported' | 'automation_step_unsupported',
  path: string,
  message: string,
): never => {
  throw new Refused({ error, path, message });
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

// Text a rule writes: within its bound, every value one the builder knows (a branch's knows the triggering card's).
function text(
  v: unknown,
  path: string,
  max: number,
  opts: { empty?: boolean } & ValuePlace = {},
): string {
  if (typeof v !== 'string' || v.length > max || (!opts.empty && v.trim() === ''))
    refuse(path, `${path} must be text of up to ${max} characters`);
  const unknown = unknownValueIn(v as string, opts);
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

function clock(v: unknown, path: string): string {
  if (clockMinutes(v) === null)
    refuse(path, `${path} must be a time on the quarter hour, as 09:15`);
  return v as string;
}

const whole = (v: unknown, path: string, min: number, max: number): number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max
    ? (v as number)
    : refuse(path, `${path} must be a whole number from ${min} to ${max}`);

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

function readConditions(v: unknown, path: string): AutomationCondition[] {
  if (!Array.isArray(v) || v.length > AUTOMATION_CONDITIONS_MAX)
    refuse(path, `${path} must be a list of up to ${AUTOMATION_CONDITIONS_MAX}`);
  return (v as unknown[]).map((c, i) => readCondition(c, `${path}.${i}`));
}

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
    case 'set_type':
      return { kind: 'set_type', type: id(a['type'], `${path}.type`) };
    case 'set_colour': {
      if (a['colour'] === null) return { kind: 'set_colour', colour: null };
      const colour = itemColourValue(a['colour']);
      return colour
        ? { kind: 'set_colour', colour }
        : refuse(`${path}.colour`, `${path}.colour must be a #rrggbb colour or null`);
    }
    case 'restore':
    case 'resolve_threads':
      return { kind: a['kind'] };
    case 'copy_card':
      return {
        kind: 'copy_card',
        ...(a['status'] !== undefined ? { status: id(a['status'], `${path}.status`) } : {}),
      };
    case 'add_checklist': {
      const items = a['items'];
      if (
        !Array.isArray(items) ||
        items.length === 0 ||
        items.length > AUTOMATION_CHECKLIST_ITEMS_MAX
      )
        refuse(
          `${path}.items`,
          `${path}.items must hold 1 to ${AUTOMATION_CHECKLIST_ITEMS_MAX} items`,
        );
      const read = (items as unknown[]).map((t, i) =>
        text_(t, `${path}.items.${i}`, ITEM_CHECKLIST_TEXT_MAX).trim(),
      );
      if (read.some((t) => !t)) refuse(`${path}.items`, `${path}.items can't hold an empty item`);
      return { kind: 'add_checklist', items: read };
    }
    case 'link_card': {
      const to = obj(a['to'], `${path}.to`);
      const target =
        to['trigger'] === true
          ? { trigger: true as const }
          : to['card'] !== undefined
            ? { card: id(to['card'], `${path}.to.card`) }
            : refuse(`${path}.to`, `${path}.to must be a card or the card that started the rule`);
      return { kind: 'link_card', field: id(a['field'], `${path}.field`), to: target };
    }
    case 'mention': {
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
        kind: 'mention',
        to: recipient,
        text: text_(a['text'], `${path}.text`, AUTOMATION_TEXT_MAX),
      };
    }
    default:
      return refuse(`${path}.kind`, `${path}.kind is not an action`);
  }
}

function readWait(s: Record<string, unknown>, path: string): AutomationWait {
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
  if (s['kind'] === 'wait') return readWait(s, path);
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

const makesCard = (a: { kind: string }) => a.kind === 'create_card' || a.kind === 'copy_card';
const creates = (actions: readonly AutomationAction[]) => actions.filter(makesCard).length;

// The actions a step holds: an If / Else's both lists, a branch's, else the step itself.
export function stepActions(
  s: AutomationStep,
): readonly (AutomationAction | AutomationOutgoing | AutomationAi)[] {
  if (s.kind === 'if') return [...s.then, ...s.else];
  // A Wait is no action: it only holds the ones after it.
  if (s.kind === 'wait') return [];
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
      n + (s.kind === 'if' ? Math.max(creates(s.then), creates(s.else)) : makesCard(s) ? 1 : 0),
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
      if ((a.kind === 'assign' || a.kind === 'email' || a.kind === 'mention') && 'trigger' in a.to)
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
    if (steps.filter((s) => s.kind === 'wait').length > AUTOMATION_WAITS_MAX)
      refuse('steps', `a rule holds up to ${AUTOMATION_WAITS_MAX} Waits`);
    // Link to the card that started the rule: a branch's alone (outside one, that is the card itself).
    steps.forEach((s, i) => {
      if (s.kind === 'for') return;
      for (const a of stepActions(s))
        if (a.kind === 'link_card' && 'trigger' in a.to)
          refuse(`steps.${i}`, 'only a branch links to the card that started the rule');
    });
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
