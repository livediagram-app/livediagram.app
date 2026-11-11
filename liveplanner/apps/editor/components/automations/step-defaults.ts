// A new step's first form (docs/specs/026-plan/automations.md "The rule builder"): each kind added from + Add Action
// or + Add Condition starts filled from the plan where it can (its first column, card type, field or label), so the
// panel opens on something that reads. Text a person must write starts empty, and the api's refusal names it. Pure.

import type {
  AutomationAction,
  AutomationActionKind,
  AutomationCondition,
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
];

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
    case 'flag':
    case 'unflag':
    case 'archive':
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
