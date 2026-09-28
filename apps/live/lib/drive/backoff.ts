// Back-off on Google's rate limits (docs/specs/022-drive-mirror/drive-mirror.md,
// "Cadence"): each 403 userRateLimitExceeded / 429 doubles the intervals, up
// to their ceilings; an hour without errors returns them to normal.

import {
  DRIVE_BACKOFF_CALM_MS,
  DRIVE_BACKOFF_MAX_LEVEL,
  DRIVE_POLL_INTERVAL_MAX_MS,
  DRIVE_POLL_INTERVAL_MS,
  DRIVE_WRITE_MIN_INTERVAL_MAX_MS,
  DRIVE_WRITE_MIN_INTERVAL_MS,
} from './cadence';

export class Backoff {
  private level = 0;
  private lastErrorAt: number | null = null;

  hit(now: number): void {
    this.settle(now);
    this.level = Math.min(this.level + 1, DRIVE_BACKOFF_MAX_LEVEL);
    this.lastErrorAt = now;
  }

  private settle(now: number): void {
    if (this.lastErrorAt !== null && now - this.lastErrorAt >= DRIVE_BACKOFF_CALM_MS) {
      this.level = 0;
      this.lastErrorAt = null;
    }
  }

  factor(now: number): number {
    this.settle(now);
    return 2 ** this.level;
  }

  active(now: number): boolean {
    return this.factor(now) > 1;
  }

  pollIntervalMs(now: number): number {
    return Math.min(DRIVE_POLL_INTERVAL_MS * this.factor(now), DRIVE_POLL_INTERVAL_MAX_MS);
  }

  writeIntervalMs(now: number): number {
    return Math.min(
      DRIVE_WRITE_MIN_INTERVAL_MS * this.factor(now),
      DRIVE_WRITE_MIN_INTERVAL_MAX_MS,
    );
  }
}
