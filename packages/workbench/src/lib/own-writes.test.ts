import { describe, expect, it, vi } from 'vitest';
import {
  createOwnWrites,
  holdOwnWriteKeys,
  isOwnWriteHeld,
  onOwnWritesReleased,
  ownWriteKey,
} from './own-writes';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Same-element edits converge" (every product).

describe('own writes', () => {
  it('holds a key until every hold of it is released, each release once', () => {
    const writes = createOwnWrites();
    const key = ownWriteKey('t1', 'a');
    const first = holdOwnWriteKeys(writes, [key]);
    const second = holdOwnWriteKeys(writes, [key, ownWriteKey('t1', 'b')]);
    expect(isOwnWriteHeld(writes, 't1', 'a')).toBe(true);
    expect(isOwnWriteHeld(writes, 't2', 'a')).toBe(false);
    first();
    first();
    expect(isOwnWriteHeld(writes, 't1', 'a')).toBe(true);
    second();
    expect(writes.held.size).toBe(0);
    // A hold whose count is already gone (the held map cleared) releases to nothing, never below it.
    const late = holdOwnWriteKeys(writes, [key]);
    writes.held.clear();
    late();
    expect(writes.held.size).toBe(0);
  });

  it('tells its listeners after each release, until they stop', () => {
    const writes = createOwnWrites();
    const listener = vi.fn(() => expect(writes.held.size).toBe(0));
    const stop = onOwnWritesReleased(writes, listener);
    const release = holdOwnWriteKeys(writes, [ownWriteKey('t1', 'a')]);
    release();
    release();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    holdOwnWriteKeys(writes, [])();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(writes.released.size).toBe(0);
  });
});
