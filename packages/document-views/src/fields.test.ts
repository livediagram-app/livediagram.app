import { describe, expect, it } from 'vitest';
import {
  arrayField,
  boxOf,
  flagField,
  numberField,
  objectField,
  stringField,
  textField,
  threadOf,
} from './fields';

describe('field readers', () => {
  const source = {
    s: 'x',
    blank: '  ',
    n: 3,
    nan: Number.NaN,
    a: [1],
    t: true,
    o: { k: 1 },
    list: [],
  };

  it('read each field only when it has its type', () => {
    expect(stringField(source, 's')).toBe('x');
    expect(stringField(source, 'n')).toBeNull();
    expect(textField(source, 's')).toBe('x');
    expect(textField(source, 'blank')).toBeNull();
    expect(textField(source, 'missing')).toBeNull();
    expect(numberField(source, 'n')).toBe(3);
    expect(numberField(source, 'nan')).toBeNull();
    expect(arrayField(source, 'a')).toEqual([1]);
    expect(arrayField(source, 's')).toEqual([]);
    expect(flagField(source, 't')).toBe(true);
    expect(flagField(source, 's')).toBe(false);
    expect(objectField(source, 'o')).toEqual({ k: 1 });
    expect(objectField(source, 'list')).toBeNull();
    expect(objectField(source, 's')).toBeNull();
  });

  it('read a box only when all four numbers are there', () => {
    expect(boxOf({ x: 1, y: 2, width: 3, height: 4 })).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(boxOf({ x: 1, y: 2, width: 3 })).toBeNull();
    expect(boxOf({ x: 1, y: 2, height: 4 })).toBeNull();
    expect(boxOf({ x: 1, width: 3, height: 4 })).toBeNull();
    expect(boxOf({ y: 1, width: 3, height: 4 })).toBeNull();
  });

  it('read a thread only when it has a comment (E21)', () => {
    const comment = { text: 'hi' };
    expect(threadOf({ commentThread: { comments: [comment], resolved: true } })).toEqual({
      comments: [comment],
      resolved: true,
    });
    expect(threadOf({ commentThread: { comments: [], resolved: false } })).toBeNull();
    expect(threadOf({ commentThread: { comments: [null], resolved: false } })).toBeNull();
    expect(threadOf({})).toBeNull();
  });
});
