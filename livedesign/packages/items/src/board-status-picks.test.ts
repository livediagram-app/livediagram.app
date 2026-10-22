import { describe, expect, it } from 'vitest';
import { missingBoardStatuses, missingStatuses, pickableStatuses } from './board-status-picks';
import { item } from './test-items';

// docs/specs/026-plan/plan-board.md "The column picker": the existing statuses a board can add as columns.
const board = (columns: { status: string; name: string }[], addTypes?: string[]) => ({
  columns: columns.map((c) => ({ id: c.status, ...c })),
  ...(addTypes ? { addTypes } : {}),
});

const names = new Map([
  ['todo', 'To Do'],
  ['doing', 'Doing'],
  ['review', 'In Review'],
  ['done', 'Done'],
]);

describe('pickableStatuses', () => {
  it('adds the statuses only cards hold, by name, then the card types’ Default States', () => {
    const out = pickableStatuses(
      names,
      [
        item({ status: 'zeta~a1' }),
        item({ status: 'blocked~b2' }),
        item({ status: 'blocked~b2' }),
        item({ status: 'gone~c3' }, { fields: { status: 'trash', trashedFrom: 'gone~c3' } }),
      ],
      [
        { id: 'a', defaultStatus: 'triage~d4' },
        { id: 'b', defaultStatus: 'todo' },
        { id: 'c' },
        { id: 'd', defaultStatus: 'triage~d4' },
      ],
    );
    expect([...out]).toEqual([
      ...names,
      ['blocked~b2', 'Blocked'],
      ['zeta~a1', 'Zeta'],
      ['triage~d4', 'Triage'],
    ]);
  });

  it('gives the same map back when there is nothing to add', () => {
    expect(
      pickableStatuses(names, [item({ status: 'todo' })], [{ id: 'a', defaultStatus: 'done' }]),
    ).toBe(names);
  });
});

describe('missingStatuses', () => {
  it('leaves out the board’s statuses and its names, one per name, in order', () => {
    const doc = new Map([...names, ['todo~x9', 'TO  DO'], ['in-review~2', 'in review']]);
    expect(missingStatuses(board([{ status: 'doing', name: 'Doing' }]), doc)).toEqual([
      { status: 'todo', name: 'To Do' },
      { status: 'review', name: 'In Review' },
      { status: 'done', name: 'Done' },
    ]);
    // A column of the same name (another status) still keeps that name off the list.
    expect(
      missingStatuses(board([{ status: 'mine', name: 'to do' }]), doc).map((p) => p.status),
    ).toEqual(['doing', 'review', 'done']);
  });

  it('skips a status whose name has no letters or digits', () => {
    expect(missingStatuses(board([]), new Map([['x', '--']]))).toEqual([]);
  });
});

describe('missingBoardStatuses', () => {
  const items = [
    item({ status: 'review' }),
    item({ status: 'review' }),
    item({ status: 'review' }, { type: 'bug' }),
    item({ status: 'review', archived: true }),
    item({ status: 'trash', trashedFrom: 'review' }),
    item({ status: 'done' }),
    item({ status: 'doing' }),
  ];
  const boards = [
    { title: 'Sprint', statuses: ['todo', 'review'], colours: new Map([['review', '#7c3aed']]) },
    { title: '  ', statuses: ['review', 'done'], colours: new Map([['review', '#dc2626']]) },
    { title: 'Sprint', statuses: ['review'] },
  ];

  it('counts each one’s live cards, names its boards and takes the first board’s colour', () => {
    const out = missingBoardStatuses(board([{ status: 'doing', name: 'Doing' }]), names, {
      items,
      boards,
    });
    expect(out).toEqual([
      { status: 'todo', name: 'To Do', cards: 0, boards: ['Sprint'] },
      {
        status: 'review',
        name: 'In Review',
        cards: 3,
        boards: ['Sprint', 'Untitled Board'],
        colour: '#7c3aed',
      },
      { status: 'done', name: 'Done', cards: 1, boards: ['Untitled Board'] },
    ]);
  });

  // A status id that names an Object.prototype key reads only what was set.
  it('reads no colour for a status named like an object key', () => {
    const odd = new Map([
      ['constructor', 'Constructor'],
      ['toString', 'To String'],
    ]);
    const out = missingBoardStatuses(board([]), odd, {
      boards: [{ title: 'B', statuses: ['constructor', 'toString'], colours: new Map() }],
    });
    expect(out.map((s) => s.colour)).toEqual([undefined, undefined]);
    expect(out.every((s) => !('colour' in s))).toBe(true);
  });

  it('counts only the card types the board shows', () => {
    const types = [{ id: 'task' }, { id: 'bug' }];
    const out = missingBoardStatuses(board([{ status: 'doing', name: 'Doing' }], ['bug']), names, {
      items,
      types,
    });
    expect(out.find((s) => s.status === 'review')?.cards).toBe(1);
    expect(out.find((s) => s.status === 'done')?.cards).toBe(0);
  });

  it('is empty when the board has every status, and needs no cards or boards', () => {
    const all = board([...names].map(([status, name]) => ({ status, name })));
    expect(missingBoardStatuses(all, names, { items })).toEqual([]);
    expect(missingBoardStatuses(board([]), new Map([['a', 'A']]))).toEqual([
      { status: 'a', name: 'A', cards: 0, boards: [] },
    ]);
  });

  it('stays linear on a large document', () => {
    const many = new Map(
      Array.from({ length: 200 }, (_, i) => [`s${i}`, `Status ${i}`] as [string, string]),
    );
    const cards = Array.from({ length: 20_000 }, (_, i) => item({ status: `s${i % 200}` }));
    const big = Array.from({ length: 50 }, (_, i) => ({
      title: `B${i}`,
      statuses: Array.from({ length: 12 }, (_, j) => `s${(i * 4 + j) % 200}`),
    }));
    const t0 = performance.now();
    const out = missingBoardStatuses(board([]), many, { items: cards, boards: big });
    const ms = performance.now() - t0;
    expect(out).toHaveLength(200);
    expect(out[0]!.cards).toBe(100);
    expect(ms).toBeLessThan(250);
  });
});
