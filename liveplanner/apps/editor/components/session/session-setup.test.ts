import { describe, expect, it } from 'vitest';
import { DAY_MS, type Item, type ItemTypeDef } from '@liveplanner/items';
import {
  cardsWord,
  defaultSessionSetup,
  rangeWords,
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
    expect(
      defaultSessionSetup({
        sessionKind: 'refinement',
        items,
        types,
        planStatuses: PLAN,
        statusNames: NAMES,
      }),
    ).toEqual({
      typeIds: ['task'],
      statuses: ['backlog', 'detail', 'new'],
    });
  });

  it('falls back to every type with cards and its first stage, then to the first type', () => {
    const items = [card('bug', 'done')];
    expect(
      defaultSessionSetup({
        sessionKind: 'refinement',
        items,
        types,
        planStatuses: PLAN,
        statusNames: NAMES,
      }),
    ).toEqual({
      typeIds: ['bug'],
      statuses: ['new'],
    });
    const plain = [type('work', ['doing', 'done'])];
    expect(
      defaultSessionSetup({
        sessionKind: 'refinement',
        items: [],
        types: plain,
        planStatuses: PLAN,
        statusNames: new Map(),
      }),
    ).toEqual({ typeIds: ['work'], statuses: ['doing'] });
  });
});

describe('defaultSessionSetup for Sprint Planning', () => {
  it('picks the types with cards in a ready-like stage, and those stages', () => {
    const plan = ['backlog', 'reviewed', 'doing', 'done'];
    const names = new Map([
      ['backlog', 'Backlog'],
      ['reviewed', 'Reviewed'],
      ['doing', 'Doing'],
      ['done', 'Done'],
    ]);
    const types = [type('feature'), type('bug', ['doing', 'done'])];
    const items = [card('feature', 'reviewed'), card('bug', 'doing')];
    expect(
      defaultSessionSetup({
        sessionKind: 'planning',
        items,
        types,
        planStatuses: plan,
        statusNames: names,
      }),
    ).toEqual({ typeIds: ['feature'], statuses: ['backlog', 'reviewed'] });
  });
});

// docs/specs/026-plan/session-tabs.md "Bug Triage", "Making one".
describe('defaultSessionSetup for Bug Triage', () => {
  const plan = ['new', 'triage', 'confirmed', 'done'];
  const names = new Map([
    ['new', 'New'],
    ['triage', 'Under Review'],
    ['confirmed', 'Confirmed'],
    ['done', 'Done'],
  ]);
  it('prefers the bug-like types with cards in an intake stage, oldest first', () => {
    const types: ItemTypeDef[] = [type('task'), type('bug'), { ...type('defect'), glyph: 'bug' }];
    const items = [card('task', 'new'), card('bug', 'triage'), card('defect', 'new')];
    expect(
      defaultSessionSetup({
        sessionKind: 'triage',
        items,
        types,
        planStatuses: plan,
        statusNames: names,
      }),
    ).toEqual({
      typeIds: ['bug', 'defect'],
      statuses: ['new', 'triage'],
      sortBy: [{ field: 'createdAt', dir: 'asc' }],
    });
  });

  it('keeps every type with intake cards when none is bug-like', () => {
    const types = [type('task'), type('story')];
    const items = [card('task', 'new'), card('story', 'confirmed')];
    expect(
      defaultSessionSetup({
        sessionKind: 'triage',
        items,
        types,
        planStatuses: plan,
        statusNames: names,
      }).typeIds,
    ).toEqual(['task']);
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

describe('Sprint Review set-up', () => {
  const types = [type('task', ['backlog', 'doing', 'shipping'])];
  const NOW = 100 * DAY_MS;
  const PHASES = new Map([['shipping', 'done' as const]]);
  const NAMED = new Map([...NAMES, ['shipping', 'Shipping']]);
  const items = [card('task', 'shipping', { archived: true }), card('task', 'doing')];

  it('starts from Done-phase stages, archived cards counted, since the last review', () => {
    expect(
      defaultSessionSetup({
        sessionKind: 'review',
        items,
        types,
        planStatuses: PLAN,
        statusNames: NAMED,
        statusPhases: PHASES,
        lastReviewAt: 42,
        now: NOW,
      }),
    ).toEqual({
      typeIds: ['task'],
      statuses: ['shipping'],
      sortBy: [{ field: 'updatedAt', dir: 'asc' }],
      since: 42,
    });
  });

  it('with no earlier review, starts 14 days back from now', () => {
    expect(
      defaultSessionSetup({
        sessionKind: 'review',
        items,
        types,
        planStatuses: PLAN,
        statusNames: NAMED,
        statusPhases: PHASES,
        now: NOW,
      }).since,
    ).toBe(NOW - 14 * DAY_MS);
  });

  it('counts archived cards when asked', () => {
    expect(stageCounts(items, ['task'], true).get('shipping')).toBe(1);
    expect(stageCounts(items, ['task']).get('shipping')).toBeUndefined();
  });

  it('words the done range in the sidebar header', () => {
    const at = new Date(2026, 10, 14).getTime();
    const to = new Date(2026, 10, 21).getTime();
    const day = (ms: number) =>
      new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    expect(rangeWords({ since: at, until: to })).toBe(`${day(at)} to ${day(to)}`);
    expect(rangeWords({ since: at })).toBe(`since ${day(at)}`);
    expect(rangeWords({ until: to })).toBe(`until ${day(to)}`);
    expect(rangeWords({})).toBe('');
    expect(setupWords({ typeIds: ['task'], statuses: ['done'], since: at }, types, NAMES)).toBe(
      `Done · since ${day(at)}`,
    );
  });
});
