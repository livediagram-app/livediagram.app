// A new step's first form (docs/specs/026-plan/automations.md "The rule builder"): each kind added from + Add Action
// or + Add Condition starts filled from the plan where it can (its first column, card type, field or label), so the
// panel opens on something that reads. Text a person must write starts empty, and the api's refusal names it. Pure.

import {
  AUTOMATION_AI_NAMES,
  AUTOMATION_NOTIFY_NAMES,
  AUTOMATION_STEP_NAMES,
  type AutomationAction,
  type AutomationActionKind,
  type AutomationAi,
  type AutomationCondition,
  type AutomationOutgoing,
  type AutomationVia,
  type AutomationWait,
} from '@liveplanner/items';
import { outlineFields, type AutomationOutline } from './automation-outline';

export const ACTION_KINDS: readonly AutomationActionKind[] = [
  'move',
  'set_field',
  'clear_field',
  'assign',
  'add_label',
  'remove_label',
  'comment',
  'flag',
  'unflag',
  'archive',
  'create_card',
  'email',
  'set_type',
  'set_colour',
  'restore',
  'copy_card',
  'add_checklist',
  'link_card',
  'mention',
  'resolve_threads',
];

// A branch makes no card (nor holds an If, a branch, a Wait or an outgoing action, which its picker never offers).
export const BRANCH_ACTION_KINDS: readonly AutomationActionKind[] = ACTION_KINDS.filter(
  (k) => k !== 'create_card' && k !== 'copy_card',
);

// + Add Action at the rule's top level offers the outgoing actions too, one per kind of webhook.
export const OUTGOING_KINDS = ['notify_webhook', 'notify_slack', 'notify_teams'] as const;
export type OutgoingKind = (typeof OUTGOING_KINDS)[number];
// And, under them, the AI actions, while the rule holds fewer than 3 (docs/specs/026-plan/automations.md "AI actions").
export const AI_KINDS = ['ai_summarise', 'ai_card_type', 'ai_triage'] as const;
export type AiKind = (typeof AI_KINDS)[number];
// Wait: a step of the rule's top level, holding the ones after it (docs/specs/026-plan/automations.md "Wait").
export type AddKind = AutomationActionKind | OutgoingKind | AiKind | 'wait';
export const ADD_NAMES: Readonly<Record<AddKind, string>> = {
  ...AUTOMATION_STEP_NAMES,
  notify_webhook: AUTOMATION_NOTIFY_NAMES.webhook,
  notify_slack: AUTOMATION_NOTIFY_NAMES.slack,
  notify_teams: AUTOMATION_NOTIFY_NAMES.teams,
  ai_summarise: AUTOMATION_AI_NAMES.summarise,
  ai_card_type: AUTOMATION_AI_NAMES.card_type,
  ai_triage: AUTOMATION_AI_NAMES.triage,
};
export const isAiKind = (kind: AddKind): kind is AiKind =>
  (AI_KINDS as readonly string[]).includes(kind);

/** An AI action's first form: a summary as a comment, the suggested type set, a priority and labels. */
export function defaultAi(kind: AiKind): AutomationAi {
  if (kind === 'ai_summarise') return { kind: 'ai', task: 'summarise' };
  if (kind === 'ai_card_type') return { kind: 'ai', task: 'card_type', set: true };
  return { kind: 'ai', task: 'triage', priority: true, labels: true };
}
export const viaOf = (kind: OutgoingKind): AutomationVia =>
  kind === 'notify_webhook' ? 'webhook' : kind === 'notify_slack' ? 'slack' : 'teams';
export const isOutgoingKind = (kind: AddKind): kind is OutgoingKind =>
  (OUTGOING_KINDS as readonly string[]).includes(kind);

/** An outgoing action's first form: no webhook picked yet, the card's title and link as its message. */
export function defaultOutgoing(via: AutomationVia): AutomationOutgoing {
  return { kind: 'notify', via, webhook: '', text: '{{card.title}} {{card.url}}' };
}

/** A new step of any kind + Add Action offers. */
export function defaultStep(
  kind: AddKind,
  outline: Outline,
): AutomationAction | AutomationOutgoing | AutomationAi | AutomationWait {
  if (kind === 'wait') return { kind: 'wait', hours: 24 };
  if (isAiKind(kind)) return defaultAi(kind);
  return isOutgoingKind(kind) ? defaultOutgoing(viaOf(kind)) : defaultAction(kind, outline);
}

export const CONDITION_KINDS: readonly AutomationCondition['kind'][] = [
  'type',
  'column',
  'field',
  'who',
  'saved_filter',
];

type Outline = Pick<AutomationOutline, 'types' | 'columns' | 'labels' | 'boards'>;

const firstField = (outline: Outline, prefer: string) => {
  const fields = outlineFields(outline.types);
  return (fields.find((f) => f.id === prefer) ?? fields[0])?.id ?? prefer;
};

export function defaultAction(kind: AutomationActionKind, outline: Outline): AutomationAction {
  const status = outline.columns[0]?.status ?? '';
  switch (kind) {
    case 'move':
      return { kind, status };
    case 'set_field':
      return { kind, field: firstField(outline, 'priority'), value: { text: '' } };
    case 'clear_field':
      return { kind, field: firstField(outline, 'due') };
    case 'assign':
      return { kind, to: { trigger: true } };
    case 'add_label':
    case 'remove_label':
      return { kind, label: outline.labels[0] ?? '' };
    case 'comment':
      return { kind, text: '' };
    case 'create_card':
      return { kind, type: outline.types[0]?.id ?? '', title: '' };
    case 'email':
      return { kind, to: { assignee: true }, subject: '', body: '' };
    case 'set_type':
      return { kind, type: (outline.types[1] ?? outline.types[0])?.id ?? '' };
    case 'set_colour':
      return { kind, colour: '#dc2626' };
    case 'copy_card':
      return { kind };
    case 'add_checklist':
      return { kind, items: [''] };
    case 'link_card': {
      const field = outline.types.flatMap((t) => t.custom ?? []).find((f) => f.kind === 'card');
      return { kind, field: field?.id ?? '', to: { card: '' } };
    }
    case 'mention':
      return { kind, to: { assignee: true }, text: '' };
    case 'flag':
    case 'unflag':
    case 'archive':
    case 'restore':
    case 'resolve_threads':
      return { kind };
  }
}

export function defaultCondition(
  kind: AutomationCondition['kind'],
  outline: Outline,
): AutomationCondition {
  switch (kind) {
    case 'type':
      return { kind, types: outline.types[0] ? [outline.types[0].id] : [] };
    case 'column':
      return { kind, statuses: outline.columns[0] ? [outline.columns[0].status] : [] };
    case 'field':
      return { kind, field: firstField(outline, 'due'), op: 'not_empty' };
    case 'who':
      return { kind, who: [{ role: 'editor' }] };
    case 'saved_filter': {
      const board = outline.boards.find((b) => b.filters.length > 0);
      return { kind, tab: board?.tabId ?? '', filter: board?.filters[0]?.id ?? '' };
    }
  }
}
