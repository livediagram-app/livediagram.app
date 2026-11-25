import { describe, expect, it } from 'vitest';
import { FIELD_VALUES_MAX } from './limits';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import type { Item } from './item';
import { madeBlocksField, planMake, withBlocksField, type PlanMakeCardInput } from './plan-make';
import { PLAN_TYPES } from './test-plan-types';
import { item } from './test-items';

// livediagram's make-plan-cards.md "What becomes what" and "Making again": new cards land in their lane's column, an
// updated one keeps its column; arrows become Blocked By, never closing a loop; a board type gains a Blocked By field
// only when a made card needs one.

const COLUMNS = [
  { status: 'todo', name: 'To Do' },
  { status: 'doing', name: 'In Progress' },
  { status: 'done', name: 'Done' },
];
const map = (items: Item[]) => new Map(items.map((i) => [i.id, i]));
const shape = (element: string, over: Partial<PlanMakeCardInput> = {}): PlanMakeCardInput => ({
  element,
  id: `new-${element}`,
  made: true,
  title: `Card ${element}`,
  description: `words of ${element}`,
  ...over,
});
const make = (
  cards: PlanMakeCardInput[],
  items: Item[] = [],
  types = PLAN_TYPES,
  column = 'To Do',
) => planMake({ items: map(items), types, columns: COLUMNS, column, type: 'task', cards });

describe('planMake', () => {
  it('makes cards in their lane’s column, else the one picked, with dates, labels and links', () => {
    const out = make([
      shape('e1', {
        column: 'in progress',
        start: '2026-12-01',
        due: '2026-12-05',
        labels: ['Design'],
      }),
      shape('e2', { column: 'Nowhere', blockedBy: ['e1'] }),
    ]);
    expect(out.type).toBeNull();
    expect(out.skipped).toBe(0);
    expect(out.cards[0]).toEqual({
      element: 'e1',
      id: 'new-e1',
      made: true,
      status: 'doing',
      fields: {
        title: 'Card e1',
        description: 'words of e1',
        start: '2026-12-01',
        due: '2026-12-05',
        labels: ['Design'],
      },
    });
    expect(out.cards[1]).toMatchObject({ status: 'todo', fields: { 'f-blocked-by': ['new-e1'] } });
  });

  it('updates a live card in place: its column stays, its labels and links grow', () => {
    const was = item({ title: 'Old', status: 'doing', labels: ['Keep'], 'f-blocked-by': ['x'] });
    const other = item({ title: 'Other', status: 'todo' });
    const out = make(
      [
        shape('e1', {
          id: was.id,
          made: false,
          title: 'New title',
          labels: ['keep', 'Add'],
          blockedBy: ['e2'],
        }),
        shape('e2', { id: other.id, made: false }),
      ],
      [was, other],
    );
    expect(out.cards[0]).toEqual({
      element: 'e1',
      id: was.id,
      made: false,
      fields: {
        title: 'New title',
        status: 'doing',
        labels: ['Keep', 'Add'],
        'f-blocked-by': ['x', other.id],
      },
    });
    expect(out.cards[0]!.fields['description']).toBeUndefined();
  });

  it('leaves out a link that would close a loop, across the plan too, and counts it', () => {
    const a = item({ title: 'A', status: 'todo' });
    const b = item({ title: 'B', status: 'todo', 'f-blocked-by': [a.id] });
    const out = make(
      [
        shape('ea', { id: a.id, made: false, blockedBy: ['eb'] }),
        shape('eb', { id: b.id, made: false }),
        shape('e1', { blockedBy: ['e2'] }),
        shape('e2', { blockedBy: ['e1'] }),
      ],
      [a, b],
    );
    expect(out.skipped).toBe(2);
    expect(out.cards[0]!.fields['f-blocked-by']).toBeUndefined();
    expect(out.cards[2]!.fields['f-blocked-by']).toEqual(['new-e2']);
    expect(out.cards[3]!.fields['f-blocked-by']).toBeUndefined();
  });

  it('holds a card to FIELD_VALUES_MAX blockers', () => {
    const many = Array.from({ length: FIELD_VALUES_MAX + 3 }, (_, i) => shape(`b${i}`));
    const out = make([...many, shape('w', { blockedBy: many.map((m) => m.element) })]);
    expect((out.cards.at(-1)!.fields['f-blocked-by'] as string[]).length).toBe(FIELD_VALUES_MAX);
    expect(out.skipped).toBe(3);
  });

  it('grows the board type a Blocked By field only when a made card waits on another', () => {
    const plain = ITEM_TYPES as readonly ItemTypeDef[];
    const linked = make([shape('e1'), shape('e2', { blockedBy: ['e1'] })], [], plain);
    expect(linked.type?.custom?.some((c) => c.blocks)).toBe(true);
    expect(linked.cards[1]!.fields[linked.type!.custom!.find((c) => c.blocks)!.id]).toEqual([
      'new-e1',
    ]);
    expect(make([shape('e1'), shape('e2')], [], plain).type).toBeNull();
    // An updated card's own type with no such field: its links are left out, counted.
    const note = item({ title: 'N', status: 'todo' }, { type: 'note' });
    const out = make(
      [
        shape('e1', { id: note.id, made: false, blockedBy: ['e2'] }),
        shape('e2', { id: 'x', made: false }),
      ],
      [note],
      plain,
    );
    expect(out.type).toBeNull();
    expect(out.skipped).toBe(1);
  });

  it('links only one blocker on a Blocked By field stored holding one, counting the rest left out', () => {
    // A field saved before Holds Several reads only its first card: a second written beside it would show nowhere.
    const single = PLAN_TYPES.map((t) =>
      t.id === 'task'
        ? { ...t, custom: t.custom!.map((f) => (f.blocks ? { ...f, multiple: false } : f)) }
        : t,
    );
    const out = make(
      [shape('e1'), shape('e2'), shape('e3', { blockedBy: ['e1', 'e2'] })],
      [],
      single,
    );
    expect(out.cards[2]!.fields['f-blocked-by']).toEqual(['new-e1']);
    expect(out.skipped).toBe(1);
  });

  it('falls back to the first column when the picked one is gone', () => {
    expect(make([shape('e1')], [], PLAN_TYPES, 'Gone').cards[0]!.status).toBe('todo');
  });
});

describe('withBlocksField', () => {
  it('adds a Blocked By field under a free id, and leaves a type that has one', () => {
    const base = ITEM_TYPES.find((t) => t.id === 'task')!;
    const taken: ItemTypeDef = {
      ...base,
      custom: [...(base.custom ?? []), { id: 'f-blocked-by', label: 'Other', kind: 'text' }],
    };
    const grown = withBlocksField(taken);
    expect(grown.custom!.at(-1)).toEqual({ ...madeBlocksField('task'), id: 'f-blocked-by-2' });
    expect(grown.fields.at(-1)).toBe('f-blocked-by-2');
    expect(withBlocksField(grown)).toBe(grown);
  });
});
