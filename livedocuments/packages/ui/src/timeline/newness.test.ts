import { describe, expect, it } from 'vitest';
import { isNewEvent } from './newness';

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('isNewEvent', () => {
  it('marks an event that landed since the reader last looked', () => {
    expect(isNewEvent(NOW - HOUR, NOW - DAY, NOW)).toBe(true);
  });

  it('does not mark anything the reader has already seen', () => {
    expect(isNewEvent(NOW - DAY, NOW - HOUR, NOW)).toBe(false);
  });

  it('marks nothing for a reader with no watermark', () => {
    // First-ever visit: flagging their whole history New is noise.
    expect(isNewEvent(NOW - HOUR, undefined, NOW)).toBe(false);
  });

  it('does not mark a future-dated event, however stale the watermark', () => {
    // The regression. An API token expiring in a week is recorded AT its
    // expiry instant so it renders in the Upcoming band, while the watermark
    // is only ever written as `now` — so `occurredAt > lastSeenAt` stayed
    // true no matter how many times the reader opened the feed, and the pill
    // never came off. Same reason the server's unread badge stuck at "1".
    expect(isNewEvent(NOW + 7 * DAY, NOW, NOW)).toBe(false);
    expect(isNewEvent(NOW + 7 * DAY, NOW - 30 * DAY, NOW)).toBe(false);
  });

  it('marks a scheduled event once it comes due', () => {
    // The clamp defers the pill, it doesn't cancel it: a week later the same
    // row is in the past and reads as news until the reader looks again.
    const expiry = NOW + 7 * DAY;
    expect(isNewEvent(expiry, NOW, expiry + HOUR)).toBe(true);
    expect(isNewEvent(expiry, expiry + HOUR, expiry + 2 * HOUR)).toBe(false);
  });
});
