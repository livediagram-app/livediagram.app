import { describe, expect, it } from 'vitest';
import {
  brokenLimitOf,
  fieldLimitWords,
  readFieldLimit,
  textMaxOfKind,
  type FieldLimit,
} from './field-limits';
import { ITEM_LONG_TEXT_MAX, ITEM_UNKNOWN_STRING_MAX } from './limits';

// docs/specs/026-plan/items.md "Limits": a refused value's limit, worked out and worded (Work Tracker 944).
describe('field limits', () => {
  it('words each limit for the field as the card shows it', () => {
    const words = (limit: FieldLimit) => fieldLimitWords('Solution', limit);
    expect(words({ unit: 'characters', max: 10_000, given: 12_412 })).toBe(
      'Solution is 12,412 characters; the most is 10,000.',
    );
    expect(words({ unit: 'characters', max: 200, given: 230, row: 3, entry: 'row' })).toBe(
      'Solution row 3 is 230 characters; the most is 200 a row.',
    );
    expect(words({ unit: 'characters', max: 32, given: 40, row: 2, entry: 'label' })).toBe(
      'Solution label 2 is 40 characters; the most is 32 a label.',
    );
    expect(words({ unit: 'characters', max: 9, given: 10, row: 1 })).toBe(
      'Solution row 1 is 10 characters; the most is 9 a row.',
    );
    expect(words({ unit: 'rows', max: 50, given: 51 })).toBe(
      'Solution has 51 rows; the most is 50.',
    );
    expect(words({ unit: 'labels', max: 12, given: 13 })).toBe(
      'Solution has 13 labels; the most is 12.',
    );
  });

  it('reads the formatting runs’ text against their field’s limit', () => {
    expect(brokenLimitOf('rich', [{ text: 'ab' }, { text: 'cd' }, { bold: true }], 3)).toEqual({
      unit: 'characters',
      max: 3,
      given: 4,
    });
    expect(brokenLimitOf('rich', [{ text: 'ab' }], 3)).toBeUndefined();
    expect(brokenLimitOf('rich', 'ab', 1)).toBeUndefined();
    expect(brokenLimitOf('rich', [{ text: 'x'.repeat(10_001) }])).toMatchObject({ max: 10_000 });
  });

  it('finds no limit on a value of the wrong shape', () => {
    expect(brokenLimitOf('title', 3)).toBeUndefined();
    expect(brokenLimitOf('long-text', 3)).toBeUndefined();
    expect(brokenLimitOf('status', 3)).toBeUndefined();
    expect(brokenLimitOf('labels', 'a')).toBeUndefined();
    expect(brokenLimitOf('labels', ['ok', 4])).toBeUndefined();
    expect(brokenLimitOf('checklist', 'a')).toBeUndefined();
    expect(brokenLimitOf(undefined, 4)).toBeUndefined();
    expect(brokenLimitOf(undefined, [])).toBeUndefined();
    expect(brokenLimitOf(undefined, [{ id: 'p1' }])).toBeUndefined();
    expect(brokenLimitOf(undefined, ['short', 1])).toBeUndefined();
  });

  it('holds a Long Text to the Description’s limit and every other text to the short one', () => {
    expect(textMaxOfKind('longtext')).toBe(ITEM_LONG_TEXT_MAX);
    expect(textMaxOfKind('text')).toBe(ITEM_UNKNOWN_STRING_MAX);
    expect(textMaxOfKind('email')).toBe(ITEM_UNKNOWN_STRING_MAX);
  });

  it('reads a limit from a refusal’s body, and nothing else', () => {
    expect(readFieldLimit({ unit: 'rows', max: 50, given: 51 })).toEqual({
      unit: 'rows',
      max: 50,
      given: 51,
    });
    expect(
      readFieldLimit({ unit: 'characters', max: 200, given: 230, row: 3, entry: 'row', x: 1 }),
    ).toEqual({ unit: 'characters', max: 200, given: 230, row: 3, entry: 'row' });
    expect(readFieldLimit({ unit: 'values', max: 50, given: 51, row: '3', entry: 'cell' })).toEqual(
      {
        unit: 'values',
        max: 50,
        given: 51,
      },
    );
    expect(readFieldLimit({ unit: 'labels', max: 12, given: 13 })?.unit).toBe('labels');
    expect(readFieldLimit({ unit: 'characters', max: 1, given: 2, entry: 'label' })?.entry).toBe(
      'label',
    );
    expect(readFieldLimit({ unit: 'characters', max: 1, given: 2, entry: 'value' })?.entry).toBe(
      'value',
    );
    for (const raw of [
      undefined,
      null,
      'rows',
      [],
      { unit: 'bytes', max: 1, given: 2 },
      { unit: 'rows', max: '1', given: 2 },
      { unit: 'rows', max: 1 },
    ])
      expect(readFieldLimit(raw)).toBeUndefined();
  });
});
