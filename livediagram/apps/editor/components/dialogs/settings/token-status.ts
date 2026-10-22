// Pure readouts for the token manager (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// a token's status, how far through its six months it is, and the dates and
// relative times its card shows. No React, so every rule is unit-tested.
import type { ApiToken } from '@livediagram/api-schema';
import { DAY_MS } from '@livediagram/items';

// "Expires soon" inside this window: two weeks is enough notice to rotate.
const EXPIRES_SOON_MS = 14 * DAY_MS;
// A token used this recently gets the green "in use" dot.
const RECENTLY_USED_MS = DAY_MS;
// Every token's fixed lifetime, mirrored from the api's mint (six months).
const TOKEN_LIFETIME_MONTHS = 6;

export type TokenStatus = 'active' | 'expiring' | 'expired';

export function tokenStatus(token: Pick<ApiToken, 'expiresAt'>, now: number): TokenStatus {
  const left = token.expiresAt - now;
  if (left <= 0) return 'expired';
  if (left < EXPIRES_SOON_MS) return 'expiring';
  return 'active';
}

export const STATUS_LABEL: Record<TokenStatus, string> = {
  active: 'Active',
  expiring: 'Expires soon',
  expired: 'Expired',
};

// 0 at creation, 1 at expiry, clamped: the lifetime bar's fill.
export function lifetimeElapsed(
  token: Pick<ApiToken, 'createdAt' | 'expiresAt'>,
  now: number,
): number {
  const span = token.expiresAt - token.createdAt;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - token.createdAt) / span));
}

export function usedRecently(token: Pick<ApiToken, 'lastUsedAt'>, now: number): boolean {
  return token.lastUsedAt !== null && now - token.lastUsedAt < RECENTLY_USED_MS;
}

// When a token minted `now` would expire: the composer's live preview.
export function expiryFrom(now: number): number {
  const d = new Date(now);
  d.setMonth(d.getMonth() + TOKEN_LIFETIME_MONTHS);
  return d.getTime();
}

export function formatTokenDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Compact relative time: "2 days ago" (past) / "in 5 months" (future).
export function relativeTime(ms: number, now: number): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [365 * DAY_MS, 'year'],
    [30 * DAY_MS, 'month'],
    [7 * DAY_MS, 'week'],
    [DAY_MS, 'day'],
    [3_600_000, 'hour'],
    [60_000, 'minute'],
  ];
  for (const [size, name] of units) {
    if (abs >= size) {
      const n = Math.round(abs / size);
      const label = `${n} ${name}${n !== 1 ? 's' : ''}`;
      return diff < 0 ? `${label} ago` : `in ${label}`;
    }
  }
  return diff < 0 ? 'just now' : 'in a moment';
}

// Newest first: the one you just made is the one you are looking for.
export function sortTokens(tokens: readonly ApiToken[]): ApiToken[] {
  return [...tokens].sort((a, b) => b.createdAt - a.createdAt);
}
