import { afterEach, describe, expect, it, vi } from 'vitest';

const { sweep } = vi.hoisted(() => ({ sweep: vi.fn(async () => 3) }));
vi.mock('../db/image-retention', () => ({ deleteOldUnusedImages: sweep }));

import { runImageRetention, UNUSED_IMAGE_RETENTION_MS } from './retention';
import type { Env } from '../types';

// The daily image job (docs/specs/009-elements/images.md, "Retention").

const env = {} as Env;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runImageRetention', () => {
  it('sweeps images past the 30-day floor, and logs the count', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runImageRetention(env, 100 * 86_400_000);
    const cutoff = 100 * 86_400_000 - UNUSED_IMAGE_RETENTION_MS;
    expect(sweep).toHaveBeenCalledWith(env, cutoff);
    expect(log).toHaveBeenCalledWith(`image sweep: deleted 3 images older than ${cutoff}`);
  });

  it('logs a sweep failure instead of throwing', async () => {
    sweep.mockRejectedValueOnce(new Error('r2 down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(runImageRetention(env, 0)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('image sweep failed', expect.any(Error));
  });
});
