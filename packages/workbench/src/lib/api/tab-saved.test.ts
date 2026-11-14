import { describe, expect, it, vi } from 'vitest';
import { announceTabSave } from './tab-saved';

// A landed save announced to the room (each product's docs/specs/006-*/delta-saves.md "A peer's save moves the base
// copy"): the op when a copy is held, and nothing, never a throw, otherwise.

const DIGEST = 'b'.repeat(64);

describe('announceTabSave', () => {
  it('sends tab-saved with the revision and the held copy digest', async () => {
    const send = vi.fn();
    const digestOf = vi.fn(async () => DIGEST);
    await announceTabSave('t1', 7, () => ({ send }), digestOf);
    expect(digestOf).toHaveBeenCalledWith('t1', 7);
    expect(send).toHaveBeenCalledWith({
      kind: 'op',
      op: { kind: 'tab-saved', tabId: 't1', rev: 7, digest: DIGEST },
    });
  });

  it('sends nothing without a room, a held copy, or when the digest fails', async () => {
    const send = vi.fn();
    const digestOf = vi.fn(async () => DIGEST);
    await announceTabSave('t1', 7, () => null, digestOf);
    expect(digestOf).not.toHaveBeenCalled();
    await announceTabSave(
      't1',
      7,
      () => ({ send }),
      async () => null,
    );
    await expect(
      announceTabSave(
        't1',
        7,
        () => ({ send }),
        () => Promise.reject(new Error('no crypto')),
      ),
    ).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
