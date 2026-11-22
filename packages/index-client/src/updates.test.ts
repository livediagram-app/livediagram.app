import { describe, expect, it } from 'vitest';
import { isUpdateKind, UPDATE_KINDS } from './updates';

describe('isUpdateKind', () => {
  it('takes the six kinds and nothing else', () => {
    for (const kind of UPDATE_KINDS) expect(isUpdateKind(kind)).toBe(true);
    expect(isUpdateKind('commented')).toBe(false);
    expect(isUpdateKind(1)).toBe(false);
  });
});
