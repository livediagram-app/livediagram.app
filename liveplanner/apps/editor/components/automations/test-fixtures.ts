import { fireEvent } from '@testing-library/react';
// Shared fixtures for the Automations tests: a plan outline, rules as the list answers them, and runs.

import { ITEM_TYPES, type AutomationRun, type Item, type ItemPerson } from '@liveplanner/items';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import type { AutomationOutline } from './automation-outline';

export const ANA: ItemPerson = { id: 'u-ana', name: 'Ana Costa', color: '#0ea5e9' };
export const MARCO: ItemPerson = { id: 'u-marco', name: 'Marco Ruiz', color: '#f97316' };
export const NOW = Date.UTC(2026, 10, 11, 10, 0);

export function card(key: number, title: string, fields: Item['fields'] = {}): Item {
  return {
    id: `i${key}`,
    type: 'task',
    key,
    rank: 'a',
    fields: { title, status: 'todo', ...fields },
    rev: 1,
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
    createdBy: ANA,
    updatedBy: ANA,
  };
}

export function outline(over: Partial<AutomationOutline> = {}): AutomationOutline {
  const statuses = new Map([
    ['todo', 'To Do'],
    ['doing', 'In Progress'],
    ['done', 'Done'],
  ]);
  const items = new Map([[`i48`, card(48, 'Publish pricing page', { assignee: MARCO.id })]]);
  return {
    types: ITEM_TYPES,
    statuses,
    columns: [...statuses].map(([status, name]) => ({ status, name })),
    phases: new Map([
      ['todo', 'todo'],
      ['doing', 'doing'],
      ['done', 'done'],
    ]),
    people: [ANA, MARCO],
    labels: ['blocked', 'launch'],
    tabs: new Map([['t-form', 'Intake Form']]),
    filters: new Map([['f1', 'Mine']]),
    forms: [{ id: 't-form', name: 'Intake Form' }],
    boards: [
      {
        tabId: 't-board',
        tabName: 'Board',
        title: 'Roadmap',
        filters: [{ id: 'f1', name: 'Mine' }],
      },
    ],
    items,
    ...over,
  };
}

export function rule(over: Partial<AutomationListedRule> = {}): AutomationListedRule {
  return {
    id: 'r1',
    name: 'Done Means Wrapped Up',
    trigger: { kind: 'card_moved', to: ['done'] },
    conditions: [],
    steps: [{ kind: 'remove_label', label: 'blocked' }],
    chain: false,
    timeZone: 'Europe/London',
    enabled: true,
    made: { by: ANA, at: NOW - 86_400_000 * 3 },
    edited: { by: ANA, at: NOW - 86_400_000 * 3 },
    stats: { lastRunAt: NOW - 4 * 60_000, runsThisWeek: 38, failuresInARow: 0 },
    needs: [],
    ...over,
  };
}

export function run(over: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run1',
    ruleId: 'r1',
    ruleName: 'Done Means Wrapped Up',
    card: { id: 'i48', key: 48, title: 'Publish pricing page' },
    at: NOW - 60_000,
    result: 'done',
    tookMs: 38,
    steps: [
      { kind: 'trigger', text: 'moved the card to Done', by: MARCO },
      { kind: 'condition', ok: true, text: 'Card Type is Task' },
      { kind: 'action', ok: true, text: 'Removed the label blocked' },
    ],
    ...over,
  };
}

/** Picks a trigger or an action kind the way a person does: the panel's Change, then the picker's tile for `kind`. */
export function pickStep(kind: string): void {
  const change = document.querySelector<HTMLButtonElement>('[data-change-step]');
  if (!change) throw new Error('No Change button');
  fireEvent.click(change);
  const tile = document.querySelector<HTMLButtonElement>(`[data-picker-tile="${kind}"]`);
  if (!tile) throw new Error(`No picker tile for ${kind}`);
  fireEvent.click(tile);
}

/** An open picker's tile for `kind`, or null when it does not offer one. */
export const pickerTile = (kind: string): HTMLButtonElement | null =>
  document.querySelector<HTMLButtonElement>(`[data-picker-tile="${kind}"]`);

/** The kinds an open picker offers that can be picked now (a full group's are disabled). */
export const pickable = (): string[] =>
  [...document.querySelectorAll<HTMLButtonElement>('[data-picker-tile]')]
    .filter((t) => !t.disabled)
    .map((t) => t.getAttribute('data-picker-tile')!);
