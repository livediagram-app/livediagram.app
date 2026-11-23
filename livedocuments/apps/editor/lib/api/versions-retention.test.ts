import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiListVersions, versionRetentionOf } from './versions';

// The list's retention (docs/specs/006-document/version-history.md "With Pro on"): what the server said of how long
// the owner's tier keeps automatic versions rides beside the list it came with, and is nothing with Pro off.

const who = { ownerId: 'owner-1', shareCode: null };
const answer = (body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(body))),
  );

afterEach(() => vi.unstubAllGlobals());

describe('the version list’s retention', () => {
  it('is what the server answered with the list', async () => {
    answer({ versions: [{ id: 'v1' }], retention: { days: 7, owner: 'p:user_a' } });
    const versions = await apiListVersions(who, 'd1', 't1');
    expect(versions.map((v) => v.id)).toEqual(['v1']);
    expect(versionRetentionOf(versions)).toEqual({ days: 7, owner: 'p:user_a' });
  });

  it('is nothing for a list answered without one, or one this did not read', async () => {
    answer({ versions: [] });
    expect(versionRetentionOf(await apiListVersions(who, 'd1', 't1'))).toBeNull();
    expect(versionRetentionOf([])).toBeNull();
  });
});
