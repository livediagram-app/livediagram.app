// A rule in words (docs/specs/026-plan/automations.md "The Automations screen"): the Rules list's sentence, "When
// [Card Moved] to [Done] then [Set Completed On] [Remove Label blocked]", as words and chips, and the names of each
// trigger, condition and action the builder's step cards and panels read too. Names come from the plan's outline
// (its card types, columns, people, tabs and saved filters); one the plan no longer has reads as its stored id, so a
// rule needing attention still says what it names. Pure.

import { automationDayWords } from './conditions';
import { BUILT_IN_FIELD_NAMES, builtInFieldLabel } from '../built-in-field-labels';
import { isPriority, PRIORITY_LABELS } from '../fields';
import type { ItemPerson } from '../item';
import type { ItemTypeDef } from '../item-types';
import { clockWords, type AutomationTimeTrigger } from './schedule';
import type {
  AutomationAction,
  AutomationActionKind,
  AutomationOutgoing,
  AutomationRelated,
  AutomationVia,
  AutomationCondition,
  AutomationFieldOp,
  AutomationRuleBody,
  AutomationSetValue,
  AutomationStep,
  AutomationTrigger,
  AutomationTriggerKind,
  AutomationWho,
} from './types';

// What the sentence reads a rule against. `tabs` names Form tabs and the boards' tabs; `filters` names saved filters
// by id. Either may be absent where nothing reads them.
export interface RuleSentenceOutline {
  types: readonly Pick<ItemTypeDef, 'id' | 'label' | 'fields' | 'custom' | 'fieldLabels'>[];
  statuses: ReadonlyMap<string, string>;
  people: readonly Pick<ItemPerson, 'id' | 'name'>[];
  tabs?: ReadonlyMap<string, string>;
  filters?: ReadonlyMap<string, string>;
  // The plan's webhooks by id, named (the builder's list from the index); absent, a step's kept name reads.
  webhooks?: ReadonlyMap<string, string>;
}

// A joining word, or a chip (the trigger's own chip is drawn in the brand tint).
export type RuleSentencePart = { word: string } | { chip: string; trigger?: true };

export const AUTOMATION_TRIGGER_NAMES: Readonly<Record<AutomationTriggerKind, string>> = {
  card_created: 'Card Created',
  form_response: 'Form Response',
  card_moved: 'Card Moved',
  field_changed: 'Field Changed',
  comment_added: 'Comment Added',
  manual: 'Run from a Card',
  scheduled: 'Scheduled',
  due_in: 'Due In',
  overdue: 'Overdue',
};

export const AUTOMATION_CONDITION_NAMES: Readonly<Record<AutomationCondition['kind'], string>> = {
  type: 'Card Type',
  column: 'Column',
  field: 'Field',
  who: 'Who Did It',
  saved_filter: 'Matches a Saved Filter',
};

export const AUTOMATION_STEP_NAMES: Readonly<
  Record<AutomationActionKind | 'if' | 'for' | 'notify', string>
> = {
  move: 'Move to Column',
  set_field: 'Set Field',
  clear_field: 'Clear Field',
  assign: 'Assign',
  add_label: 'Add Label',
  remove_label: 'Remove Label',
  comment: 'Add Comment',
  flag: 'Flag',
  unflag: 'Unflag',
  archive: 'Archive',
  create_card: 'Create Card',
  email: 'Send Email',
  if: 'If / Else',
  for: 'For Related Cards',
  notify: 'Send a Message',
};

// An outgoing action by where it posts.
export const AUTOMATION_NOTIFY_NAMES: Readonly<Record<AutomationVia, string>> = {
  webhook: 'Send to Webhook',
  slack: 'Post to Slack',
  teams: 'Post to Microsoft Teams',
};

// The ways a branch picks its cards, as "For each …" names them.
export const AUTOMATION_RELATED_NAMES: Readonly<Record<AutomationRelated['kind'], string>> = {
  linked: 'Linked Card',
  blocked_by: 'Blocked By Card',
  blocking: 'Card It Blocks',
  children: 'Child Card',
  saved_filter: 'Card Matching a Saved Filter',
};

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// 1st, 2nd, 3rd, 4th … 31st.
const ordinal = (n: number): string => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
};

/** A time trigger in words: "Every Weekday at 9:00", "Every Mon and Thu at 17:30", "Monthly on the 31st at 9:00",
 *  "Due in 2 Days at 9:00", "Overdue at 9:00". */
export function timeTriggerWords(trigger: AutomationTimeTrigger): string {
  const at = `at ${clockWords(trigger.at)}`;
  if (trigger.kind === 'due_in')
    return `Due in ${trigger.days} Day${trigger.days === 1 ? '' : 's'} ${at}`;
  if (trigger.kind === 'overdue') return `Overdue ${at}`;
  switch (trigger.every) {
    case 'day':
      return `Every Day ${at}`;
    case 'weekday':
      return `Every Weekday ${at}`;
    case 'week': {
      const days = (trigger.days ?? []).map((d) => WEEKDAY_NAMES[d]!);
      const list =
        days.length <= 1 ? (days[0] ?? '') : `${days.slice(0, -1).join(', ')} and ${days.at(-1)!}`;
      return `Every ${list} ${at}`;
    }
    case 'month':
      return `Monthly on the ${ordinal(trigger.dayOfMonth ?? 1)} ${at}`;
  }
}

/** An outgoing action as its chip reads: "Post to Slack Launch Channel", or its kind alone with no name known. */
export function notifyChip(
  step: AutomationOutgoing,
  outline?: Pick<RuleSentenceOutline, 'webhooks'>,
): string {
  const name = outline?.webhooks?.get(step.webhook) ?? step.name;
  return name ? `${AUTOMATION_NOTIFY_NAMES[step.via]} ${name}` : AUTOMATION_NOTIFY_NAMES[step.via];
}

/** How a branch picks its cards: "For each Blocked By Card", "For each Linked Card (Parent)". */
export function branchWords(related: AutomationRelated, outline?: RuleSentenceOutline): string {
  const head = `For each ${AUTOMATION_RELATED_NAMES[related.kind]}`;
  if (related.kind === 'linked' && related.field)
    return outline ? `${head} (${outlineFieldName(related.field, outline)})` : head;
  if (related.kind === 'saved_filter')
    return `For each Card Matching ${outline?.filters?.get(related.filter) ?? 'a Saved Filter'}`;
  return head;
}

export const AUTOMATION_FIELD_OP_WORDS: Readonly<Record<AutomationFieldOp, string>> = {
  is: 'is',
  is_not: 'is not',
  empty: 'is empty',
  not_empty: 'is not empty',
  contains: 'contains',
  not_contains: 'does not contain',
  before: 'is before',
  after: 'is after',
  on_or_before: 'is on or before',
  on_or_after: 'is on or after',
  less_than: 'is less than',
  more_than: 'is more than',
};

const ROLE_WORDS: Readonly<Record<'editor' | 'participant' | 'agent', string>> = {
  editor: 'an Editor',
  participant: 'a Participant',
  agent: 'an agent',
};

// A literal set value this long or shorter reads in the sentence; a longer one is left to the builder.
export const SENTENCE_VALUE_MAX = 24;

/** "A", "A or B", "A, B or C". */
export function sentenceOrList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]!}`;
}

export function outlineStatusName(status: string, outline: RuleSentenceOutline): string {
  return outline.statuses.get(status) ?? status;
}

export function outlineTypeName(typeId: string, outline: RuleSentenceOutline): string {
  return outline.types.find((t) => t.id === typeId)?.label ?? typeId;
}

export function outlinePersonName(personId: string, outline: RuleSentenceOutline): string {
  return outline.people.find((p) => p.id === personId)?.name ?? 'Someone No Longer Here';
}

export function outlineTabName(tabId: string, outline: RuleSentenceOutline): string {
  return outline.tabs?.get(tabId) ?? tabId;
}

/** A built-in field's name as the plan's types agree on it, or a custom field's label, else the id. */
export function outlineFieldName(fieldId: string, outline: RuleSentenceOutline): string {
  if (fieldId in BUILT_IN_FIELD_NAMES)
    return builtInFieldLabel(fieldId, outline.types as readonly ItemTypeDef[]);
  for (const t of outline.types) {
    const custom = t.custom?.find((f) => f.id === fieldId);
    if (custom) return custom.label;
  }
  return fieldId;
}

/** A day a date condition or Set Field names: "Today", "Today + 3 days", "Today - 1 day", or the day itself. */

// A stored value as a person reads it: a priority by its label, a list joined.
function valueWords(field: string, value: string | number | readonly string[]): string {
  if (typeof value === 'object') return value.map((v: string) => valueWords(field, v)).join(', ');
  if (field === 'priority' && isPriority(value)) return PRIORITY_LABELS[value];
  return String(value);
}

function whoWords(who: AutomationWho, outline: RuleSentenceOutline): string {
  return 'person' in who ? outlinePersonName(who.person, outline) : ROLE_WORDS[who.role];
}

/** One condition as its chip reads: "Card Type is Bug", "Due Date is before Today". */
export function conditionChip(
  condition: AutomationCondition,
  outline: RuleSentenceOutline,
): string {
  switch (condition.kind) {
    case 'type':
      return `Card Type ${condition.not ? 'is not' : 'is'} ${sentenceOrList(condition.types.map((t) => outlineTypeName(t, outline)))}`;
    case 'column':
      return `Column ${condition.not ? 'is not' : 'is'} ${sentenceOrList(condition.statuses.map((s) => outlineStatusName(s, outline)))}`;
    case 'who':
      return `Who Did It ${condition.not ? 'is not' : 'is'} ${sentenceOrList(condition.who.map((w) => whoWords(w, outline)))}`;
    case 'saved_filter':
      return `Matches ${outline.filters?.get(condition.filter) ?? 'a Saved Filter'}`;
    case 'field': {
      const head = `${outlineFieldName(condition.field, outline)} ${AUTOMATION_FIELD_OP_WORDS[condition.op]}`;
      const { value } = condition;
      if (value === undefined) return head;
      if (typeof value === 'object' && !Array.isArray(value))
        return `${head} ${automationDayWords(value)}`;
      return `${head} ${valueWords(condition.field, value)}`;
    }
  }
}

function setChip(field: string, value: AutomationSetValue, outline: RuleSentenceOutline): string {
  const head = `Set ${outlineFieldName(field, outline)}`;
  if ('from' in value) return `${head} from ${outlineFieldName(value.from, outline)}`;
  if ('date' in value) return `${head} ${automationDayWords(value.date)}`;
  if ('number' in value) return `${head} ${value.number}`;
  if ('list' in value) return value.list.length ? `${head} ${valueWords(field, value.list)}` : head;
  const text = value.text.trim();
  // Text holding values, or too long for a chip, is the builder's to show.
  if (!text || text.includes('{{') || text.length > SENTENCE_VALUE_MAX) return head;
  return `${head} ${valueWords(field, text)}`;
}

/** One action as its chip reads: "Move to Done", "Assign Priya Shah", "Remove Label blocked". */
export function actionChip(action: AutomationAction, outline: RuleSentenceOutline): string {
  switch (action.kind) {
    case 'move':
      return `Move to ${outlineStatusName(action.status, outline)}`;
    case 'set_field':
      return setChip(action.field, action.value, outline);
    case 'clear_field':
      return `Clear ${outlineFieldName(action.field, outline)}`;
    case 'assign':
      if ('rotate' in action.to) return 'Assign in Turn';
      return 'person' in action.to
        ? `Assign ${outlinePersonName(action.to.person, outline)}`
        : 'trigger' in action.to
          ? 'Assign Who Did It'
          : 'Unassign';
    case 'add_label':
      return `Add Label ${action.label}`;
    case 'remove_label':
      return `Remove Label ${action.label}`;
    case 'create_card':
      return `Create ${outlineTypeName(action.type, outline)}`;
    case 'email':
      return 'person' in action.to
        ? `Email ${outlinePersonName(action.to.person, outline)}`
        : 'trigger' in action.to
          ? 'Email Who Did It'
          : 'Email Assignee';
    case 'comment':
    case 'flag':
    case 'unflag':
    case 'archive':
      return AUTOMATION_STEP_NAMES[action.kind];
  }
}

/** A step as its chip reads: an action's words, If / Else, a branch's "For each …" or where a message goes. */
export function stepChip(step: AutomationStep, outline: RuleSentenceOutline): string {
  if (step.kind === 'if') return AUTOMATION_STEP_NAMES.if;
  if (step.kind === 'for') return branchWords(step.related, outline);
  if (step.kind === 'notify') return notifyChip(step, outline);
  return actionChip(step, outline);
}

// Chips for several names, "or" between them.
function orChips(names: readonly string[]): RuleSentencePart[] {
  return names.flatMap((chip, i) => (i === 0 ? [{ chip }] : [{ word: 'or' }, { chip }]));
}

/** The trigger's part of the sentence: "When [Card Moved] from [Review] to [Done]". */
export function triggerParts(
  trigger: AutomationTrigger,
  outline: RuleSentenceOutline,
): RuleSentencePart[] {
  if (trigger.kind === 'scheduled' || trigger.kind === 'due_in' || trigger.kind === 'overdue')
    return [{ word: 'When' }, { chip: timeTriggerWords(trigger), trigger: true }];
  const parts: RuleSentencePart[] = [
    { word: 'When' },
    { chip: AUTOMATION_TRIGGER_NAMES[trigger.kind], trigger: true },
  ];
  const narrow = (word: string, names: readonly string[]) => {
    if (names.length) parts.push({ word }, ...orChips(names));
  };
  switch (trigger.kind) {
    case 'card_created':
      narrow('in', trigger.status ? [outlineStatusName(trigger.status, outline)] : []);
      break;
    case 'form_response':
      narrow('on', trigger.formTab ? [outlineTabName(trigger.formTab, outline)] : []);
      break;
    case 'card_moved':
      narrow(
        'from',
        (trigger.from ?? []).map((s) => outlineStatusName(s, outline)),
      );
      narrow(
        'to',
        (trigger.to ?? []).map((s) => outlineStatusName(s, outline)),
      );
      break;
    case 'field_changed':
      narrow(
        'on',
        trigger.fields.map((f) => outlineFieldName(f, outline)),
      );
      break;
    case 'comment_added':
    case 'manual':
      break;
  }
  return parts;
}

/** The Rules list's sentence: the trigger, "if" and each condition, "then" and each step. */
export function ruleSentence(
  rule: Pick<AutomationRuleBody, 'trigger' | 'conditions' | 'steps'>,
  outline: RuleSentenceOutline,
): RuleSentencePart[] {
  const parts = triggerParts(rule.trigger, outline);
  if (rule.conditions.length)
    parts.push(
      { word: 'if' },
      ...rule.conditions.map((c) => ({ chip: conditionChip(c, outline) })),
    );
  if (rule.steps.length)
    parts.push({ word: 'then' }, ...rule.steps.map((s) => ({ chip: stepChip(s, outline) })));
  return parts;
}
