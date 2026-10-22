import { describe, expect, it } from 'vitest';
import { isRoomOpRef } from './room-messages';

// docs/specs/012-collaboration/realtime-conflict-resolution.md: the `ref` a client puts on an op frame,
// which the room echoes on that op's cursor frame.
describe('isRoomOpRef', () => {
  it.each([1, 42, Number.MAX_SAFE_INTEGER])('accepts the positive safe integer %s', (ref) => {
    expect(isRoomOpRef(ref)).toBe(true);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 2, Number.NaN, Infinity, '3', null, undefined])(
    'refuses %s',
    (ref) => {
      expect(isRoomOpRef(ref)).toBe(false);
    },
  );
});
