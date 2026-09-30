import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  expiryFrom,
  lifetimeElapsed,
  relativeTime,
  sortTokens,
  tokenStatus,
  tryItCommand,
  usedRecently,
} from './token-status';

const NOW = Date.UTC(2026, 8, 30);

describe('token-status', () => {
  it('reads Active, then Expires soon inside two weeks, then Expired', () => {
    expect(tokenStatus({ expiresAt: NOW + 30 * DAY_MS }, NOW)).toBe('active');
    expect(tokenStatus({ expiresAt: NOW + 13 * DAY_MS }, NOW)).toBe('expiring');
    expect(tokenStatus({ expiresAt: NOW }, NOW)).toBe('expired');
  });

  it('fills the lifetime bar from creation to expiry, clamped', () => {
    const t = { createdAt: NOW - 10 * DAY_MS, expiresAt: NOW + 10 * DAY_MS };
    expect(lifetimeElapsed(t, NOW)).toBeCloseTo(0.5);
    expect(lifetimeElapsed(t, NOW + 100 * DAY_MS)).toBe(1);
    expect(lifetimeElapsed(t, NOW - 100 * DAY_MS)).toBe(0);
  });

  it('marks a token used in the last day, never an unused one', () => {
    expect(usedRecently({ lastUsedAt: NOW - 3_600_000 }, NOW)).toBe(true);
    expect(usedRecently({ lastUsedAt: NOW - 2 * DAY_MS }, NOW)).toBe(false);
    expect(usedRecently({ lastUsedAt: null }, NOW)).toBe(false);
  });

  it('previews an expiry six calendar months out', () => {
    expect(new Date(expiryFrom(NOW)).getUTCMonth()).toBe(2); // March
  });

  it('says relative times both ways', () => {
    expect(relativeTime(NOW - 2 * DAY_MS, NOW)).toBe('2 days ago');
    expect(relativeTime(NOW + 60 * DAY_MS, NOW)).toBe('in 2 months');
    expect(relativeTime(NOW, NOW)).toBe('in a moment');
  });

  it('lists the newest first', () => {
    const t = (id: string, createdAt: number) => ({
      id,
      name: null,
      createdAt,
      expiresAt: createdAt + DAY_MS,
      lastUsedAt: null,
      readOnly: false,
    });
    expect(sortTokens([t('a', 1), t('b', 3), t('c', 2)]).map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('builds a runnable curl against a relative or absolute api base', () => {
    expect(tryItCommand('lvd_x', '/api', 'https://livediagram.app')).toBe(
      'curl https://livediagram.app/api/documents \\\n  -H "Authorization: Bearer lvd_x"',
    );
    expect(tryItCommand('lvd_x', 'http://localhost:8787/api/', 'http://localhost:3002')).toContain(
      'curl http://localhost:8787/api/documents',
    );
  });
});
