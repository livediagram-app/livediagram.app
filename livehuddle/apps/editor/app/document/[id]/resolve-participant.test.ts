// The first-visit name (docs/specs/014-identity/auth-and-guest-access.md): the account name when signed in, a random
// placeholder for a guest, the same rule in the editor and on /new.
import { afterEach, describe, expect, it, vi } from 'vitest';

const apiLoadSelf = vi.fn<(id: string) => Promise<unknown>>();
const apiSaveSelf = vi.fn<(p: unknown) => Promise<void>>();
vi.mock('@/lib/api-client', () => ({
  apiLoadSelf: (id: string) => apiLoadSelf(id),
  apiSaveSelf: (p: unknown) => apiSaveSelf(p),
}));
vi.mock('@/lib/guest-identity', () => ({
  ensureGuestIdentity: async () => ({ id: 'guest_1' }),
}));

import { firstVisitName, resolveParticipant } from './resolve-participant';

afterEach(() => {
  apiLoadSelf.mockReset();
  apiSaveSelf.mockReset();
});

describe('firstVisitName', () => {
  it('is the account name when signed in, else the guest name', () => {
    expect(firstVisitName('user_1', 'Olive Owner', 'Nimble Wolf')).toBe('Olive Owner');
    expect(firstVisitName(null, 'Olive Owner', 'Nimble Wolf')).toBe('Nimble Wolf');
    expect(firstVisitName('user_1', null, 'Nimble Wolf')).toBe('Nimble Wolf');
  });
});

describe('resolveParticipant', () => {
  it('seeds a signed-in first visit with the account name', async () => {
    apiLoadSelf.mockResolvedValue(null);
    apiSaveSelf.mockResolvedValue(undefined);
    const self = await resolveParticipant({
      accountUserId: 'user_1',
      accountDisplayName: 'Olive Owner',
    });
    expect(self.name).toBe('Olive Owner');
    expect(apiSaveSelf).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user_1', name: 'Olive Owner' }),
    );
  });

  it('keeps a stored profile as it is', async () => {
    apiLoadSelf.mockResolvedValue({ id: 'user_1', name: 'Liv', color: '#000', status: 'online' });
    const self = await resolveParticipant({
      accountUserId: 'user_1',
      accountDisplayName: 'Olive Owner',
    });
    expect(self.name).toBe('Liv');
    expect(apiSaveSelf).not.toHaveBeenCalled();
  });
});
