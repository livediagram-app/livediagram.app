import { describe, expect, it } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import {
  cardsWord,
  defaultSessionSetup,
  setupWords,
  stageCounts,
  stagesFor,
} from './session-setup';

// docs/specs/026-plan/session-tabs.md "Making one": what Set Up Refinement picks first, the stages it offers with
// their counts, and the set-up in words.
const type = (id: string, statuses?: string[]): ItemTypeDef => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  newTitle: `New ${id}`,
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status', 'priority'],
  ...(statuses ? { statuses } : {}),
});
let n = 0;
const card = (t: string, status: string, extra: Record<string, unknown> = {}): Item => ({
  id: `c${++n}`,
  type: t,
  key: n,
  rank: 'i',
  fields: { title: `Card ${n}`, status, ...extra },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});
// A card with no status at all.
const statusless = (t: string): Item => {
  const c = card(t, '');
  const { status: _none, ...fields } = c.fields;
  return { ...c, fields };
};
const PLAN = ['backlog', 'detail', 'doing', 'done', 'new'];
const NAMES = new Map([
  ['backlog', 'Backlog'],
  ['detail', 'Needs Detail'],
  ['doing', 'Doing'],
  ['done', 'Done'],
  ['new', 'New'],
]);

describe('stagesFor', () => {
  it('offers the picked types’ stages once each, in the plan’s order, then any the plan does not list', () => {
    const types = [type('task', ['doing', 'backlog']), type('bug', ['new', 'done', 'triage'])];
    expect(stagesFor(['task', 'bug', 'gone'], types, PLAN)).toEqual([
      'backlog',
      'doing',
      'done',
      'new',
      'triage',
    ]);
    expect(stagesFor(['task'], [type('task')], PLAN)).toEqual(PLAN);
  });
});

describe('stageCounts', () => {
  it('counts the picked types’ live cards in each stage', () => {
    const counts = stageCounts(
      [
        card('task', 'backlog'),
        card('task', 'backlog'),
        card('bug', 'backlog'),
        card('task', 'doing', { archived: true }),
        card('task', ''),
        statusless('task'),
      ],
      ['task'],
    );
    expect([...counts]).toEqual([
      ['backlog', 2],
      ['', 2],
    ]);
  });
});

describe('defaultSessionSetup', () => {
  const types = [type('task'), type('bug', ['new', 'done'])];

  it('picks the types with cards in a refinement-like stage, and those stages', () => {
    const items = [
      card('task', 'detail'),
      card('task', 'doing'),
      card('bug', 'done'),
      statusless('bug'),
    ];
    expect(defaultSessionSetup({ items, types, planStatuses: PLAN, statusNames: NAMES })).toEqual({
      typeIds: ['task'],
      statuses: ['backlog', 'detail', 'new'],
    });
  });

  it('falls back to every type with cards and its first stage, then to the first type', () => {
    const items = [card('bug', 'done')];
    expect(defaultSessionSetup({ items, types, planStatuses: PLAN, statusNames: NAMES })).toEqual({
      typeIds: ['bug'],
      statuses: ['new'],
    });
    const plain = [type('work', ['doing', 'done'])];
    expect(
      defaultSessionSetup({ items: [], types: plain, planStatuses: PLAN, statusNames: new Map() }),
    ).toEqual({ typeIds: ['work'], statuses: ['doing'] });
  });
});

describe('the set-up in words', () => {
  it('names the stages, then the order', () => {
    const types = [type('task')];
    expect(setupWords({ typeIds: ['task'], statuses: ['backlog', 'x'] }, types, NAMES)).toBe(
      'Backlog, x',
    );
    expect(
      setupWords(
        { typeIds: ['task'], statuses: ['backlog'], sortBy: [{ field: 'priority', dir: 'desc' }] },
        types,
        NAMES,
      ),
    ).toBe('Backlog · Priority (Highest First)');
    expect([cardsWord(1), cardsWord(3)]).toEqual(['1 card', '3 cards']);
  });
});
