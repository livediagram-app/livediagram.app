import { describe, expect, it } from 'vitest';
import { makeItem } from './apply';
import { CARD_SIZE_FIELDS, DEFAULT_CARD_FIELDS } from './board';
import {
  commentsByteSize,
  fieldsByteSize,
  fieldsWithinBounds,
  validateClear,
  validateFields,
} from './fields';
import { itemCommentCount } from './item';
import { FALLBACK_ITEM_TYPE, ITEM_TYPES } from './item-types';
import { ITEM_FIELDS_BYTES } from './limits';
import { itemAsCreate } from './store';
import { BUILT_IN_FIELD_IDS, tabsOf } from './type-catalogue';
import { SAM, item } from './test-items';

// docs/specs/026-plan/items.md "Comments": the comments field as the item store sees it.
const thread = (n: number, resolved = false) => ({
  comments: Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    text: 'hello',
    createdAt: i,
    authorName: 'Sam',
    authorColor: '#2563eb',
  })),
  resolved,
});

describe('the comments field', () => {
  it('is offered by every built-in type, last, and ends the Overview tab', () => {
    for (const t of [...ITEM_TYPES, FALLBACK_ITEM_TYPE]) {
      expect(t.fields[t.fields.length - 1]).toBe('comments');
      expect(tabsOf(t)[0]!.fields.at(-1)).toBe('comments');
    }
    expect(BUILT_IN_FIELD_IDS).toContain('comments');
  });

  it('is written only by the comment writes: a create or patch carrying it is refused', () => {
    expect(validateFields({ title: 'A', comments: thread(1) }, 'create')).toMatchObject({
      ok: false,
      error: 'comments_read_only',
      field: 'comments',
    });
    expect(validateFields({ comments: thread(1) }, 'patch')).toMatchObject({
      ok: false,
      error: 'comments_read_only',
    });
    expect(validateClear(['comments'])).toEqual({ ok: false, error: 'comments_read_only' });
  });

  it('has its own size budget, outside the fields budget', () => {
    const big = thread(150);
    const fields = { title: 'A', comments: big };
    expect(fieldsByteSize(fields)).toBe(fieldsByteSize({ title: 'A' }));
    expect(commentsByteSize(fields)).toBeGreaterThan(ITEM_FIELDS_BYTES / 2);
    expect(commentsByteSize({ title: 'A' })).toBe(0);
    expect(fieldsWithinBounds(fields)).toBeNull();
  });

  it('counts the comments of an open thread only', () => {
    expect(itemCommentCount(item({ title: 'A', comments: thread(3) }))).toBe(3);
    expect(itemCommentCount(item({ title: 'A', comments: thread(3, true) }))).toBe(0);
    expect(itemCommentCount(item({ title: 'A' }))).toBe(0);
    expect(itemCommentCount(item({ title: 'A', comments: 'junk' }))).toBe(0);
    expect(itemCommentCount(item({ title: 'A', comments: { resolved: false } }))).toBe(0);
  });

  it('travels with a restore: out of the fields into the create, and back', () => {
    const before = item({ title: 'A', comments: thread(2) });
    const create = itemAsCreate(before);
    expect(create.fields['comments']).toBeUndefined();
    expect(create.comments).toEqual(thread(2));
    const made = makeItem(create, { id: before.id, key: 1, now: 0, by: SAM, items: [] });
    expect(made.fields['comments']).toEqual(thread(2));
    expect(itemAsCreate(item({ title: 'B' })).comments).toBeUndefined();
  });

  it('is a card field: on new boards, on Compact and Detailed cards', () => {
    expect(DEFAULT_CARD_FIELDS).toContain('comments');
    expect(CARD_SIZE_FIELDS.compact).toContain('comments');
    expect(CARD_SIZE_FIELDS.detailed).toContain('comments');
    expect(CARD_SIZE_FIELDS.minimal).not.toContain('comments');
  });
});
