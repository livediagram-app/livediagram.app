import { describe, expect, it } from 'vitest';
import { DAY_MS } from '@livediagram/document';
import { relativeTime } from './relative-time';

const NOW = Date.UTC(2026, 8, 30);

describe('relativeTime', () => {
  it('says relative times both ways', () => {
    expect(relativeTime(NOW - 2 * DAY_MS, NOW)).toBe('2 days ago');
    expect(relativeTime(NOW + 60 * DAY_MS, NOW)).toBe('in 2 months');
    expect(relativeTime(NOW, NOW)).toBe('in a moment');
  });
});
