import { describe, expect, it } from 'vitest';
import {
  COMMENTS_FIELD,
  commentsFieldsOf,
  storedThreadField,
  threadFieldOn,
  threadsInField,
  votesFieldsOf,
} from './comments-votes-fields';
import type { ItemTypeDef } from './item-types';
import { tabsOf } from './type-catalogue';

// docs/specs/026-plan/item-types.md "Comments and Votes fields": a type's Comments and Votes fields, and the Comments
// field each thread shows under.
const type: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#71717a',
  fields: [
    'title',
    'f-review',
    'description',
    'votes',
    'comments',
    'f-qa',
    'f-priority',
    'f-notes',
  ],
  custom: [
    { id: 'f-review', label: 'Design Review', kind: 'comments' },
    { id: 'f-qa', label: 'QA Notes', kind: 'comments' },
    { id: 'f-priority', label: 'Priority Vote', kind: 'votes' },
    { id: 'f-notes', label: 'Notes', kind: 'text' },
    // Defined but not offered: never one of the type's fields.
    { id: 'f-old', label: 'Old Thread', kind: 'comments' },
  ],
};
const ownOnly: ItemTypeDef = { ...type, fields: ['title', 'f-qa', 'f-review'] };
const none: ItemTypeDef = { ...type, fields: ['title'], custom: undefined };

describe('a type’s Comments and Votes fields', () => {
  it('lists the built-in and its own of each kind, in the type’s order', () => {
    expect(commentsFieldsOf(type)).toEqual(['f-review', 'comments', 'f-qa']);
    expect(votesFieldsOf(type)).toEqual(['votes', 'f-priority']);
    expect(commentsFieldsOf(none)).toEqual([]);
    expect(votesFieldsOf(none)).toEqual([]);
    expect(COMMENTS_FIELD).toBe('comments');
  });

  it('ends the Overview tab with every Comments field, in the type’s order', () => {
    expect(tabsOf(type)[0]!.fields).toEqual(['description', 'f-review', 'comments', 'f-qa']);
  });
});

describe('the Comments field a thread shows under', () => {
  it('is its own while the type offers it, the built-in when it names none', () => {
    expect(threadFieldOn({ field: 'f-qa' }, type)).toBe('f-qa');
    expect(threadFieldOn({}, type)).toBe('comments');
    expect(threadFieldOn({ field: undefined }, type)).toBe('comments');
  });

  it('is the built-in when its field is gone, else the type’s first, else none', () => {
    expect(threadFieldOn({ field: 'f-old' }, type)).toBe('comments');
    expect(threadFieldOn({ field: 'f-gone' }, ownOnly)).toBe('f-qa');
    expect(threadFieldOn({}, ownOnly)).toBe('f-qa');
    expect(threadFieldOn({ field: 'f-review' }, none)).toBeNull();
  });

  it('files each thread under one field, so none is hidden', () => {
    const threads = [{ id: 'a' }, { id: 'b', field: 'f-qa' }, { id: 'c', field: 'f-gone' }];
    expect(threadsInField(threads, type, 'comments').map((t) => t.id)).toEqual(['a', 'c']);
    expect(threadsInField(threads, type, 'f-qa').map((t) => t.id)).toEqual(['b']);
    expect(threadsInField(threads, type, 'f-review')).toEqual([]);
    expect(threadsInField(threads, none, 'comments')).toEqual([]);
  });
});

describe('a new thread’s stored field', () => {
  it('is left out for the built-in, kept for any other', () => {
    expect(storedThreadField(undefined)).toEqual({});
    expect(storedThreadField('')).toEqual({});
    expect(storedThreadField('comments')).toEqual({});
    expect(storedThreadField('f-qa')).toEqual({ field: 'f-qa' });
  });
});
