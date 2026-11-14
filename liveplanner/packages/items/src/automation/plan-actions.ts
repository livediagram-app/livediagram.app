// Automations: a run's steps worked out, without touching anything (docs/specs/026-plan/automations.md "Actions",
// "Runs, limits and loops"; blueprint automations.md "Files", "The run"). `planActions` walks the steps and each If /
// Else in order against the card as the steps before left it, folds every change to the card into ONE patch (set and
// clear, in step order), and gathers the comments, the card to make, the emails and the outgoing messages. A branch
// (For Related Cards) plans its actions on each related card the same way, one patch per card; a card that refuses
// one fails its own steps only. Assign in Turn takes the rule's turn and says how many turns the run used. An action
// that would change nothing is "Already so"; one the card refuses fails the run there, with the lines so far. The api
// applies the plan (automation-writes.ts); Test on a Card shows it. Pure.

import { cutText } from '@liveworkspace/model-core/text-cut';
import {
  itemAssignee,
  itemLabels,
  itemStatus,
  itemTitle,
  type Item,
  type ItemFields,
  type ItemPerson,
} from '../item';
import {
  ITEM_CHECKLIST_MAX,
  ITEM_CHECKLIST_TEXT_MAX,
  ITEM_LABELS_MAX,
  ITEM_TITLE_MAX,
} from '../limits';
import { colourFieldOf } from '../item-colour';
import { blockingCycleOf, isBlocksField } from '../blocked-by';
import { linkedCardIds } from '../several-values';
import { validateFields } from '../fields';
import { isEmptyFieldValue, requiredCustomFieldsOf } from '../required-fields';
import { typeAllowsStatus } from '../type-catalogue';
import { typeChangeFields } from '../card-retype-fields';
import { AUTOMATION_SUBJECT_MAX } from './validate';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_CREATED_PER_RUN,
  AUTOMATION_PERSON_ID,
  AUTOMATION_TEXT_MAX,
  type AutomationAction,
  type AutomationBranch,
  type AutomationGone,
  type AutomationOutgoing,
  type AutomationStep,
} from './types';
import { allHold } from './conditions';
import {
  changeNeverHeard,
  fieldDefOf,
  fieldName,
  personOf,
  planHasField,
  statusName,
  typeHasField,
  typeName,
} from './outline';
import { fieldText, fillValues } from './values';
import { relatedCards } from './related';
import { branchWords, notifyChip, waitWords } from './sentence';
import { addressWords } from './email-addresses';
import { Failed, fail, failGone, fieldKind, setValueOf } from './set-value';
import { planAi } from './ai-steps';
import {
  walkOf,
  type Plan,
  type PlanActionsContext,
  type PlannedRun,
  type PlannedSegment,
  type PlannedWrites,
  Run,
  type Walk,
} from './plan-walk';

export type {
  PlanActionsContext,
  PlannedCard,
  PlannedEmail,
  PlannedMention,
  PlannedRelated,
  PlannedRun,
  PlannedSegment,
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

/** A Set Field's line on a card whose type lacks the field: the step skipped, nothing written (spec "Actions"). */
export const setFieldLacked = (type: string, field: string): string =>
  `Skipped: a ${type} card has no ${field}`;

function setField(a: Extract<AutomationAction, { kind: 'set_field' | 'clear_field' }>, w: Walk) {
  const { plan, ctx, type } = w;
  const def = fieldDefOf(ctx.outline, a.field, type);
  const name = fieldName(ctx.outline, a.field, type);
  // A field gone from the plan (the rule needs attention) is never written as hidden data, nor read from.
  if (!planHasField(ctx.outline, a.field)) failGone({ kind: 'field', id: a.field });
  if (a.kind === 'set_field' && 'from' in a.value && !planHasField(ctx.outline, a.value.from))
    failGone({ kind: 'field', id: a.value.from });
  // Another type's field (a mixed plan): never written onto this card where nobody sees it, and no failure either,
  // so a rule for every type never pauses on the types without it. The run goes on.
  if (a.kind === 'set_field' && !typeHasField(type, a.field))
    return plan.line(setFieldLacked(type.label, name));
  if (def?.kind === 'calculated' || def?.calculation) fail(`${name} is worked out, never set`);
  // Time Spent's entries, a Votes tally and a Comments field change without a write: a rule never writes them.
  if (def && changeNeverHeard(def))
    fail(`${name} is never ${a.kind === 'set_field' ? 'set' : 'cleared'} by a rule`);
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
      if (!o.statuses.some((s) => s.status === a.status))
        failGone({ kind: 'column', id: a.status });
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
      plan.comments.push(cutText(fill(a.text), AUTOMATION_TEXT_MAX));
      return plan.line('Add Comment');
    case 'flag':
      return plan.line('Flag', plan.write('flagged', true));
    case 'unflag':
      return plan.line('Unflag', plan.write('flagged', undefined));
    case 'archive':
      return plan.line('Archive', plan.write('archived', true));
    case 'create_card':
      return createCard(a, w);
    case 'copy_card':
      return copyCard(a, w);
    case 'set_type': {
      const to = o.types.find((t) => t.id === a.type);
      if (!to) return failGone({ kind: 'type', id: a.type });
      const status = itemStatus(plan.card);
      if (status && !typeAllowsStatus(to, status))
        fail(`A ${to.label} card can't be in ${statusName(o, status)}`);
      const changed = plan.retype(to.id);
      // Its custom fields map by name into the new type's, one write with the type (item-types.md "Changing a
      // card's type").
      if (changed)
        for (const [field, value] of Object.entries(typeChangeFields(plan.card.fields, type, to)))
          plan.write(field, value);
      w.type = to;
      return plan.line(`Change to ${typeName(o, to.id)}`, changed);
    }
    case 'set_colour':
      return plan.line(
        a.colour ? `Set Colour ${a.colour}` : 'Clear Colour',
        plan.write(colourFieldOf(type), a.colour ?? undefined),
      );
    case 'restore':
      return plan.line('Restore From Archive', plan.write('archived', undefined));
    case 'add_checklist':
      return addChecklist(a, w);
    case 'link_card':
      return linkCard(a, w);
    case 'mention': {
      const to =
        'assignee' in a.to
          ? (itemAssignee(plan.card) ?? null)
          : 'trigger' in a.to
            ? triggerPerson(ctx)
            : (personOf(o, a.to.person) ?? null);
      plan.mentions.push({ to, text: cutText(fill(a.text), AUTOMATION_TEXT_MAX) });
      return plan.line(to ? `Mention ${to.name}` : 'Mention (nobody to mention)', to !== null);
    }
    case 'resolve_threads': {
      plan.resolve = true;
      return plan.line('Resolve Threads');
    }
    case 'email': {
      const subject = cutText(fill(a.subject), AUTOMATION_SUBJECT_MAX);
      const body = cutText(fill(a.body), AUTOMATION_TEXT_MAX);
      if ('addresses' in a.to) {
        plan.emails.push({ to: null, addresses: a.to.addresses, subject, body });
        return plan.line(`Send Email to ${addressWords(a.to.addresses)}`);
      }
      const to =
        'assignee' in a.to
          ? (itemAssignee(plan.card) ?? null)
          : 'trigger' in a.to
            ? triggerPerson(ctx)
            : (personOf(o, a.to.person) ?? null);
      plan.emails.push({ to, subject, body });
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
  if (plan.madeBefore + plan.created.length >= AUTOMATION_CREATED_PER_RUN)
    fail(`A run makes up to ${AUTOMATION_CREATED_PER_RUN} card`);
  const type = o.types.find((t) => t.id === a.type);
  if (!type) return failGone({ kind: 'type', id: a.type });
  if (a.status && !o.statuses.some((s) => s.status === a.status))
    failGone({ kind: 'column', id: a.status });
  const title = cutText(
    fillValues(a.title, { ...w.values, card: plan.card }).trim(),
    ITEM_TITLE_MAX,
  );
  const fields: ItemFields = { title: title || type.newTitle };
  for (const part of a.copy ?? []) {
    const v = plan.card.fields[part];
    if (!isEmptyFieldValue(v)) fields[part] = v!;
  }
  if (a.linkField) {
    const def = type.custom?.find((f) => f.id === a.linkField && f.kind === 'card');
    if (!def) return noCardField(a.linkField, type.label, w);
    fields[a.linkField] = def.multiple ? [plan.card.id] : plan.card.id;
  }
  plan.created.push({ type: type.id, ...(a.status ? { status: a.status } : {}), fields });
  plan.line(`Create ${typeName(o, type.id)} "${fields['title'] as string}"`);
}

// A Card field the card's type lacks: gone from the plan (its id kept for agents), else named.
const noCardField = (field: string, label: string, w: Walk): never =>
  planHasField(w.ctx.outline, field)
    ? fail(`A ${label} card has no Card field ${fieldName(w.ctx.outline, field)}`)
    : failGone({ kind: 'field', id: field });

// Copy Card: a new card of the card's type, its title and fields, in its column or the one chosen.
function copyCard(a: Extract<AutomationAction, { kind: 'copy_card' }>, w: Walk) {
  const { plan, ctx } = w;
  const o = ctx.outline;
  if (plan.madeBefore + plan.created.length >= AUTOMATION_CREATED_PER_RUN)
    fail(`A run makes up to ${AUTOMATION_CREATED_PER_RUN} card`);
  if (a.status && !o.statuses.some((s) => s.status === a.status))
    failGone({ kind: 'column', id: a.status });
  const status = a.status ?? itemStatus(plan.card);
  if (status && !typeAllowsStatus(w.type, status))
    fail(`A ${w.type.label} card can't go in ${statusName(o, status)}`);
  const { status: _status, archived: _archived, ...fields } = plan.card.fields;
  plan.created.push({ type: plan.card.type, ...(status ? { status } : {}), fields: { ...fields } });
  plan.line(`Copy Card "${itemTitle(plan.card)}"`);
}

type ChecklistRow = { text: string; done: boolean };

// Add a Checklist: the items the card's checklist lacks (by their text), unticked, after the ones it holds.
function addChecklist(a: Extract<AutomationAction, { kind: 'add_checklist' }>, w: Walk) {
  const { plan, type } = w;
  if (!typeHasField(type, 'checklist')) fail(`A ${type.label} card has no Checklist`);
  const had = Array.isArray(plan.card.fields['checklist'])
    ? (plan.card.fields['checklist'] as ChecklistRow[])
    : [];
  const texts = new Set(had.map((r) => r.text.trim().toLowerCase()));
  const rows = [...had];
  for (const item of a.items) {
    // Cut as a person's item is: a value filled in (a description, a webhook's) may run past it.
    const text = cutText(
      fillValues(item, { ...w.values, card: plan.card }).trim(),
      ITEM_CHECKLIST_TEXT_MAX,
    ).trimEnd();
    if (!text || texts.has(text.toLowerCase())) continue;
    texts.add(text.toLowerCase());
    rows.push({ text, done: false });
  }
  if (rows.length > ITEM_CHECKLIST_MAX) fail(`A checklist holds up to ${ITEM_CHECKLIST_MAX} items`);
  const added = rows.length - had.length;
  const words = added === 1 ? '1 checklist item' : `${added} checklist items`;
  return plan.line(`Add ${words}`, plan.write('checklist', rows));
}

// Link Cards: a Card field pointed at a chosen card, or (a branch's) the card that started the rule. A field of
// several gains it; a single one is replaced. A Blocked By link never closes a loop.
function linkCard(a: Extract<AutomationAction, { kind: 'link_card' }>, w: Walk) {
  const { plan, ctx, type } = w;
  const def = type.custom?.find((f) => f.id === a.field && f.kind === 'card');
  if (!def || !type.fields.includes(def.id)) return noCardField(a.field, type.label, w);
  const chosen = 'card' in a.to ? a.to.card : undefined;
  const to =
    chosen === undefined ? w.values.trigger?.card : ctx.items?.find((i) => i.id === chosen);
  if (chosen !== undefined && ctx.items && !to) return fail('The card to link is gone');
  const id = to?.id ?? chosen;
  if (!id) return fail('No card to link');
  if (id === plan.card.id) return fail("A card can't link to itself");
  const has = linkedCardIds(plan.card, def);
  const next = def.multiple ? (has.includes(id) ? has : [...has, id]) : id;
  const changed = plan.write(def.id, next);
  if (changed && isBlocksField(def) && ctx.items) {
    const before = ctx.items.find((i) => i.id === plan.card.id);
    if (blockingCycleOf(ctx.items, ctx.outline.types, [{ before, next: plan.card }]))
      fail('That link would close a Blocked By loop');
  }
  const title = to ? `#${to.key}` : 'a card';
  return plan.line(`Link ${def.label} to ${title}`, changed);
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
    // An outgoing message: the one text a private repository's pull request title fills (values.ts `outgoing`).
    text: cutText(
      fillValues(s.text, { ...w.values, card: w.plan.card, outgoing: true }),
      AUTOMATION_TEXT_MAX,
    ),
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
    let gone: AutomationGone | undefined;
    try {
      for (const a of s.then) apply(a, w);
    } catch (error) {
      if (!(error instanceof Failed)) throw error;
      reason = error.message;
      gone = error.gone;
      w.plan.failure(reason, gone);
      failed.push(`#${card.key}`);
    }
    run.related.push({
      card,
      patch: w.plan.patch(),
      comments: w.plan.comments,
      emails: w.plan.emails,
      mentions: w.plan.mentions,
      resolve: w.plan.resolve,
      ...(reason ? { failed: reason } : {}),
      ...(gone ? { gone } : {}),
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
// related cards' writes and the messages, with a line per step; or where it failed and why. A Wait ends the plan
// there (`wait`: the rest goes on later, from its next step); `from` starts at a step (the rest after a Wait), and
// `through` plans past every Wait (Test on a Card: "Would wait 2 days, then:"). An AI step cuts the writes there: the
// steps after it plan a fresh patch from the card as the steps before left it, its `after` (spec "How a step runs").
export function planActions(
  steps: readonly AutomationStep[],
  ctx: PlanActionsContext,
  opts: { from?: number; through?: boolean } = {},
): PlannedRun {
  const run = new Run();
  let w = walkOf(ctx.card, run, ctx);
  // The segments cut so far (the first is the run's own fields), the card each later one is planned from, and where
  // the current one's related cards start.
  const cuts: PlannedSegment[] = [];
  const froms: Item[] = [];
  let relatedFrom = 0;
  const cut = () => {
    cuts.push(segmentOf(w.plan, relatedFrom));
    froms.push(w.plan.card);
    relatedFrom = run.related.length;
    const made = w.plan.madeBefore + w.plan.created.length;
    w = walkOf(w.plan.card, run, ctx);
    w.plan.madeBefore = made;
  };
  const writes = (): PlannedWrites => {
    const all = [...cuts, segmentOf(w.plan, relatedFrom)];
    run.ai.forEach((p, i) => {
      p.after = { ...all[i + 1]!, from: froms[i]! };
    });
    return {
      ...all[0]!,
      sends: run.sends,
      turns: run.turns,
      ...(run.ai.length ? { ai: run.ai } : {}),
    };
  };
  let wait: { hours: number; from: number } | undefined;
  try {
    for (let index = opts.from ?? 0; index < steps.length; index += 1) {
      const s = steps[index]!;
      if (s.kind === 'wait') {
        if (opts.through) {
          w.plan.line(`Would ${waitWords(s.hours).toLowerCase()}, then:`, true);
          continue;
        }
        w.plan.line(waitWords(s.hours));
        wait = { hours: s.hours, from: index + 1 };
        break;
      }
      if (s.kind === 'for') {
        branch(s, w);
        continue;
      }
      if (s.kind === 'notify') {
        count(run);
        notify(s, index, w);
        continue;
      }
      if (s.kind === 'ai') {
        count(run);
        planAi(s, index, w);
        cut();
        continue;
      }
      if (s.kind !== 'if') {
        count(run);
        apply(s, w);
        continue;
      }
      const held = allHold(s.conditions, { ...ctx, card: w.plan.card });
      for (const l of held.lines) run.lines.push({ kind: 'condition', ...l });
      for (const a of held.ok ? s.then : s.else) {
        count(run);
        apply(a, w);
      }
    }
  } catch (error) {
    if (!(error instanceof Failed)) throw error;
    w.plan.failure(error.message, error.gone);
    return {
      failed: error.message,
      ...(error.gone ? { gone: error.gone } : {}),
      lines: run.lines,
      done: writes(),
    };
  }
  return { ...writes(), ...(wait ? { wait } : {}), lines: run.lines };
}

// One segment's writes: its walk's patch and threads, and the related cards its branches planned (from `relatedFrom`).
const segmentOf = (plan: Plan, relatedFrom: number): PlannedSegment => ({
  patch: plan.patch(),
  comments: plan.comments,
  created: plan.created,
  emails: plan.emails,
  mentions: plan.mentions,
  resolve: plan.resolve,
  related: plan.run.related.slice(relatedFrom),
});
