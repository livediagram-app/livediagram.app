import { describe, expect, it } from 'vitest';
import {
  fieldsWithinBounds,
  isValidItemId,
  isValidItemType,
  validateClear,
  validateFields,
} from './fields';
import { ITEM_FIELDS_MAX } from './limits';

describe('validateFields', () => {
  it('requires a title on create, trims it', () => {
    expect(validateFields({}, 'create')).toEqual({
      ok: false,
      error: 'title_required',
      field: 'title',
    });
    expect(validateFields({ title: '  ' }, 'create')).toMatchObject({
      ok: false,
      error: 'title_required',
    });
    expect(validateFields({ title: ' Fix ' }, 'create')).toEqual({
      ok: true,
      fields: { title: 'Fix' },
    });
    expect(validateFields({}, 'patch')).toEqual({ ok: true, fields: {} });
  });

  it('rejects each bad kind with a named rejection', () => {
    const bad: [Record<string, unknown>, string][] = [
      [{ title: 'x'.repeat(201) }, 'title_too_long'],
      [{ title: 3 }, 'field_value_invalid'],
      [{ description: 4 }, 'field_value_invalid'],
      [{ status: '' }, 'field_value_invalid'],
      [{ assignee: { id: 'a', name: 'A', color: 'red' } }, 'field_value_invalid'],
      [{ assignee: 'Sam' }, 'field_value_invalid'],
      [{ priority: 'critical' }, 'field_value_invalid'],
      [{ labels: ['a', 2] }, 'field_value_invalid'],
      [{ labels: Array.from({ length: 13 }, (_, i) => `l${i}`) }, 'field_value_invalid'],
      [{ estimate: -1 }, 'field_value_invalid'],
      [{ estimate: 1000 }, 'field_value_invalid'],
      [{ due: '2026-02-30' }, 'field_value_invalid'],
      [{ due: 'tomorrow' }, 'field_value_invalid'],
      [{ checklist: [{ text: 'a' }] }, 'field_value_invalid'],
      [{ checklist: 'a' }, 'field_value_invalid'],
      [{ parent: 'x' }, 'field_value_invalid'],
      [{ votes: {} }, 'votes_read_only'],
      [{ 'bad key': 1 }, 'field_key_invalid'],
      [{ custom: { nested: 1 } }, 'field_value_invalid'],
      [{ custom: 'x'.repeat(2001) }, 'field_value_invalid'],
    ];
    for (const [input, error] of bad)
      expect(validateFields(input, 'patch')).toMatchObject({ ok: false, error });
  });

  it('normalises good values', () => {
    const r = validateFields(
      {
        title: 'T',
        assignee: { id: 'p1', name: ' Sam ', color: '#AABBCC', extra: 1 },
        labels: [' ux ', 'ux', 'api'],
        due: '2026-10-05',
        checklist: [{ text: 'a', done: false, x: 1 }],
        estimate: 3,
        priority: 'high',
        parent: 'abcdef12',
        status: ' todo ',
        custom: ['a', 1, true, null],
        flag: false,
      },
      'create',
    );
    expect(r).toEqual({
      ok: true,
      fields: {
        title: 'T',
        assignee: { id: 'p1', name: 'Sam', color: '#AABBCC' },
        labels: ['ux', 'api'],
        due: '2026-10-05',
        checklist: [{ text: 'a', done: false }],
        estimate: 3,
        priority: 'high',
        parent: 'abcdef12',
        status: 'todo',
        custom: ['a', 1, true, null],
        flag: false,
      },
    });
  });

  it('caps the number of keys and the size', () => {
    const many = Object.fromEntries(
      Array.from({ length: ITEM_FIELDS_MAX + 1 }, (_, i) => [`k${i}`, 1]),
    );
    expect(validateFields(many, 'patch')).toMatchObject({ error: 'fields_too_many' });
    expect(validateFields('x', 'patch')).toMatchObject({ error: 'field_value_invalid' });
    expect(fieldsWithinBounds(many)).toBe('fields_too_many');
    const big = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`k${i}`, 'x'.repeat(2000)]),
    );
    expect(fieldsWithinBounds(big)).toBe('fields_too_large');
    expect(fieldsWithinBounds({ title: 'ok' })).toBeNull();
  });

  it('validates clears, ids and types', () => {
    expect(validateClear(undefined)).toEqual({ ok: true, keys: [] });
    expect(validateClear(['due'])).toEqual({ ok: true, keys: ['due'] });
    expect(validateClear(['title'])).toEqual({ ok: false, error: 'title_required' });
    expect(validateClear(['votes'])).toEqual({ ok: false, error: 'votes_read_only' });
    expect(validateClear([' x'])).toEqual({ ok: false, error: 'field_key_invalid' });
    expect(validateClear('due')).toEqual({ ok: false, error: 'field_key_invalid' });
    expect(isValidItemId('abcdef')).toBe(true);
    expect(isValidItemId('abc')).toBe(false);
    expect(isValidItemType('bug')).toBe(true);
    expect(isValidItemType('Bug')).toBe(false);
  });
});
