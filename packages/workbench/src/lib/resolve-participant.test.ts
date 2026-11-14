// The first-visit name (docs/specs/014-identity/auth-and-guest-access.md): the account name when signed in, a random
// placeholder for a guest, the same rule in the editor and on /new.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResolveParticipant, firstVisitName } from './resolve-participant';

type Participant = { id: string; name: string; color: string; status: 'online' | 'away' };

const apiLoadSelf = vi.fn<(id: string) => Promise<Participant | null>>();
const apiSaveSelf = vi.fn<(p: Participant) => Promise<void>>();
const resolveParticipant = createResolveParticipant<Participant>({
  apiLoadSelf: (id) => apiLoadSelf(id),
  apiSaveSelf: (p) => apiSaveSelf(p),
  ensureGuestIdentity: async () => ({ id: 'guest_1' }),
  randomName: () => 'Nimble Wolf',
  randomColor: () => '#123456',
});

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
    const onParticipantStep = vi.fn();
    const self = await resolveParticipant({
      accountUserId: 'user_1',
      accountDisplayName: 'Olive Owner',
      onParticipantStep,
    });
    expect(self).toEqual({ id: 'user_1', name: 'Olive Owner', color: '#123456', status: 'online' });
    expect(apiSaveSelf).toHaveBeenCalledWith(self);
    expect(onParticipantStep).toHaveBeenCalledOnce();
  });

  it('seeds a guest with a placeholder, even when the save or the load fails', async () => {
    apiLoadSelf.mockRejectedValue(new Error('offline'));
    apiSaveSelf.mockRejectedValue(new Error('offline'));
    const self = await resolveParticipant({ accountUserId: null, accountDisplayName: null });
    expect(self).toMatchObject({ id: 'guest_1', name: 'Nimble Wolf' });
  });

  it('keeps a stored profile as it is', async () => {
    apiLoadSelf.mockResolvedValue({ id: 'user_1', name: 'Liv', color: '#000', status: 'away' });
    const self = await resolveParticipant({
      accountUserId: 'user_1',
      accountDisplayName: 'Olive Owner',
    });
    expect(self).toEqual({ id: 'user_1', name: 'Liv', color: '#000', status: 'online' });
    expect(apiSaveSelf).not.toHaveBeenCalled();
  });
});
