import { describe, expect, it } from 'vitest';
import { objectOrEmpty } from './request-body';

describe('objectOrEmpty', () => {
  it('keeps a plain object and reads anything else as empty', () => {
    expect(objectOrEmpty({ a: 1 })).toEqual({ a: 1 });
    for (const v of [null, undefined, 'x', 3, [1], true]) expect(objectOrEmpty(v)).toEqual({});
  });
});
