import { describe, expect, it } from 'vitest';
import {
  boardFields,
  presetSetup,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { SUGGESTIONS_MAX, FILTER_SUGGEST_CARDS, suggestWidgets } from './widget-suggestions';
import { card } from './test-fixtures';

// docs/specs/026-plan/board-widgets.md "The widget gallery" "For You".

const def = (id: string, kind: CustomFieldDef['kind'], extra: Partial<CustomFieldDef> = {}) => ({
  id,
  label: id[2]!.toUpperCase() + id.slice(3),
  kind,
  ...extra,
});
const type = (id: string, custom: CustomFieldDef[]): ItemTypeDef => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  newTitle: 'New',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'assignee', 'due', ...custom.map((c) => c.id)],
  custom,
});
const NOW = new Date(2026, 9, 10, 12);
const ANA = { id: 'ana', name: 'Ana', color: '#111111' };
const BEN = { id: 'ben', name: 'Ben', color: '#222222' };

const budget = def('f-budget', 'currency');
const severity = def('f-severity', 'choice', { options: ['High', 'Low'] });
const approved = def('f-approved', 'checkbox');
const types = [type('feature', [budget, severity, approved]), type('bug', [severity])];
const kanban = presetSetup('kanban');
const board: PlanBoardSetup = {
  ...kanban,
  columns: kanban.columns.map(({ wipLimit: _, ...c }) => c),
  addTypes: ['feature', 'bug'],
};
const fields = boardFields(board, types);

const suggest = (items: readonly Item[], widgets: PlanBoardSetup['widgets'] = [], setup = board) =>
  suggestWidgets({ setup, items, types, fields, widgets: widgets ?? [], now: NOW });

describe('suggestWidgets', () => {
  it('puts a field filled on most of its cards ahead of every built-in, with why', () => {
    const items = [
      card({ status: 'todo', 'f-budget': 10, 'f-severity': 'High', assignee: ANA }, 'feature'),
      card({ status: 'todo', 'f-budget': 20, assignee: BEN }, 'feature'),
      card({ status: 'done', 'f-budget': 5 }, 'feature'),
      card({ status: 'todo' }, 'bug'),
    ];
    const out = suggest(items);
    expect(out[0]).toEqual({
      id: 'field:sum:f-budget',
      score: 2,
      reason: 'Every Feature card has a Budget',
    });
    // Severity is filled on one of four Feature and Bug cards: among the built-ins, not ahead of them.
    const sev = out.find((s) => s.id === 'field:breakdown:f-severity');
    expect(sev?.reason).toBe('25% of Feature and Bug cards have a Severity');
    expect(sev!.score).toBeLessThan(0.9);
    expect(out.map((s) => s.id)).toContain('progress');
    expect(out.find((s) => s.id === 'people')?.reason).toBe('2 people have cards here');
    expect(out.find((s) => s.id === 'unassigned')?.reason).toBe('2 cards have nobody');
    // An unticked Checkbox everywhere is nothing to suggest.
    expect(out.some((s) => s.id.includes('f-approved'))).toBe(false);
    expect(out.length).toBeLessThanOrEqual(SUGGESTIONS_MAX);
  });

  it('never suggests a widget the board holds, and keeps to the cap', () => {
    const items = [card({ status: 'todo', 'f-budget': 10 }, 'feature')];
    const out = suggest(items, ['field:sum:f-budget', 'progress']);
    expect(out.some((s) => s.id === 'field:sum:f-budget' || s.id === 'progress')).toBe(false);
    expect(
      suggestWidgets({ setup: board, items, types, fields, widgets: [], now: NOW, max: 1 }),
    ).toHaveLength(1);
  });

  it('offers only what reads true on an empty board', () => {
    expect(suggest([])).toEqual([]);
    const wip: PlanBoardSetup = {
      ...board,
      columns: board.columns.map((c, i) => (i === 1 ? { ...c, wipLimit: 3 } : c)),
    };
    expect(suggest([], [], wip).map((s) => s.id)).toEqual(['wip']);
  });

  it('suggests the built-ins each board reads true', () => {
    const wip: PlanBoardSetup = {
      ...board,
      columns: board.columns.map((c, i) => (i === 1 ? { ...c, wipLimit: 3 } : c)),
    };
    const many = Array.from({ length: FILTER_SUGGEST_CARDS }, (_, i) =>
      card(
        {
          status: 'todo',
          ...(i === 0 ? { due: '2026-10-12', estimate: 3, votes: { ana: 2 } } : {}),
          ...(i === 1 ? { timeSpent: { entries: [{ id: 't', minutes: 30, at: 0 }] } } : {}),
        },
        'feature',
      ),
    );
    const ids = suggestWidgets({
      setup: wip,
      items: many,
      types,
      fields: [],
      widgets: [],
      now: NOW,
      max: 20,
    });
    const byId = new Map(ids.map((s) => [s.id, s.reason]));
    expect(byId.get('wip')).toBe('Columns here have WIP limits');
    expect(byId.get('due')).toBe('1 card has a due date');
    expect(byId.get('filter')).toBe(`${FILTER_SUGGEST_CARDS} cards to search through`);
    expect(byId.get('points')).toBe('Cards here carry estimates');
    expect(byId.has('unassigned')).toBe(false);
  });
});
