import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { purgeDesignPreviews } from './designs';

// When the index purges a design (an account closing, the Trash emptying; routes/internal-items.ts), its previews
// are liveworkspace's (liveworkspace/docs/specs/006-media/previews.md), so the purge asks the media service to drop them.

const { deletePreviews } = vi.hoisted(() => ({ deletePreviews: vi.fn() }));
vi.mock('../media', () => ({
  mediaClient: (env: Env) => (env.MEDIA_KEY ? { deletePreviews } : null),
}));

describe('purgeDesignPreviews (liveworkspace/docs/specs/006-media/previews.md "Purging")', () => {
  beforeEach(() => {
    deletePreviews.mockReset();
  });

  it("asks the media service to drop the design's previews", async () => {
    deletePreviews.mockResolvedValue(undefined);
    await purgeDesignPreviews({ MEDIA_KEY: 'k' } as Env, 'd1');
    expect(deletePreviews).toHaveBeenCalledWith('d1');
  });

  it('carries on when the service fails, and when there is none', async () => {
    deletePreviews.mockRejectedValue(new Error('down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(purgeDesignPreviews({ MEDIA_KEY: 'k' } as Env, 'd1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[purge] previews not dropped', {
      designId: 'd1',
      error: 'Error: down',
    });
    await expect(purgeDesignPreviews({} as Env, 'd1')).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
