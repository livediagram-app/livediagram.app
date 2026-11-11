// Automations: a run's steps worked out, without touching anything (docs/specs/026-plan/automations.md "Actions",
// "Runs, limits and loops"; blueprint automations.md "Files", "The run"). `planActions` walks the steps and each If /
// Else in order against the card as the steps before left it, folds every change to the card into ONE patch (set and
// clear, in step order), and gathers the comments, the card to make and the emails. An action that would change
// nothing is "Already so"; one the card refuses fails the run there, with the lines so far. The api applies the plan
// (automation-writes.ts); Test on a Card shows it. Pure.

import {
  itemAssignee,
  itemLabels,
  type Item,
  type ItemFieldValue,
  type ItemFields,
  type ItemPatch,
  type ItemPerson,
} from '../item';
import type { CustomFieldDef, ItemTypeDef } from '../item-types';
import { ITEM_LABELS_MAX, ITEM_TITLE_MAX } from '../limits';
import { isPriority, validateFields } from '../fields';
import { isDay } from '../repeat-dates';
import { isEmptyFieldValue, requiredCustomFieldsOf } from '../required-fields';
import { typeAllowsStatus, typeIn } from '../type-catalogue';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_CREATED_PER_RUN,
  AUTOMATION_PERSON_ID,
  AUTOMATION_TEXT_MAX,
  type AutomationAction,
  type AutomationSetValue,
  type AutomationStep,
  type AutomationStepLine,
} from './types';
import { allHold, type ConditionContext } from './conditions';
import { fieldDefOf, fieldName, personOf, statusName, typeName } from './outline';
import { dayFrom, fieldText, fillValues, type ValueContext } from './values';

export interface PlanActionsContext extends ConditionContext {
  rule: { name: string };
  // The link that opens the card, for {{card.url}}.
  url: string;
}

// The card a Create Card makes: its type, its column (absent: the type's Default State) and fields.
export interface PlannedCard {
  type: string;
  status?: string;
  fields: ItemFields;
}

// An email to send: the person it goes to (null: nobody, so none is sent), its subject and body, filled in.
export interface PlannedEmail {
  to: ItemPerson | null;
  subject: string;
  body: string;
}

export type PlannedRun =
  | {
      patch: ItemPatch;
      comments: string[];
      created: PlannedCard[];
      emails: PlannedEmail[];
      lines: AutomationStepLine[];
    }
  | { failed: string; lines: AutomationStepLine[] };

const DATE_FIELDS = new Set(['start', 'due']);
const NUMBER_KINDS = new Set(['number', 'currency', 'percent', 'duration', 'rating']);
const LIST_KINDS = new Set(['labels', 'multichoice']);

class Failed extends Error {}
const fail = (reason: string): never => {
  throw new Failed(reason);
};

const same = (a: ItemFieldValue | undefined, b: ItemFieldValue | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// The walk's state: the card as the steps so far left it, and the one patch that gets it there.
class Plan {
  readonly set: ItemFields = {};
  readonly clear = new Set<string>();
  readonly comments: string[] = [];
  readonly created: PlannedCard[] = [];
  readonly emails: PlannedEmail[] = [];
  readonly lines: AutomationStepLine[] = [];
  actions = 0;
  card: Item;

  private readonly was: ItemFields;

  constructor(card: Item) {
    this.was = card.fields;
    this.card = { ...card, fields: { ...card.fields } };
  }

  // Sets or clears one field: whether that changed the card. The patch holds what differs from the card as it was.
  write(field: string, value: ItemFieldValue | undefined): boolean {
    const next = value === undefined || isEmptyFieldValue(value) ? undefined : value;
    if (same(this.card.fields[field], next)) return false;
    if (next === undefined) delete this.card.fields[field];
    else this.card.fields[field] = next;
    delete this.set[field];
    this.clear.delete(field);
    if (!same(this.was[field], next)) {
      if (next === undefined) this.clear.add(field);
      else this.set[field] = next;
    }
    return true;
  }

  line(text: string, changed = true): void {
    this.lines.push({
      kind: 'action',
      ok: true,
      text,
      ...(changed ? {} : { already: true as const }),
    });
  }

  patch(): ItemPatch {
    return {
      ...(Object.keys(this.set).length ? { set: { ...this.set } } : {}),
      ...(this.clear.size ? { clear: [...this.clear] } : {}),
    };
  }
}

function fieldKind(field: string, def: CustomFieldDef | undefined): string {
  if (DATE_FIELDS.has(field)) return 'date';
  if (field === 'estimate') return 'number';
  if (field === 'labels') return 'labels';
  if (field === 'priority') return 'priority';
  if (field === 'assignee') return 'person';
  return def?.kind ?? 'text';
}

// A Set Field's value, as the field takes it; a refusal names why.
function setValueOf(
  value: AutomationSetValue,
  field: string,
  name: string,
  kind: string,
  plan: Plan,
  ctx: PlanActionsContext,
  values: ValueContext,
): ItemFieldValue | undefined {
  if ('from' in value) return plan.card.fields[value.from];
  if ('date' in value) return dayFrom(value.date, ctx.now, ctx.timeZone);
  if ('number' in value) return value.number;
  if ('list' in value) return value.list;
  const text = fillValues(
    value.text,
    { ...values, card: plan.card },
    { iso: kind === 'date' },
  ).trim();
  if (text === '') return undefined;
  if (kind === 'date') return isDay(text) ? text : fail(`${name} needs a day, not "${value.text}"`);
  if (NUMBER_KINDS.has(kind)) {
    const n = Number(text);
    return Number.isFinite(n) ? n : fail(`${name} needs a number, not "${text}"`);
  }
  if (LIST_KINDS.has(kind)) return [text];
  if (kind === 'priority') {
    const p = text.toLowerCase();
    return isPriority(p) ? p : fail(`${name} has no "${text}"`);
  }
  if (kind === 'person') {
    const p = ctx.outline.people.find(
      (x) => x.id === text || x.name.toLowerCase() === text.toLowerCase(),
    );
    return p ?? fail(`Nobody called "${text}" can be set`);
  }
  return field === 'title' ? text.slice(0, ITEM_TITLE_MAX) : text;
}

// Whoever triggered the rule, when that is a person a card can name.
const triggerPerson = (ctx: PlanActionsContext): ItemPerson | null =>
  ctx.role === 'automation' || ctx.role === 'system' || ctx.by.id === AUTOMATION_PERSON_ID
    ? null
    : ctx.by;

function apply(
  a: AutomationAction,
  plan: Plan,
  ctx: PlanActionsContext,
  type: ItemTypeDef,
  values: ValueContext,
) {
  const o = ctx.outline;
  const fill = (text: string) => fillValues(text, { ...values, card: plan.card });
  switch (a.kind) {
    case 'move': {
      const name = statusName(o, a.status);
      if (!o.statuses.some((s) => s.status === a.status)) fail(`Column ${a.status} is gone`);
      if (!typeAllowsStatus(type, a.status)) fail(`A ${type.label} card can't go in ${name}`);
      return plan.line(`Move to ${name}`, plan.write('status', a.status));
    }
    case 'set_field':
    case 'clear_field': {
      const def = fieldDefOf(o, a.field, type);
      const name = fieldName(o, a.field, type);
      if (def?.kind === 'calculated' || def?.calculation) fail(`${name} is worked out, never set`);
      const value =
        a.kind === 'set_field'
          ? setValueOf(a.value, a.field, name, fieldKind(a.field, def), plan, ctx, values)
          : undefined;
      if (value === undefined) {
        const required = requiredCustomFieldsOf(type).find((f) => f.id === a.field);
        if (required && !isEmptyFieldValue(plan.card.fields[a.field]))
          fail(`${type.label} cards need ${name}`);
        return plan.line(`Clear ${name}`, plan.write(a.field, undefined));
      }
      const checked = validateFields({ [a.field]: value }, 'patch');
      if (!checked.ok) fail(`${name} can't hold that value`);
      return plan.line(`Set ${name} to ${fieldText(value, a.field)}`, plan.write(a.field, value));
    }
    case 'assign': {
      if ('nobody' in a.to) return plan.line('Unassign', plan.write('assignee', undefined));
      const person = 'person' in a.to ? personOf(o, a.to.person) : triggerPerson(ctx);
      if (!person)
        return fail(
          'trigger' in a.to ? 'Nobody to assign: no person made the change' : 'That person is gone',
        );
      return plan.line(`Assign ${person.name}`, plan.write('assignee', person));
    }
    case 'add_label':
    case 'remove_label': {
      const labels = itemLabels(plan.card);
      const has = labels.includes(a.label);
      if (a.kind === 'remove_label')
        return plan.line(
          `Remove Label ${a.label}`,
          plan.write(
            'labels',
            labels.filter((l) => l !== a.label),
          ),
        );
      if (!has && labels.length >= ITEM_LABELS_MAX)
        fail(`A card holds up to ${ITEM_LABELS_MAX} labels`);
      return plan.line(
        `Add Label ${a.label}`,
        plan.write('labels', has ? labels : [...labels, a.label]),
      );
    }
    case 'comment':
      plan.comments.push(fill(a.text).slice(0, AUTOMATION_TEXT_MAX));
      return plan.line('Add Comment');
    case 'flag':
      return plan.line('Flag', plan.write('flagged', true));
    case 'unflag':
      return plan.line('Unflag', plan.write('flagged', undefined));
    case 'archive':
      return plan.line('Archive', plan.write('archived', true));
    case 'create_card':
      return createCard(a, plan, ctx, values);
    case 'email': {
      const to =
        'assignee' in a.to
          ? (itemAssignee(plan.card) ?? null)
          : 'trigger' in a.to
            ? triggerPerson(ctx)
            : (personOf(o, a.to.person) ?? null);
      plan.emails.push({
        to,
        subject: fill(a.subject),
        body: fill(a.body).slice(0, AUTOMATION_TEXT_MAX),
      });
      return plan.line(
        to ? `Send Email to ${to.name}` : 'Send Email (nobody to send it to)',
        to !== null,
      );
    }
  }
}

function createCard(
  a: Extract<AutomationAction, { kind: 'create_card' }>,
  plan: Plan,
  ctx: PlanActionsContext,
  values: ValueContext,
) {
  const o = ctx.outline;
  if (plan.created.length >= AUTOMATION_CREATED_PER_RUN)
    fail(`A run makes up to ${AUTOMATION_CREATED_PER_RUN} card`);
  const type = o.types.find((t) => t.id === a.type);
  if (!type) return fail(`Card type ${a.type} is gone`);
  if (a.status && !o.statuses.some((s) => s.status === a.status))
    fail(`Column ${a.status} is gone`);
  const title = fillValues(a.title, { ...values, card: plan.card })
    .trim()
    .slice(0, ITEM_TITLE_MAX);
  const fields: ItemFields = { title: title || type.newTitle };
  for (const part of a.copy ?? []) {
    const v = plan.card.fields[part];
    if (!isEmptyFieldValue(v)) fields[part] = v!;
  }
  if (a.linkField) {
    const def = type.custom?.find((f) => f.id === a.linkField && f.kind === 'card');
    if (!def) return fail(`A ${type.label} card has no Card field ${a.linkField}`);
    fields[a.linkField] = def.multiple ? [plan.card.id] : plan.card.id;
  }
  plan.created.push({ type: type.id, ...(a.status ? { status: a.status } : {}), fields });
  plan.line(`Create ${typeName(o, type.id)} "${fields['title'] as string}"`);
}

function step(
  a: AutomationAction,
  plan: Plan,
  ctx: PlanActionsContext,
  type: ItemTypeDef,
  values: ValueContext,
) {
  plan.actions += 1;
  if (plan.actions > AUTOMATION_ACTIONS_MAX)
    fail(`A run makes up to ${AUTOMATION_ACTIONS_MAX} changes`);
  apply(a, plan, ctx, type, values);
}

// The run's steps against the card, worked out: the one patch, the comments, the card to make and the emails, with
// a line per step; or where it failed and why.
export function planActions(steps: readonly AutomationStep[], ctx: PlanActionsContext): PlannedRun {
  const plan = new Plan(ctx.card);
  const type = typeIn(ctx.outline.types, ctx.card.type);
  const values: ValueContext = {
    card: plan.card,
    type,
    outline: ctx.outline,
    url: ctx.url,
    person: ctx.by.name,
    rule: ctx.rule.name,
    now: ctx.now,
    timeZone: ctx.timeZone,
  };
  try {
    for (const s of steps) {
      if (s.kind !== 'if') {
        step(s, plan, ctx, type, values);
        continue;
      }
      const held = allHold(s.conditions, { ...ctx, card: plan.card });
      for (const l of held.lines) plan.lines.push({ kind: 'condition', ...l });
      for (const a of held.ok ? s.then : s.else) step(a, plan, ctx, type, values);
    }
  } catch (error) {
    if (!(error instanceof Failed)) throw error;
    plan.lines.push({ kind: 'action', ok: false, text: error.message });
    return { failed: error.message, lines: plan.lines };
  }
  return {
    patch: plan.patch(),
    comments: plan.comments,
    created: plan.created,
    emails: plan.emails,
    lines: plan.lines,
  };
}
