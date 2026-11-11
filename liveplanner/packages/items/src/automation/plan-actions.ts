// Automations: a run's steps worked out, without touching anything (docs/specs/026-plan/automations.md "Actions",
// "Runs, limits and loops"; blueprint automations.md "Files", "The run"). `planActions` walks the steps and each If /
// Else in order against the card as the steps before left it, folds every change to the card into ONE patch (set and
// clear, in step order), and gathers the comments, the card to make, the emails and the outgoing messages. A branch
// (For Related Cards) plans its actions on each related card the same way, one patch per card; a card that refuses
// one fails its own steps only. Assign in Turn takes the rule's turn and says how many turns the run used. An action
// that would change nothing is "Already so"; one the card refuses fails the run there, with the lines so far. The api
// applies the plan (automation-writes.ts); Test on a Card shows it. Pure.

import { itemAssignee, itemLabels, type ItemFields, type ItemPerson } from '../item';
import { ITEM_LABELS_MAX, ITEM_TITLE_MAX } from '../limits';
import { validateFields } from '../fields';
import { isEmptyFieldValue, requiredCustomFieldsOf } from '../required-fields';
import { typeAllowsStatus } from '../type-catalogue';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_CREATED_PER_RUN,
  AUTOMATION_PERSON_ID,
  AUTOMATION_TEXT_MAX,
  type AutomationAction,
  type AutomationBranch,
  type AutomationOutgoing,
  type AutomationStep,
} from './types';
import { allHold } from './conditions';
import { fieldDefOf, fieldName, personOf, statusName, typeName } from './outline';
import { fieldText, fillValues } from './values';
import { relatedCards } from './related';
import { branchWords, notifyChip } from './sentence';
import { Failed, fail, fieldKind, setValueOf } from './set-value';
import {
  walkOf,
  type Plan,
  type PlanActionsContext,
  type PlannedRun,
  type PlannedWrites,
  Run,
  type Walk,
} from './plan-walk';

export type {
  PlanActionsContext,
  PlannedCard,
  PlannedEmail,
  PlannedRelated,
  PlannedRun,
  PlannedSend,
  PlannedWrites,
} from './plan-walk';

// Whoever triggered the rule, when that is a person a card can name.
const triggerPerson = (ctx: PlanActionsContext): ItemPerson | null =>
  ctx.role === 'automation' || ctx.role === 'system' || ctx.by.id === AUTOMATION_PERSON_ID
    ? null
    : ctx.by;

// Assign in Turn: whose turn it is (passing over people who left the plan), and the turns that took.
function inTurn(ids: readonly string[], w: Walk): ItemPerson {
  const base = (w.ctx.turn ?? 0) + w.plan.run.turns;
  for (let i = 0; i < ids.length; i += 1) {
    const person = personOf(w.ctx.outline, ids[(base + i) % ids.length]!);
    if (!person) continue;
    w.plan.run.turns += i + 1;
    return person;
  }
  return fail('Nobody in turn is in the plan any more');
}

function assign(a: Extract<AutomationAction, { kind: 'assign' }>, w: Walk) {
  const { plan, ctx } = w;
  if ('nobody' in a.to) return plan.line('Unassign', plan.write('assignee', undefined));
  if ('rotate' in a.to) {
    const person = inTurn(a.to.rotate, w);
    return plan.line(`Assign ${person.name} (in turn)`, plan.write('assignee', person));
  }
  const person = 'person' in a.to ? personOf(ctx.outline, a.to.person) : triggerPerson(ctx);
  if (!person)
    return fail(
      'trigger' in a.to ? 'Nobody to assign: no person made the change' : 'That person is gone',
    );
  return plan.line(`Assign ${person.name}`, plan.write('assignee', person));
}

function setField(a: Extract<AutomationAction, { kind: 'set_field' | 'clear_field' }>, w: Walk) {
  const { plan, ctx, type } = w;
  const def = fieldDefOf(ctx.outline, a.field, type);
  const name = fieldName(ctx.outline, a.field, type);
  if (def?.kind === 'calculated' || def?.calculation) fail(`${name} is worked out, never set`);
  const value =
    a.kind === 'set_field'
      ? setValueOf({
          value: a.value,
          field: a.field,
          name,
          kind: fieldKind(a.field, def),
          card: plan.card,
          outline: ctx.outline,
          now: ctx.now,
          timeZone: ctx.timeZone,
          values: w.values,
        })
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

function apply(a: AutomationAction, w: Walk) {
  const { plan, ctx, type } = w;
  const o = ctx.outline;
  const fill = (text: string) => fillValues(text, { ...w.values, card: plan.card });
  switch (a.kind) {
    case 'move': {
      const name = statusName(o, a.status);
      if (!o.statuses.some((s) => s.status === a.status)) fail(`Column ${a.status} is gone`);
      if (!typeAllowsStatus(type, a.status)) fail(`A ${type.label} card can't go in ${name}`);
      return plan.line(`Move to ${name}`, plan.write('status', a.status));
    }
    case 'set_field':
    case 'clear_field':
      return setField(a, w);
    case 'assign':
      return assign(a, w);
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
      return createCard(a, w);
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

function createCard(a: Extract<AutomationAction, { kind: 'create_card' }>, w: Walk) {
  const { plan, ctx } = w;
  const o = ctx.outline;
  if (plan.created.length >= AUTOMATION_CREATED_PER_RUN)
    fail(`A run makes up to ${AUTOMATION_CREATED_PER_RUN} card`);
  const type = o.types.find((t) => t.id === a.type);
  if (!type) return fail(`Card type ${a.type} is gone`);
  if (a.status && !o.statuses.some((s) => s.status === a.status))
    fail(`Column ${a.status} is gone`);
  const title = fillValues(a.title, { ...w.values, card: plan.card })
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

function count(run: Run, n = 1) {
  run.actions += n;
  if (run.actions > AUTOMATION_ACTIONS_MAX)
    fail(`A run makes up to ${AUTOMATION_ACTIONS_MAX} changes`);
}

// An outgoing message: planned with its line, sent (or not, for a test) by the api.
function notify(s: AutomationOutgoing, index: number, w: Walk) {
  const run = w.plan.run;
  run.sends.push({
    step: index,
    via: s.via,
    webhook: s.webhook,
    ...(s.name ? { name: s.name } : {}),
    text: fillValues(s.text, { ...w.values, card: w.plan.card }).slice(0, AUTOMATION_TEXT_MAX),
    line: run.lines.length,
  });
  w.plan.line(notifyChip(s));
}

// A branch: each related card's conditions, then its actions as one patch; a card that refuses one fails alone.
function branch(s: AutomationBranch, top: Walk) {
  const run = top.plan.run;
  count(run, s.then.length);
  const ctx = top.ctx;
  const found = relatedCards(top.plan.card, s.related, ctx.items ?? [], {
    ...ctx,
    card: top.plan.card,
  });
  const at = run.lines.length;
  const shown = found.cards.length;
  const text =
    found.total > shown
      ? `${branchWords(s.related)}: on ${shown} of ${found.total} related cards`
      : `${branchWords(s.related)}: on ${shown} related card${shown === 1 ? '' : 's'}`;
  run.lines.push({ kind: 'branch', ok: true, text, cards: shown });
  const failed: string[] = [];
  for (const card of found.cards) {
    const url = ctx.urlOf?.(card.id) ?? ctx.url;
    const w = walkOf(card, run, { ...ctx, card, url }, `#${card.key} `);
    w.values = { ...w.values, url, trigger: { card: top.plan.card, url: ctx.url } };
    const held = allHold(s.conditions, { ...ctx, card });
    const miss = held.lines.find((l) => !l.ok);
    if (miss) {
      run.lines.push({ kind: 'condition', ok: false, text: `#${card.key} ${miss.text}` });
      continue;
    }
    let reason: string | undefined;
    try {
      for (const a of s.then) apply(a, w);
    } catch (error) {
      if (!(error instanceof Failed)) throw error;
      reason = error.message;
      w.plan.failure(reason);
      failed.push(`#${card.key}`);
    }
    run.related.push({
      card,
      patch: w.plan.patch(),
      comments: w.plan.comments,
      emails: w.plan.emails,
      ...(reason ? { failed: reason } : {}),
    });
  }
  if (failed.length)
    run.lines[at] = {
      kind: 'branch',
      ok: false,
      text: `${text}, failed on ${failed.join(', ')}`,
      cards: shown,
    };
}

// The run's steps against the card, worked out: the one patch, the comments, the card to make, the emails, the
// related cards' writes and the messages, with a line per step; or where it failed and why.
export function planActions(steps: readonly AutomationStep[], ctx: PlanActionsContext): PlannedRun {
  const run = new Run();
  const w = walkOf(ctx.card, run, ctx);
  try {
    steps.forEach((s, index) => {
      if (s.kind === 'for') return branch(s, w);
      if (s.kind === 'notify') {
        count(run);
        return notify(s, index, w);
      }
      if (s.kind !== 'if') {
        count(run);
        return apply(s, w);
      }
      const held = allHold(s.conditions, { ...ctx, card: w.plan.card });
      for (const l of held.lines) run.lines.push({ kind: 'condition', ...l });
      for (const a of held.ok ? s.then : s.else) {
        count(run);
        apply(a, w);
      }
    });
  } catch (error) {
    if (!(error instanceof Failed)) throw error;
    w.plan.failure(error.message);
    return { failed: error.message, lines: run.lines, done: writesOf(w.plan) };
  }
  return { ...writesOf(w.plan), lines: run.lines };
}

const writesOf = (plan: Plan): PlannedWrites => ({
  patch: plan.patch(),
  comments: plan.comments,
  created: plan.created,
  emails: plan.emails,
  related: plan.run.related,
  sends: plan.run.sends,
  turns: plan.run.turns,
});
