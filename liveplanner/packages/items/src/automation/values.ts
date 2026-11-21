// Automations: the values a rule's text holds (docs/specs/026-plan/automations.md "Values"; blueprint automations.md
// "Files"). `{{card.title}}` and the rest, found, checked against the names Insert a Value offers, and filled in when a
// rule runs, in the rule's time zone. Filling is one pass: what a card holds is never read as a value again. Pure.

import {
  dayWords,
  fillValues as fill,
  isSharedValue,
  sharedValue,
  unknownValueIn as firstUnknownValue,
  type WebhookValues,
} from '@liveworkspace/automations';
import { itemAssignee, itemStatus, itemTitle, type Item, type ItemFieldValue } from '../item';
import type { ItemTypeDef } from '../item-types';
import { cardRefOrKey } from '../card-prefix';
import { PRIORITY_LABELS, isPriority } from '../fields';
import { isDay } from '../repeat-dates';
import { dayNumber } from '../plan-view-dates';
import {
  AUTOMATION_BRANCH_VALUE_NAMES,
  AUTOMATION_EMAIL_VALUE_NAMES,
  AUTOMATION_PULL_REQUEST_VALUE_NAMES,
  AUTOMATION_VALUE_NAMES,
} from './types';
import { pullRequestTitleValue, type PullRequestValues } from './github-triggers';
import { fieldOfName, statusName, type AutomationOutline } from './outline';

// The scanner, the one-pass fill and the names every app shares (`person`, `rule`, `now`, `now.date`, `now ± Nd`,
// `webhook.<path>`) are @liveworkspace/automations'; the card names and what they read are here.
export { dayFrom, todayIn, valuesIn } from '@liveworkspace/automations';

export const VALUE_NAMES = AUTOMATION_VALUE_NAMES;
const FIXED: ReadonlySet<string> = new Set(AUTOMATION_VALUE_NAMES);
const BRANCH: ReadonlySet<string> = new Set(AUTOMATION_BRANCH_VALUE_NAMES);
const PULL_REQUEST: ReadonlySet<string> = new Set(AUTOMATION_PULL_REQUEST_VALUE_NAMES);
const EMAIL: ReadonlySet<string> = new Set(AUTOMATION_EMAIL_VALUE_NAMES);

// Where a text is written: a branch's text may also name the card that started the rule (`{{trigger.title}}`), and
// an Incoming Webhook rule's the call's body (`{{webhook.<path>}}`), and a GitHub rule's the pull request
// (`{{pull_request.title}}`), and an Email Received rule's the sender (`{{from}}`).
export type ValuePlace = {
  branch?: boolean;
  webhook?: boolean;
  github?: boolean;
  email?: boolean;
  // A Form Response rule's text may name the response's answers (`{{answer.<Question>}}`).
  form?: boolean;
};

const FIELD_PREFIX = 'card.field.';
const ANSWER_PREFIX = 'answer.';

// `answer.<Question>`: the question's words after the prefix, when they hold more than spaces (a prefix check, as
// fieldNameOf's).
export function answerNameOf(name: string): string | null {
  if (!name.startsWith(ANSWER_PREFIX)) return null;
  const rest = name.slice(ANSWER_PREFIX.length).trim();
  return rest ? rest : null;
}

// `card.field.<Field Name>`: the name after the prefix, when it holds more than spaces. A prefix check, never a
// regular expression, so a long hostile name costs one linear pass (CodeQL polynomial-regex).
function fieldNameOf(name: string): string | null {
  if (!name.startsWith(FIELD_PREFIX)) return null;
  const rest = name.slice(FIELD_PREFIX.length);
  return rest.trim() ? rest : null;
}

// Whether the builder knows a value's name: a fixed name, a field by name, or a day from today; in a branch, the
// triggering card's too.
export const isKnownValue = (name: string, place: ValuePlace = {}): boolean =>
  FIXED.has(name) ||
  isSharedValue(name, place) ||
  fieldNameOf(name) !== null ||
  (place.branch === true && BRANCH.has(name)) ||
  (place.github === true && PULL_REQUEST.has(name)) ||
  (place.email === true && EMAIL.has(name)) ||
  (place.form === true && answerNameOf(name) !== null);

// The first value a text holds that the builder does not know, or null.
export const unknownValueIn = (text: string, place: ValuePlace = {}): string | null =>
  firstUnknownValue(text, (name) => isKnownValue(name, place));

// ---- Days ----------------------------------------------------------------------------------------------------------

// "11 Nov 2026" for `2026-11-11` (or for the day a Date and Time moment falls on); anything else as it is.
export function dayText(day: string): string {
  const n = dayNumber(day);
  return n === undefined ? day : dayWords(n);
}

// A field's value as a line of text: a day as a day, a person by name, a list joined, Yes or No.
export function fieldText(value: ItemFieldValue | undefined, field?: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    if (field === 'priority' && isPriority(value)) return PRIORITY_LABELS[value];
    return isDay(value) ? dayText(value) : value;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value))
    return value
      .map((v) => fieldText(v))
      .filter(Boolean)
      .join(', ');
  const name = value['name'];
  return typeof name === 'string' ? name : '';
}

// ---- Filling -------------------------------------------------------------------------------------------------------

export interface ValueContext {
  card: Item;
  type: ItemTypeDef;
  outline: AutomationOutline;
  // The link that opens the card.
  url: string;
  // Who triggered the rule, by name.
  person: string;
  rule: string;
  now: number;
  timeZone: string;
  // In a branch: the card that started the rule, and its link (`card` is the related card).
  trigger?: { card: Item; url: string };
  // An Incoming Webhook run: the values its call's body gave, by path (missing reads nothing).
  webhook?: WebhookValues;
  // A run with no card (an Incoming Webhook call that named none): every `card.…` value reads nothing.
  cardless?: boolean;
  // A GitHub run: the pull request that started it (absent, as Test on a Card's: its values read nothing).
  github?: PullRequestValues;
  // An Email Received run: the sender's bare address (absent, as Test on a Card's: `{{from}}` reads nothing).
  email?: string;
  // A Form Response run: the response's answers as text by question (absent, as Test on a Card's: each reads nothing).
  answers?: Readonly<Record<string, string>>;
  // The text is an outgoing message's (Slack, Teams, Your Own Service): the one place a private repository's title
  // fills in (spec "A private repository's title").
  outgoing?: boolean;
}

// The answer to the question worded `question`: as written, else the one worded alike in any case. Own keys only.
function answerValueOf(answers: ValueContext['answers'], question: string): string {
  if (!answers) return '';
  if (Object.hasOwn(answers, question)) return answers[question] ?? '';
  const lower = question.toLowerCase();
  const key = Object.keys(answers).find((k) => k.toLowerCase() === lower);
  return key === undefined ? '' : (answers[key] ?? '');
}

// One value's text. `iso`: a day reads `YYYY-MM-DD`, for a date field.
function valueOf(name: string, ctx: ValueContext, iso: boolean): string {
  const day = (d: string) => (iso ? d : dayText(d));
  // The names every app shares: a day from today, a webhook call's field, who did it, the rule, now.
  const shared = sharedValue(name, ctx, iso);
  if (shared !== undefined) return shared;
  const question = answerNameOf(name);
  if (question !== null) return answerValueOf(ctx.answers, question);
  if (ctx.cardless && name.startsWith('card.')) return '';
  const field = fieldNameOf(name);
  if (field !== null) {
    const id = fieldOfName(ctx.type, field);
    if (!id) return '';
    const raw = ctx.card.fields[id];
    // A day another field holds stays `YYYY-MM-DD` for a date field, as {{card.due}} does.
    return iso && isDay(raw) ? raw : fieldText(raw, id);
  }
  switch (name) {
    case 'card.title':
      return itemTitle(ctx.card);
    case 'card.key':
      return cardRefOrKey(ctx.card, ctx.outline.types);
    case 'card.url':
      return ctx.url;
    case 'card.assignee':
      return itemAssignee(ctx.card)?.name ?? '';
    case 'card.column': {
      const status = itemStatus(ctx.card);
      return status ? statusName(ctx.outline, status) : '';
    }
    case 'card.due': {
      const due = ctx.card.fields['due'];
      return typeof due === 'string' ? day(due) : '';
    }
    case 'trigger.title':
      return ctx.trigger ? itemTitle(ctx.trigger.card) : '';
    case 'trigger.key':
      return ctx.trigger ? cardRefOrKey(ctx.trigger.card, ctx.outline.types) : '';
    case 'trigger.url':
      return ctx.trigger?.url ?? '';
    case 'pull_request.title':
      return ctx.github ? pullRequestTitleValue(ctx.github, ctx.outgoing === true) : '';
    case 'pull_request.number':
      return ctx.github ? `#${ctx.github.number}` : '';
    case 'pull_request.url':
      return ctx.github?.url ?? '';
    case 'from':
      return ctx.email ?? '';
    default:
      // A value the builder does not know (refused on save) reads as nothing.
      return '';
  }
}

// The text with every value filled in, in one pass.
export function fillValues(text: string, ctx: ValueContext, opts: { iso?: boolean } = {}): string {
  return fill(text, (name) => valueOf(name, ctx, opts.iso === true));
}
