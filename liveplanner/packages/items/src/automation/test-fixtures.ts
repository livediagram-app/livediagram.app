// Test helpers for the Automations modules (docs/specs/026-plan/automations.md): a small plan outline (two card types,
// three columns, two people, a saved filter and a Form tab), a card factory and a rule body. Only tests import it.

import type { Item, ItemFieldValue } from '../item';
import type { ItemTypeDef } from '../item-types';
import { ALI, SAM, item } from '../test-items';
import type { AutomationOutline } from './outline';
import type { AutomationRuleBody } from './types';
import type { PlanActionsContext } from './plan-actions';

export { ALI, SAM };

export const BUG: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'item',
  color: '#dc2626',
  fields: [
    'title',
    'status',
    'assignee',
    'priority',
    'labels',
    'due',
    'estimate',
    'f-severity',
    'f-points',
    'f-when',
    'f-parent',
    'f-owner',
    'f-calc',
    'f-tags',
  ],
  custom: [
    {
      id: 'f-severity',
      label: 'Severity',
      kind: 'choice',
      options: ['Low', 'High'],
      required: true,
    },
    { id: 'f-points', label: 'Points', kind: 'number' },
    { id: 'f-when', label: 'When', kind: 'date' },
    { id: 'f-parent', label: 'Parent Bug', kind: 'card', linkType: 'bug' },
    { id: 'f-owner', label: 'Owner', kind: 'person' },
    { id: 'f-calc', label: 'Score', kind: 'calculated', calculation: 'formula', formula: '1' },
    { id: 'f-tags', label: 'Tags', kind: 'multichoice', options: ['a', 'b'] },
  ],
  statuses: ['todo', 'doing', 'done'],
  fieldLabels: { due: 'Deadline' },
};

export const NOTE: ItemTypeDef = {
  id: 'note',
  label: 'Note',
  newTitle: 'New note',
  glyph: 'item',
  color: '#64748b',
  fields: ['title', 'status', 'f-links'],
  custom: [{ id: 'f-links', label: 'Links', kind: 'card', multiple: true }],
  statuses: ['todo'],
};

export const OUTLINE: AutomationOutline = {
  types: [BUG, NOTE],
  statuses: [
    { status: 'todo', name: 'To Do' },
    { status: 'doing', name: 'Doing' },
    { status: 'done', name: 'Done' },
  ],
  people: [SAM, ALI],
  savedFilters: [
    { tab: 't1', filter: { id: 'sf-mine', name: 'Mine', mine: true }, finished: ['done'] },
    {
      tab: 't1',
      filter: { id: 'sf-high', name: 'High', filters: [{ by: 'priority', key: 'p:high' }] },
      finished: [],
    },
  ],
  formTabs: ['form1'],
};

export const NOW = Date.parse('2026-11-11T10:42:00Z');
export const ZONE = 'Europe/London';

// A Bug card; a field given as undefined is left off.
export function bug(
  fields: Record<string, ItemFieldValue | undefined> = {},
  extra: Partial<Item> = {},
): Item {
  const all = { title: 'Login fails', status: 'todo', 'f-severity': 'High', ...fields };
  return item(Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined)), {
    type: 'bug',
    ...extra,
  });
}

export function ctxFor(card: Item, extra: Partial<PlanActionsContext> = {}): PlanActionsContext {
  return {
    card,
    outline: OUTLINE,
    by: SAM,
    role: 'editor',
    now: NOW,
    timeZone: ZONE,
    rule: { name: 'Done Means Done' },
    url: 'https://app.test/project/p1?card=x',
    ...extra,
  };
}

export function ruleBody(extra: Partial<AutomationRuleBody> = {}): AutomationRuleBody {
  return {
    name: 'Done Means Done',
    trigger: { kind: 'card_moved', to: ['done'] },
    conditions: [],
    steps: [{ kind: 'flag' }],
    chain: false,
    timeZone: ZONE,
    ...extra,
  };
}
