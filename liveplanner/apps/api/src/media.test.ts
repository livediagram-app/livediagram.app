import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaClient } from '@liveworkspace/media';
import {
  clearMediaOwnersForTests,
  mediaImageOwner,
  mediaOwner,
  OWNERS_MAX,
  rememberMediaOwner,
} from './media';

// Whose picture an id is, remembered per isolate (media.ts): asked of the service once, at most OWNERS_MAX kept,
// the oldest dropped first.

const service = (owner: string | null) => {
  const get = vi.fn(async () => (owner === null ? null : { owner }));
  return { client: { get } as unknown as MediaClient, get };
};

beforeEach(() => clearMediaOwnersForTests());

describe('mediaImageOwner', () => {
  it('asks the service once per picture, and remembers an unknown id as nobody', async () => {
    const { client, get } = service('user_ada');
    expect(await mediaImageOwner(client, 'img-1')).toBe('user_ada');
    expect(await mediaImageOwner(client, 'img-1')).toBe('user_ada');
    expect(get).toHaveBeenCalledTimes(1);
    expect(await mediaImageOwner(service(null).client, 'img-2')).toBe('');
  });

  it(`keeps at most OWNERS_MAX (${OWNERS_MAX}), dropping the oldest`, async () => {
    for (let i = 0; i <= OWNERS_MAX; i++) rememberMediaOwner(`img-${i}`, 'user_ada');
    const { client, get } = service('user_bob');
    expect(await mediaImageOwner(client, `img-${OWNERS_MAX}`)).toBe('user_ada');
    expect(get).not.toHaveBeenCalled();
    expect(await mediaImageOwner(client, 'img-0')).toBe('user_bob');
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('mediaOwner', () => {
  it('names an account by its id and a guest by a hash this app alone can make', async () => {
    expect(await mediaOwner('user_ada')).toBe('user_ada');
    const guest = await mediaOwner('guest_1');
    expect(guest).not.toContain('guest_1');
    expect(guest).toMatch(/^guest:/);
  });
});
