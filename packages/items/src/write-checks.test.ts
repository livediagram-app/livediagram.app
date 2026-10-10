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

// The api's write checks, shared with an offline document (blueprint item-store.md "Interfaces and contracts").

const types = [{ ...ITEM_TYPES[0]!, id: 'task', excludedStatuses: ['done'] }];

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
    const move = { kind: 'move' as const, id: was.id, move: { status: 'done' } };
    expect(writtenItemsRefusal(move, [was], [next], types)).toEqual({
      error: 'status_excluded',
      id: was.id,
    });
    expect(writtenItemsRefusal({ ...move, undo: true }, [was], [next], types)).toBeNull();
    expect(writtenItemsRefusal({ kind: 'delete', id: was.id }, [was], [], types)).toBeNull();
    const huge = { ...was, fields: { ...was.fields, description: 'x'.repeat(70_000) } };
    expect(
      writtenItemsRefusal({ kind: 'patch', id: was.id, patch: {} }, [was], [huge], types)?.error,
    ).toBe('fields_too_large');
  });
});
