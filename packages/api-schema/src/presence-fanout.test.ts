import { describe, expect, it } from 'vitest';
import { PRESENCE_QUIET_ROOM, presenceBatches, presenceStepMs } from './presence-fanout';

describe('presenceStepMs', () => {
  it('keeps a room of up to 10 at about 30 Hz, as it always was', () => {
    expect(presenceStepMs(1)).toBe(33);
    expect(presenceStepMs(PRESENCE_QUIET_ROOM)).toBe(33);
  });

  it('steps down to 20 Hz up to 32 and 15 Hz above that', () => {
    expect(presenceStepMs(11)).toBe(50);
    expect(presenceStepMs(32)).toBe(50);
    expect(presenceStepMs(33)).toBe(66);
    expect(presenceStepMs(100)).toBe(66);
  });
});

describe('presenceBatches', () => {
  it('coalesces only above the quiet room', () => {
    expect(presenceBatches(PRESENCE_QUIET_ROOM)).toBe(false);
    expect(presenceBatches(PRESENCE_QUIET_ROOM + 1)).toBe(true);
  });
});
