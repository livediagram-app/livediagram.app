import { describe, expect, it } from 'vitest';
import { isRoomOpRef } from './room-wire';

describe('isRoomOpRef', () => {
  it('takes a positive safe integer and nothing else', () => {
    expect(isRoomOpRef(1)).toBe(true);
    expect(isRoomOpRef(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isRoomOpRef(0)).toBe(false);
    expect(isRoomOpRef(-3)).toBe(false);
    expect(isRoomOpRef(1.5)).toBe(false);
    expect(isRoomOpRef(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isRoomOpRef('1')).toBe(false);
    expect(isRoomOpRef(undefined)).toBe(false);
  });
});
