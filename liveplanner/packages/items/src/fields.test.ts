import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  fieldsByteSize,
  fieldsWithinBounds,
  isValidItemId,
  isValidItemType,
  validateClear,
  validateFields,
  validateVotes,
} from './fields';
import {
  ITEM_CHECKLIST_MAX,
  ITEM_DESCRIPTION_MAX,
  ITEM_FIELDS_BYTES,
  ITEM_FIELDS_MAX,
  ITEM_LONG_TEXT_MAX,
  ITEM_TITLE_MAX,
  ITEM_UNKNOWN_STRING_MAX,
} from './limits';

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
      [{ title: 'x'.repeat(ITEM_TITLE_MAX + 1) }, 'title_too_long'],
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
      [{ votes: {} }, 'votes_read_only'],
      [{ 'bad key': 1 }, 'field_key_invalid'],
      [{ custom: { nested: 1 } }, 'field_value_invalid'],
      [{ custom: 'x'.repeat(ITEM_LONG_TEXT_MAX + 1) }, 'field_value_invalid'],
      [{ custom: ['x'.repeat(ITEM_UNKNOWN_STRING_MAX + 1)] }, 'field_value_invalid'],
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
      Array.from({ length: 7 }, (_, i) => [`k${i}`, 'x'.repeat(ITEM_LONG_TEXT_MAX)]),
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

describe('validateVotes', () => {
  it('accepts whole counts per person and refuses the rest', () => {
    expect(validateVotes(undefined)).toEqual({});
    expect(validateVotes({ a: 2 })).toEqual({ a: 2 });
    for (const bad of [null, [], { a: 0 }, { a: 1.5 }, { a: 100 }, { '': 1 }, 'x'])
      expect(validateVotes(bad)).toBeNull();
    expect(
      validateVotes(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`p${i}`, 1]))),
    ).toBeNull();
  });
});

// docs/specs/026-plan/items.md "Handing a card to an AI assistant": the Assignee may hold one, checked whole.
describe('validateFields, an AI assistant Assignee', () => {
  const THOMAS = { id: 'a1b2c3d4e5f6a1b2c3d4e5f6', name: 'Thomas', color: '#2563eb' };
  const CLAUDE = {
    id: `ai-${THOMAS.id}-claude`,
    name: 'Claude (Thomas)',
    color: '#2563eb',
    assistant: { client: 'Claude', person: THOMAS },
  };

  it('keeps one whole, on a create and a patch', () => {
    expect(validateFields({ title: 'Fix', assignee: CLAUDE }, 'create')).toEqual({
      ok: true,
      fields: { title: 'Fix', assignee: CLAUDE },
    });
    expect(validateFields({ assignee: CLAUDE }, 'patch')).toEqual({
      ok: true,
      fields: { assignee: CLAUDE },
    });
  });

  it('reads a person’s Assignee as before, dropping an assistant it was given', () => {
    const given = { ...THOMAS, assistant: CLAUDE.assistant };
    expect(validateFields({ assignee: given }, 'patch')).toEqual({
      ok: true,
      fields: { assignee: THOMAS },
    });
  });

  it('refuses one that does not read as an assistant', () => {
    const forged = { ...CLAUDE, id: `ai-${THOMAS.id}-cursor` };
    expect(validateFields({ assignee: forged }, 'patch')).toEqual({
      ok: false,
      error: 'field_value_invalid',
      field: 'assignee',
    });
    const bare = { id: CLAUDE.id, name: CLAUDE.name, color: CLAUDE.color };
    expect(validateFields({ assignee: bare }, 'patch')).toMatchObject({ ok: false });
  });

  it('refuses one in a Person field, alone or among several', () => {
    expect(validateFields({ 'f-owner': CLAUDE }, 'patch')).toMatchObject({
      ok: false,
      error: 'field_value_invalid',
    });
    expect(validateFields({ 'f-owners': [THOMAS, CLAUDE] }, 'patch')).toMatchObject({
      ok: false,
      error: 'field_value_invalid',
    });
    expect(validateFields({ 'f-owners': [THOMAS] }, 'patch')).toEqual({
      ok: true,
      fields: { 'f-owners': [THOMAS] },
    });
  });
});

// docs/specs/026-plan/items.md "Limits": a refused value names its field and the limit it broke (Work Tracker 944).
describe('a refusal names the field and the limit', () => {
  const refusal = (input: Record<string, unknown>) => validateFields(input, 'patch');

  it('gives a custom Long Text the Description’s 10,000 characters', () => {
    expect(refusal({ 'f-solution': 's'.repeat(9000) })).toEqual({
      ok: true,
      fields: { 'f-solution': 's'.repeat(9000) },
    });
    expect(refusal({ 'f-solution': 's'.repeat(ITEM_LONG_TEXT_MAX + 1) })).toEqual({
      ok: false,
      error: 'field_value_invalid',
      field: 'f-solution',
      limit: { unit: 'characters', max: 10_000, given: 10_001 },
    });
  });

  it('names the title, the description and a status past their length', () => {
    expect(refusal({ title: 't'.repeat(ITEM_TITLE_MAX + 2) })).toMatchObject({
      error: 'title_too_long',
      field: 'title',
      limit: { unit: 'characters', max: ITEM_TITLE_MAX, given: ITEM_TITLE_MAX + 2 },
    });
    expect(refusal({ description: 'd'.repeat(ITEM_DESCRIPTION_MAX + 1) })).toMatchObject({
      field: 'description',
      limit: { unit: 'characters', max: ITEM_DESCRIPTION_MAX },
    });
    expect(refusal({ status: 's'.repeat(41) })).toMatchObject({
      field: 'status',
      limit: { unit: 'characters', max: 40, given: 41 },
    });
  });

  it('names the checklist row too long, or the rows too many, built-in or custom', () => {
    const rows = (n: number, long?: number) =>
      Array.from({ length: n }, (_, i) => ({
        text: i === long ? 'r'.repeat(230) : 'ok',
        done: false,
      }));
    for (const key of ['checklist', 'f-acceptance']) {
      expect(refusal({ [key]: rows(7, 2) })).toMatchObject({
        field: key,
        limit: { unit: 'characters', max: 200, given: 230, row: 3, entry: 'row' },
      });
      expect(refusal({ [key]: rows(ITEM_CHECKLIST_MAX + 1) })).toMatchObject({
        field: key,
        limit: { unit: 'rows', max: 50, given: 51 },
      });
    }
  });

  it('names labels, a list’s values and its people past their counts', () => {
    expect(refusal({ labels: ['a', 'l'.repeat(33)] })).toMatchObject({
      limit: { unit: 'characters', max: 32, given: 33, row: 2, entry: 'label' },
    });
    expect(refusal({ labels: Array.from({ length: 13 }, (_, i) => `l${i}`) })).toMatchObject({
      limit: { unit: 'labels', max: 12, given: 13 },
    });
    expect(refusal({ custom: Array.from({ length: 51 }, () => 'v') })).toMatchObject({
      limit: { unit: 'values', max: 50, given: 51 },
    });
    expect(refusal({ custom: ['v', 'v'.repeat(ITEM_UNKNOWN_STRING_MAX + 1)] })).toMatchObject({
      limit: { unit: 'characters', row: 2, entry: 'value' },
    });
    const person = { id: 'p1', name: 'P', color: '#112233' };
    expect(refusal({ people: Array.from({ length: 21 }, () => person) })).toMatchObject({
      limit: { unit: 'values', max: 20, given: 21 },
    });
  });

  it('gives no limit to a value of the wrong shape', () => {
    for (const input of [
      { title: 3 },
      { description: 4 },
      { status: 5 },
      { labels: 'a' },
      { checklist: 'a' },
      { checklist: [{ text: 'a' }] },
      { custom: { nested: 1 } },
      { custom: [1, { a: 1 }] },
      { custom: [{ id: 'p1', name: 'P', color: 'red' }] },
      { descriptionRich: 'plain' },
      { estimate: 1000 },
    ]) {
      const r = refusal(input);
      expect(r.ok).toBe(false);
      expect(r).not.toHaveProperty('limit');
    }
  });

  it('fits a formatted 9,000-character Long Text beside a full formatted description', () => {
    const marked = (n: number) =>
      Array.from({ length: n / 100 }, (_, i) => ({
        text: 'w'.repeat(100),
        ...(i % 2 ? { bold: true } : {}),
      }));
    const fields = {
      title: 't'.repeat(ITEM_TITLE_MAX),
      description: 'd'.repeat(ITEM_DESCRIPTION_MAX),
      descriptionRich: marked(ITEM_DESCRIPTION_MAX),
      'f-solution': 's'.repeat(9000),
      'f-solutionRich': marked(9000),
      checklist: Array.from({ length: ITEM_CHECKLIST_MAX }, () => ({
        text: 'c'.repeat(200),
        done: false,
      })),
    };
    const checked = validateFields(fields, 'create');
    expect(checked.ok).toBe(true);
    const bytes = fieldsByteSize(checked.ok ? checked.fields : {});
    expect(bytes).toBeLessThan(ITEM_FIELDS_BYTES);
    expect(fieldsWithinBounds(checked.ok ? checked.fields : {})).toBeNull();
    // Every write validates and measures its card's fields: linear in them. Measured 30 ms for 200 (0.15 ms a write of
    // this 53 KB card, beside a refused 10,001-character value).
    let refused = 0;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 200; i++) {
        const r = validateFields(fields, 'create');
        if (r.ok) fieldsByteSize(r.fields);
        if (!validateFields({ 'f-x': 'x'.repeat(ITEM_LONG_TEXT_MAX + 1) }, 'patch').ok)
          refused += 1;
      }
    });
    expect(refused).toBe(200);
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
