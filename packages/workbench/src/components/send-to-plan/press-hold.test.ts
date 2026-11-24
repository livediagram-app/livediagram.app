// What a send entry read as its press started (liveworkspace/docs/specs/004-index/send-to-plan.md "On a touch screen").
import { describe, expect, it } from 'vitest';
import { PRESS_HOLD_MS, pressHold } from './press-hold';

describe('pressHold', () => {
  it('gives its click what the press held, once', () => {
    let now = 0;
    const held = pressHold<string>(() => now);
    expect(held.take()).toBeUndefined();
    held.hold('Book the venue');
    now = 120;
    expect(held.take()).toBe('Book the venue');
    expect(held.take()).toBeUndefined();
  });

  it('counts a hold older than PRESS_HOLD_MS for nothing', () => {
    let now = 0;
    const held = pressHold<string | null>(() => now);
    held.hold(null);
    now = PRESS_HOLD_MS;
    expect(held.take()).toBeNull();
    held.hold('Late');
    now += PRESS_HOLD_MS + 1;
    expect(held.take()).toBeUndefined();
  });
});
