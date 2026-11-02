import { describe, expect, it } from 'vitest';
import { communitySharedAgo } from './shared-ago';

const NOW = Date.UTC(2026, 9, 5, 12);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('communitySharedAgo', () => {
  it('uses the relative wording for the first month', () => {
    expect(communitySharedAgo(NOW, NOW)).toBe('just now');
    expect(communitySharedAgo(NOW - 3 * HOUR, NOW)).toBe('3 hours ago');
    expect(communitySharedAgo(NOW - DAY, NOW)).toBe('yesterday');
    expect(communitySharedAgo(NOW - 29 * DAY, NOW)).toBe('29 days ago');
  });

  it('then whole months, then whole years', () => {
    expect(communitySharedAgo(NOW - 30 * DAY, NOW)).toBe('1 month ago');
    expect(communitySharedAgo(NOW - 214 * DAY, NOW)).toBe('7 months ago');
    expect(communitySharedAgo(NOW - 365 * DAY, NOW)).toBe('1 year ago');
    expect(communitySharedAgo(NOW - 800 * DAY, NOW)).toBe('2 years ago');
  });
});
