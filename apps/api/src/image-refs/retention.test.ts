import { afterEach, describe, expect, it, vi } from 'vitest';

const { order, backfill, sweep } = vi.hoisted(() => {
  const order: string[] = [];
  return {
    order,
    backfill: vi.fn(async () => {
      order.push('backfill');
      return { state: 'complete' as const };
    }),
    sweep: vi.fn(async () => {
      order.push('sweep');
      return 3;
    }),
  };
});
vi.mock('./backfill', () => ({ runImageRefsBackfill: backfill }));
vi.mock('../db/image-retention', () => ({ deleteOldUnusedImages: sweep }));

import { runImageRetention, UNUSED_IMAGE_RETENTION_MS } from './retention';
import type { Env } from '../types';

// The daily image job (docs/specs/009-elements/images.md, "Retention"): the
// backfill runs first, so a run that completes it can sweep the same day, and
// a failed backfill still lets the (self-gating) sweep report.

const env = {} as Env;

afterEach(() => {
  order.length = 0;
  vi.restoreAllMocks();
});

describe('runImageRetention', () => {
  it('backfills, then sweeps images past the 30-day floor, and logs the count', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runImageRetention(env, 100 * 86_400_000);
    expect(order).toEqual(['backfill', 'sweep']);
    const cutoff = 100 * 86_400_000 - UNUSED_IMAGE_RETENTION_MS;
    expect(sweep).toHaveBeenCalledWith(env, cutoff);
    expect(log).toHaveBeenCalledWith(`image sweep: deleted 3 images older than ${cutoff}`);
  });

  it('still sweeps when the backfill throws, logging the failure', async () => {
    backfill.mockRejectedValueOnce(new Error('d1 down'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runImageRetention(env, 0);
    expect(error).toHaveBeenCalledWith('image-refs backfill failed', expect.any(Error));
    expect(sweep).toHaveBeenCalled();
  });

  it('logs a sweep failure instead of throwing', async () => {
    sweep.mockRejectedValueOnce(new Error('r2 down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(runImageRetention(env, 0)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('image sweep failed', expect.any(Error));
  });
});
