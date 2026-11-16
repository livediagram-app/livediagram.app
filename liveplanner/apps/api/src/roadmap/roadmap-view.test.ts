import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  ROADMAP_COLUMN_CARDS_MAX,
  ROADMAP_DESCRIPTION_MAX,
  ROADMAP_FIELDS,
  type RoadmapSettings,
} from '@liveplanner/api-schema';
import {
  ITEMS_MAX,
  ITEM_TYPES,
  presetSetup,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { formLook } from '@liveplanner/project';
import { onRoadmap, publicCardOf, publicRoadmapOf } from './roadmap-view';

// The allowlist (docs/specs/026-plan/public-roadmap.md "The allowlist"): a visitor is sent a card's id and title, its
// vote count with voting, and each optional field only when chosen. People, comments, custom fields and every other
// field are never in the body, however they are set on the card.
const setup = { ...presetSetup('kanban'), addTypes: ['task', 'feature'] };
const secretType: ItemTypeDef = {
  id: 'feature',
  label: 'Feature',
  newTitle: 'New feature',
  glyph: 'star',
  color: '#16a34a',
  fields: ['title', 'description', 'status', 'assignee', 'f-revenue', 'f-owner', 'votes'],
  custom: [
    { id: 'f-revenue', label: 'Revenue', kind: 'currency' },
    { id: 'f-owner', label: 'Account owner', kind: 'person' },
  ],
};
const types = [...ITEM_TYPES, secretType];
const look = formLook({ id: 't1', name: 'Board', elements: [] } as never);

const PERSON = { id: 'p-sam', name: 'Sam Secret', color: '#123456' };
let n = 0;
function card(fields: Item['fields'], extra: Partial<Item> = {}): Item {
  n += 1;
  return {
    id: `c${n}`,
    type: 'feature',
    key: n,
    rank: `a${String(n).padStart(3, '0')}`,
    fields: { status: 'todo', ...fields },
    rev: 1,
    createdAt: 111,
    updatedAt: 222,
    createdBy: PERSON,
    updatedBy: PERSON,
    ...extra,
  };
}

// A card holding every kind of thing a roadmap must never send.
const loaded = () =>
  card({
    title: 'Dark mode',
    description: 'Night owls rejoice',
    assignee: PERSON,
    'f-owner': PERSON,
    'f-revenue': 125000,
    priority: 'urgent',
    estimate: 8,
    checklist: [{ id: 'k1', text: 'Secret step', done: false }],
    attachments: [{ id: 'a1', name: 'contract.pdf' }],
    cover: 'img-1',
    parent: 'c-parent',
    blockedBy: ['c-other'],
    links: ['c-link'],
    pullRequests: ['https://github.com/acme/secret/pull/9'],
    comments: [{ id: 'm1', text: 'Internal: big customer', by: PERSON }],
    labels: ['ui', 'Secret label'],
    start: '2027-03-03',
    due: '2027-04-14',
    votes: { 'p-sam': 2, 'rv:abc': 1 },
    archived: false,
  });

const settings = (s: Partial<RoadmapSettings> = {}): RoadmapSettings => ({
  title: 'Product Roadmap',
  columns: ['todo', 'doing', 'done'],
  types: ['feature'],
  fields: [],
  voting: true,
  formCode: null,
  ...s,
});

const FORBIDDEN = [
  'Sam Secret',
  'p-sam',
  'f-owner',
  'f-revenue',
  '125000',
  'urgent',
  'Secret step',
  'contract.pdf',
  'img-1',
  'c-parent',
  'c-other',
  'c-link',
  'acme/secret',
  'Internal: big customer',
  'rv:abc',
  '"status"',
  '"rank"',
  '"createdAt"',
  '"updatedAt"',
  '"rev"',
  'assignee',
  'estimate',
  'priority',
];

describe('publicCardOf', () => {
  it('sends only the id, the title and the vote count when no field is chosen', () => {
    const c = loaded();
    expect(publicCardOf(c, settings(), types, null)).toEqual({
      id: c.id,
      title: 'Dark mode',
      votes: 3,
      voted: false,
    });
  });

  it('never sends people, comments, custom fields or any field off the allowlist, even with every field chosen', () => {
    const body = JSON.stringify(
      publicCardOf(loaded(), settings({ fields: [...ROADMAP_FIELDS] }), types, 'rv:abc'),
    );
    for (const word of FORBIDDEN) expect(body, word).not.toContain(word);
  });

  it.each(ROADMAP_FIELDS)('leaves %s out unless chosen, and sends it when chosen', (field) => {
    const c = loaded();
    const off = publicCardOf(
      c,
      settings({ fields: ROADMAP_FIELDS.filter((f) => f !== field) }),
      types,
      null,
    );
    const key = field === 'number' ? 'number' : field;
    expect(off).not.toHaveProperty(key);
    const on = publicCardOf(c, settings({ fields: [field] }), types, null);
    expect(on).toHaveProperty(key);
  });

  it('sends each chosen field as the page shows it', () => {
    const c = loaded();
    expect(publicCardOf(c, settings({ fields: [...ROADMAP_FIELDS] }), types, 'rv:abc')).toEqual({
      id: c.id,
      title: 'Dark mode',
      votes: 3,
      voted: true,
      description: 'Night owls rejoice',
      number: c.key,
      type: 'Feature',
      labels: ['ui', 'Secret label'],
      start: '2027-03-03',
      due: '2027-04-14',
    });
  });

  it('leaves out a chosen field the card has no value for, and odd values', () => {
    const c = card(
      {
        title: '',
        description: '   ',
        labels: ['', 3],
        start: '2027-03-03T10:00',
        due: 'soon',
      },
      { type: 'gone' },
    );
    expect(
      publicCardOf(c, settings({ fields: [...ROADMAP_FIELDS], voting: false }), types, null),
    ).toEqual({ id: c.id, title: 'Untitled', number: c.key });
  });

  it('cuts a long description and sends no vote count with voting off', () => {
    const c = card({ title: 'Long', description: 'x'.repeat(5000) });
    const out = publicCardOf(c, settings({ fields: ['description'], voting: false }), types, null);
    expect(out.description).toHaveLength(ROADMAP_DESCRIPTION_MAX);
    expect(out).not.toHaveProperty('votes');
    expect(out).not.toHaveProperty('voted');
  });
});

describe('onRoadmap', () => {
  it('takes live cards of a shown type in a shown column of the board', () => {
    expect(onRoadmap(settings(), setup, card({ title: 'a' }), types)).toBe(true);
  });
  it.each([
    ['a hidden column', card({ title: 'a', status: 'backlog' })],
    ['no status', card({ title: 'a', status: 7 })],
    ['a status the board has no column for', card({ title: 'a', status: 'elsewhere' })],
    ['an unchosen type', card({ title: 'a' }, { type: 'task' })],
    ['an archived card', card({ title: 'a', archived: true })],
    ['a trashed card', card({ title: 'a', status: 'trash' })],
  ])('leaves out %s', (_, item) => {
    expect(
      onRoadmap(settings({ columns: ['todo', 'elsewhere', 'trash'] }), setup, item, types),
    ).toBe(false);
  });
  it('leaves out a type the board no longer shows', () => {
    expect(
      onRoadmap(settings(), { ...setup, addTypes: ['task'] }, card({ title: 'a' }), types),
    ).toBe(false);
  });
});

describe('publicRoadmapOf', () => {
  it('lists the shown columns in the board order with their cards in board order, never a hidden one', () => {
    const a = card({ title: 'A', status: 'doing' }, { rank: 'b' });
    const b = card({ title: 'B', status: 'doing' }, { rank: 'a' });
    const hidden = card({ title: 'Under review idea', status: 'backlog' });
    const out = publicRoadmapOf({
      settings: settings({ columns: ['done', 'doing'] }),
      setup,
      items: [a, hidden, b],
      types,
      look,
      voter: null,
      suggestPath: '/form/abc',
    });
    expect(out.title).toBe('Product Roadmap');
    expect(out.suggestPath).toBe('/form/abc');
    expect(out.columns.map((c) => c.name)).toEqual(['In Progress', 'Done']);
    expect(out.columns[0]!.cards.map((c) => c.title)).toEqual(['B', 'A']);
    expect(out.columns[1]).toEqual({ name: 'Done', count: 0, cards: [] });
    const body = JSON.stringify(out);
    expect(body).not.toContain('Under review idea');
    expect(body).not.toContain('Backlog');
    expect(body).not.toContain('Review');
  });

  it("orders by the board's Sort Cards when set", () => {
    const few = card({ title: 'Few', votes: { x: 1 } });
    const many = card({ title: 'Many', votes: { x: 1, y: 1, z: 1 } });
    const out = publicRoadmapOf({
      settings: settings(),
      setup: { ...setup, sortBy: [{ field: 'votes', dir: 'desc' }] },
      items: [few, many],
      types,
      look,
      voter: null,
      suggestPath: null,
    });
    expect(out.columns[0]!.cards.map((c) => c.title)).toEqual(['Many', 'Few']);
  });

  it('caps a column at ROADMAP_COLUMN_CARDS_MAX cards and counts them all', () => {
    const items = Array.from({ length: ROADMAP_COLUMN_CARDS_MAX + 5 }, (_, i) =>
      card({ title: `c${i}` }),
    );
    const out = publicRoadmapOf({
      settings: settings(),
      setup,
      items,
      types,
      look,
      voter: null,
      suggestPath: null,
    });
    expect(out.columns[0]!.count).toBe(ROADMAP_COLUMN_CARDS_MAX + 5);
    expect(out.columns[0]!.cards).toHaveLength(ROADMAP_COLUMN_CARDS_MAX);
  });

  // Every read builds the page fresh (no-store), so a plan at the card cap must stay cheap to read.
  it('builds a roadmap of a plan at ITEMS_MAX cards within budget', () => {
    const items = Array.from({ length: ITEMS_MAX }, (_, i) =>
      card(
        {
          title: `Idea ${i}`,
          description: 'd'.repeat(300),
          status: ['todo', 'doing', 'done', 'backlog'][i % 4]!,
          labels: ['a', 'b'],
          votes: { [`rv:${i}`]: 1 },
        },
        { rank: `r${String(ITEMS_MAX - i).padStart(5, '0')}` },
      ),
    );
    const input = {
      settings: settings({ fields: [...ROADMAP_FIELDS] }),
      setup: { ...setup, sortBy: [{ field: 'votes', dir: 'desc' as const }] },
      items,
      types,
      look,
      voter: 'rv:1',
      suggestPath: null,
    };
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 5; i++) publicRoadmapOf(input);
    });
    expect(ms / 5).toBeLessThan(cpuBudgetMs(60));
  });
});
