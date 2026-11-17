import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { purgePlanPreviews } from './projects';

// When the index purges a plan (an account closing, the Trash emptying; routes/internal-items.ts), its previews are
// liveworkspace's (liveworkspace/docs/specs/006-media/previews.md), so the purge asks the media service to drop them.

const { deletePreviews, purge } = vi.hoisted(() => ({ deletePreviews: vi.fn(), purge: vi.fn() }));
vi.mock('../media', () => ({
  mediaClient: (env: Env) => (env.MEDIA_KEY ? { deletePreviews, walkthroughs: { purge } } : null),
}));

describe('purgePlanPreviews (liveworkspace/docs/specs/006-media/previews.md "Purging")', () => {
  beforeEach(() => {
    deletePreviews.mockReset();
    purge.mockReset();
  });

  it("asks the media service to drop the plan's previews", async () => {
    deletePreviews.mockResolvedValue(undefined);
    await purgePlanPreviews({ MEDIA_KEY: 'k' } as Env, 'p1');
    expect(deletePreviews).toHaveBeenCalledWith('p1');
    // And its walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md "Deleting").
    expect(purge).toHaveBeenCalledWith('p1');
  });

  it('carries on when the service fails, and when there is none', async () => {
    deletePreviews.mockRejectedValue(new Error('down'));
    purge.mockRejectedValue(new Error('gone'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(purgePlanPreviews({ MEDIA_KEY: 'k' } as Env, 'p1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[purge] previews not dropped', {
      projectId: 'p1',
      error: 'Error: down',
    });
    expect(warn).toHaveBeenCalledWith('[purge] walkthroughs not dropped', {
      projectId: 'p1',
      error: 'Error: gone',
    });
    await expect(purgePlanPreviews({} as Env, 'p1')).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
