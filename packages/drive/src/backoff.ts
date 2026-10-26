// Back-off on Google's rate limits (liveworkspace/docs/specs/005-drive/drive.md "Cadence"): each 403 userRateLimitExceeded / 429
// doubles the intervals, up to their ceilings; an hour without errors returns them to normal. Plain data, so the
// person's store keeps it between passes.

import {
  DRIVE_BACKOFF_CALM_MS,
  DRIVE_BACKOFF_MAX_LEVEL,
  DRIVE_FALLBACK_CHECK_MAX_MS,
  DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS,
  DRIVE_ITEM_MIN_WRITE_INTERVAL_MS,
} from './constants';

export type Backoff = { level: number; lastErrorAt: number | null };

export const NO_BACKOFF: Backoff = { level: 0, lastErrorAt: null };

function settled(b: Backoff, now: number): Backoff {
  return b.lastErrorAt !== null && now - b.lastErrorAt >= DRIVE_BACKOFF_CALM_MS ? NO_BACKOFF : b;
}

export function backoffHit(b: Backoff, now: number): Backoff {
  const s = settled(b, now);
  return { level: Math.min(s.level + 1, DRIVE_BACKOFF_MAX_LEVEL), lastErrorAt: now };
}

export const backoffFactor = (b: Backoff, now: number) => 2 ** settled(b, now).level;

export const writeIntervalMs = (b: Backoff, now: number) =>
  Math.min(DRIVE_ITEM_MIN_WRITE_INTERVAL_MS * backoffFactor(b, now), DRIVE_ITEM_MIN_WRITE_INTERVAL_MAX_MS);

export const fallbackCheckMs = (b: Backoff, now: number, baseMs: number) =>
  Math.min(baseMs * backoffFactor(b, now), Math.max(baseMs, DRIVE_FALLBACK_CHECK_MAX_MS));
