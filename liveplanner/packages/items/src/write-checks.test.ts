import { describe, expect, it } from 'vitest';
import { item } from './test-items';
import { ITEM_TYPES } from './item-types';
import {
  readItemCreate,
  readItemMove,
  readItemPlace,
  readItemWrite,
  statusExcluded,
  writtenItemsRefusal,
} from './write-checks';

// The api's write checks, shared with an offline project (blueprint item-store.md "Interfaces and contracts").

const types = [{ ...ITEM_TYPES[0], id: 'task', excludedStatuses: ['done'] }];

describe('reading a write as the api does', () => {
  it('reads places, creates and moves, refusing by name', () => {
    expect(readItemPlace({ status: ' todo ', after: null })).toEqual({
      status: 'todo',
      after: null,
    });
    expect(readItemPlace('x')).toBe('place_invalid');
    expect(readItemPlace({ status: '' })).toBe('place_invalid');
    expect(readItemPlace({ before: 'bad id!' })).toBe('place_invalid');
    expect(readItemCreate({ type: 'task', fields: { title: ' A ' }, key: 3 })).toEqual({
      type: 'task',
      fields: { title: 'A' },
      place: {},
      key: 3,
    });
    expect(readItemCreate(null)).toBe('field_value_invalid');
    expect(readItemCreate({ type: '', fields: {} })).toBe('type_invalid');
    expect(readItemCreate({ type: 'task', id: '!', fields: {} })).toBe('id_invalid');
    expect(readItemCreate({ type: 'task', fields: { title: 'a' }, votes: 'x' })).toBe(
      'field_value_invalid',
    );
    expect(readItemMove({ status: 'done', clear: ['archived'] })).toEqual({
      status: 'done',
      clear: ['archived'],
    });
    expect(readItemMove({ set: { title: 'no' } })).toBe('place_invalid');
    expect(readItemMove({ type: 'bug', set: { priority: 'low' } })).toMatchObject({
      type: 'bug',
      set: { priority: 'low' },
    });
  });

  it('normalises each kind of write, or names the refused item', () => {
    expect(
      readItemWrite({
        kind: 'create',
        creates: [{ id: 'item-one', type: 'task', fields: { title: ' A ' }, comments: [] }],
      }),
    ).toMatchObject({ kind: 'create', creates: [{ fields: { title: 'A' }, comments: [] }] });
    expect(
      readItemWrite({ kind: 'create', creates: [{ id: 'item-one', type: 'task', fields: {} }] }),
    ).toEqual({ error: 'title_required', id: 'item-one' });
    expect(readItemWrite({ kind: 'patch', id: 'a', patch: { clear: ['title'] } })).toEqual({
      error: 'title_required',
      id: 'a',
    });
    expect(
      readItemWrite({ kind: 'patches', patches: [{ id: 'a', patch: { set: { title: ' B ' } } }] }),
    ).toEqual({ kind: 'patches', patches: [{ id: 'a', patch: { set: { title: 'B' } } }] });
    expect(readItemWrite({ kind: 'patches', patches: [{ id: 'a', patch: { type: '' } }] })).toEqual(
      { error: 'type_invalid', id: 'a' },
    );
    expect(readItemWrite({ kind: 'move', id: 'a', move: { set: { title: 'x' } } })).toEqual({
      error: 'place_invalid',
      id: 'a',
    });
    expect(readItemWrite({ kind: 'move', id: 'a', move: { status: 'done' } })).toMatchObject({
      move: { status: 'done' },
    });
    expect(readItemWrite({ kind: 'delete', id: 'a' })).toEqual({ kind: 'delete', id: 'a' });
    // Many moves: each read as one is, a refusal naming its card.
    expect(
      readItemWrite({
        kind: 'moves',
        moves: [{ id: 'a', move: { status: 'done', before: null } }],
      }),
    ).toMatchObject({ kind: 'moves', moves: [{ id: 'a', move: { status: 'done' } }] });
    expect(
      readItemWrite({ kind: 'moves', moves: [{ id: 'b', move: { set: { title: 'x' } } }] }),
    ).toEqual({ error: 'place_invalid', id: 'b' });
  });
});

describe('the items a write leaves', () => {
  it('refuses a status the type leaves out, but never an undo or a restore from the Trash', () => {
    const was = item({ title: 'A', status: 'todo' });
    const next = { ...was, fields: { ...was.fields, status: 'done' } };
    expect(statusExcluded(types, next, was, false)).toBe(true);
    expect(statusExcluded(types, next, was, true)).toBe(false);
    const trashed = item({ title: 'A', status: 'trash', trashedFrom: 'done' });
    expect(statusExcluded(types, { ...trashed, fields: { status: 'done' } }, trashed, false)).toBe(
      false,
    );
    // The Trash is a status no type lists, so moving a card there is never refused.
    const toTrash = { ...was, fields: { ...was.fields, status: 'trash', trashedFrom: 'todo' } };
    expect(statusExcluded(types, toTrash, was, false)).toBe(false);
    const move = { kind: 'move' as const, id: was.id, move: { status: 'done' } };
    expect(writtenItemsRefusal(move, [was], [next], types)).toEqual({
      error: 'status_excluded',
      id: was.id,
    });
    expect(writtenItemsRefusal({ ...move, undo: true }, [was], [next], types)).toBeNull();
    const moves = { kind: 'moves' as const, moves: [{ id: was.id, move: { status: 'done' } }] };
    expect(writtenItemsRefusal(moves, [was], [next], types)).toEqual({
      error: 'status_excluded',
      id: was.id,
    });
    expect(writtenItemsRefusal({ kind: 'delete', id: was.id }, [was], [], types)).toBeNull();
    const huge = { ...was, fields: { ...was.fields, description: 'x'.repeat(70_000) } };
    expect(
      writtenItemsRefusal({ kind: 'patch', id: was.id, patch: {} }, [was], [huge], types)?.error,
    ).toBe('fields_too_large');
  });
});

// docs/specs/026-plan/item-types.md "Blocked By": an offline plan refuses a loop as the api does.
describe('a Blocked By loop', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const blocking = [
    {
      ...task,
      fields: [...task.fields, 'f-blocked-by'],
      custom: [
        ...(task.custom ?? []),
        {
          id: 'f-blocked-by',
          label: 'Blocked By',
          kind: 'card' as const,
          linkType: 'task',
          multiple: true,
          blocks: true,
        },
      ],
    },
  ];
  it('refuses a patch or a create that closes one, naming the chain', () => {
    const a = item({ title: 'Website' });
    const b = item({ title: 'Launch', 'f-blocked-by': [a.id] });
    const closing = { ...a, fields: { ...a.fields, 'f-blocked-by': [b.id] } };
    const patch = { kind: 'patch' as const, id: a.id, patch: { set: { 'f-blocked-by': [b.id] } } };
    expect(writtenItemsRefusal(patch, [a, b], [closing], blocking)).toEqual({
      error: 'blocks_cycle',
      id: a.id,
      message: `#${b.key} Launch already waits on #${a.key} Website, so it can't block it.`,
    });
    // An undo is checked too.
    expect(writtenItemsRefusal({ ...patch, undo: true }, [a, b], [closing], blocking)?.error).toBe(
      'blocks_cycle',
    );
    const back = { ...item({ title: 'Back', 'f-blocked-by': [b.id] }), id: 'back01' };
    const waiting = { ...b, fields: { ...b.fields, 'f-blocked-by': ['back01'] } };
    expect(
      writtenItemsRefusal(
        { kind: 'create', creates: [{ id: 'back01', type: 'task', fields: back.fields, key: 9 }] },
        [waiting],
        [back],
        blocking,
      )?.error,
    ).toBe('blocks_cycle');
    // A write adding no link passes.
    expect(writtenItemsRefusal(patch, [a, b], [a], blocking)).toBeNull();
  });
});
