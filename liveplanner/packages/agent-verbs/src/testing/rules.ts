// A plan for the rule suites (docs/specs/026-plan/automations.md "Agents and the CLI"): a Bug card type with custom
// fields, two columns, a Board and a Form tab, a person, a card, and rules and runs as the api lists them.
import type {
  AutomationListedRule,
  AutomationRun,
  AutomationsListResponse,
  PlanResponse,
} from '@liveplanner/api-schema';
import type { Item, ItemTypeDef } from '@liveplanner/items';

export const BUG: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'item',
  color: '#dc2626',
  fields: ['title', 'status', 'assignee', 'due', 'f-sev', 'f-done'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-done', label: 'Completed On', kind: 'date' },
  ],
  fieldLabels: { due: 'Deadline' },
};

// A type with no custom fields.
export const NOTE: ItemTypeDef = {
  id: 'note',
  label: 'Note',
  newTitle: 'New note',
  glyph: 'item',
  color: '#64748b',
  fields: ['title', 'status'],
};

export const PLAN: PlanResponse = {
  boards: [],
  statuses: [
    { status: 'todo', name: 'To Do' },
    { status: 'done', name: 'Done' },
  ],
  types: [NOTE, BUG],
  tabs: [
    { id: 't_1', name: 'Board', kind: 'board' },
    { id: 'f_1', name: 'RSVP', kind: 'form' },
  ],
  itemTypesRev: 1,
};

export const ANA = { id: 'p_ana', name: 'Ana Costa' };
const BY = { id: 'p_ana', name: 'Ana Costa', color: '#7c3aed' };
export const NOW = Date.UTC(2026, 10, 11, 9);

export const CARD: Item = {
  id: 'card12',
  type: 'bug',
  key: 12,
  rank: 'i',
  fields: { title: 'Basket' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: BY,
  updatedBy: BY,
};

export function listed(over: Partial<AutomationListedRule> = {}): AutomationListedRule {
  return {
    id: 'r1',
    name: 'Done stamp',
    trigger: { kind: 'card_moved', to: ['done'] },
    conditions: [],
    steps: [{ kind: 'add_label', label: 'shipped' }],
    chain: false,
    timeZone: 'Europe/London',
    enabled: true,
    made: { by: BY, at: NOW },
    edited: { by: BY, at: NOW, ai: true },
    stats: { lastRunAt: NOW, runsThisWeek: 3, failuresInARow: 0 },
    needs: [],
    attention: [],
    ...over,
  };
}

export function listOf(
  rules: AutomationListedRule[] = [listed()],
  people: AutomationsListResponse['people'] = [ANA],
): AutomationsListResponse {
  return { rules, runsToday: 4, runsPerDay: 1000, ...(people ? { people } : {}) };
}

export function run(over: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run1',
    ruleId: 'r1',
    ruleName: 'Done stamp',
    card: { id: 'card12', key: 12, title: 'Basket' },
    at: NOW,
    result: 'done',
    tookMs: 7,
    steps: [
      { kind: 'trigger', text: 'Ana Costa moved #12 to Done' },
      { kind: 'condition', ok: true, text: 'Card Type is Bug' },
      { kind: 'action', ok: true, text: 'Add Label shipped', already: true },
      { kind: 'action', ok: false, text: 'Move to Done' },
      { kind: 'branch', ok: true, text: 'For each Child Card: on 1 related card', cards: 1 },
    ],
    ...over,
  };
}
