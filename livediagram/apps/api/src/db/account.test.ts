import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { purgeDocumentRows } from './documents';

// When the index purges a canvas (an account closing, the Trash emptying; routes/internal-items.ts), the canvas's
// SVG snapshots in R2 (docs/specs/006-document/document-snapshots.md, keyed thumb/<documentId>) are out of reach of
// its Durable Object, so they must be deleted by key or they orphan in R2. Its images are the media service's.

describe('purgeDocumentRows snapshot cleanup (docs/specs/006-document/document-snapshots.md)', () => {
  it("bulk-deletes the canvas's snapshots (its own and the Community's) from R2 in one call", async () => {
    const del = vi.fn().mockResolvedValue(undefined);

    await purgeDocumentRows({ IMAGES: { delete: del } } as unknown as Env, 'd1');

    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith([
      'thumb/d1',
      'thumb-community/d1',
      'og/d1',
      'og-community/d1',
    ]);
  });

  it('skips R2 cleanup when no bucket is bound (self-host) without throwing', async () => {
    await expect(purgeDocumentRows({} as Env, 'd1')).resolves.toBeUndefined();
  });
});
