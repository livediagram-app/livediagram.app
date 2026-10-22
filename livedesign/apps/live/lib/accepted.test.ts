import { describe, expect, it, vi } from 'vitest';
import { accepted } from './accepted';

describe('accepted', () => {
  it('is true for a resolved request', async () => {
    expect(await accepted(Promise.resolve({ id: 'd1' }))).toBe(true);
  });

  it('is false for a rejected request, and does not rethrow', async () => {
    expect(await accepted(Promise.reject(new Error('500')))).toBe(false);
  });

  it('is false for a resolved-then-rejected chain', async () => {
    const request = Promise.resolve().then(() => {
      throw new Error('network');
    });
    expect(await accepted(request)).toBe(false);
  });

  // The whole point: the caller has to look at the answer, so the guarded
  // statement cannot run on a failure the way it did after a bare
  // `.catch(() => {})`. This is the shape every fixed call site now uses.
  it('gates the follow-up statement on the outcome', async () => {
    const track = vi.fn();
    if (await accepted(Promise.reject(new Error('403')))) track('Folder', 'Renamed');
    expect(track).not.toHaveBeenCalled();
    if (await accepted(Promise.resolve())) track('Folder', 'Renamed');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('treats a falsy resolution as acceptance (the value is not the signal)', async () => {
    // Several api helpers resolve to void or null on success; only a rejection
    // means the server refused.
    expect(await accepted(Promise.resolve(undefined))).toBe(true);
    expect(await accepted(Promise.resolve(null))).toBe(true);
  });
});
