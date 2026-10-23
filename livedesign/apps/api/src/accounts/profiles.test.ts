import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { accountsOwner } from './client';
import {
  __forgetProfiles,
  getParticipant,
  PROFILE_CACHE_MAX,
  PROFILE_TTL_MS,
  readParticipants,
  writeParticipant,
} from './profiles';

// Names and colours come from the liveworkspace accounts Worker's profiles (liveworkspace/docs/accounts.md
// "Profiles"). These pin the costs: a page of people is one request, a person read in the last minute is no
// request at all, and an unreachable accounts Worker never fails the read it decorates.

const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';

let accounts: FakeAccounts;
let env: Env;
beforeEach(() => {
  __forgetProfiles();
  accounts = fakeAccounts();
  env = accounts.env as unknown as Env;
  vi.stubGlobal('fetch', accounts.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('accountsOwner', () => {
  it('keeps an account id, prefixes a livedesign guest UUID, and refuses anything else', () => {
    expect(accountsOwner('user_abc')).toBe('user_abc');
    expect(accountsOwner(GUEST)).toBe(`guest_${GUEST}`);
    expect(accountsOwner(`guest_${GUEST}`)).toBe(`guest_${GUEST}`);
    for (const id of ['', 'owner', 'user_', GUEST.toUpperCase(), 'user_a b']) {
      expect(accountsOwner(id)).toBeNull();
    }
  });
});

describe('readParticipants', () => {
  it('reads many people in one request, and leaves out who has no profile or no name', async () => {
    accounts.accounts.set('user_ann', { name: 'Ann', email: null });
    accounts.accounts.set('user_nameless', { name: null, email: null });
    accounts.profiles.set(`guest_${GUEST}`, {
      name: 'Otter',
      color: '#123',
      createdAt: 1,
      updatedAt: 1,
    });
    const found = await readParticipants(env, [
      'user_ann',
      GUEST,
      'user_ann',
      'user_nameless',
      'x',
    ]);
    expect([...found.keys()].sort()).toEqual([GUEST, 'user_ann']);
    expect(found.get(GUEST)).toMatchObject({ id: GUEST, name: 'Otter', color: '#123' });
    expect(found.get('user_ann')?.color).toBe('#0ea5e9');
    expect(accounts.callsTo('profiles/read')).toEqual([
      { path: 'profiles/read', body: { ids: ['user_ann', `guest_${GUEST}`, 'user_nameless'] } },
    ]);
  });

  it('asks nobody about a person read in the last minute, then asks again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    accounts.accounts.set('user_ann', { name: 'Ann', email: null });
    await getParticipant(env, 'user_ann');
    await getParticipant(env, 'user_ann');
    expect(accounts.callsTo('profiles/read')).toHaveLength(1);
    vi.setSystemTime(Date.now() + PROFILE_TTL_MS + 1);
    await getParticipant(env, 'user_ann');
    expect(accounts.callsTo('profiles/read')).toHaveLength(2);
  });

  it('remembers at most PROFILE_CACHE_MAX people, the oldest going first', async () => {
    const ids = Array.from({ length: PROFILE_CACHE_MAX + 1 }, (_, i) => `user_${i}`);
    await readParticipants(env, ids);
    await readParticipants(env, ['user_0', `user_${PROFILE_CACHE_MAX}`]);
    expect(accounts.callsTo('profiles/read').at(-1)!.body).toEqual({ ids: ['user_0'] });
  });

  it('answers what it has when the accounts Worker cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.failing.set('profiles/read', 500);
    expect((await readParticipants(env, ['user_ann'])).size).toBe(0);
    expect(warn).toHaveBeenCalledWith('[profiles] read_failed', expect.anything());
    warn.mockRestore();
  });

  it('asks nobody without an accounts Worker', async () => {
    expect((await readParticipants({} as Env, ['user_ann'])).size).toBe(0);
    expect(accounts.calls).toHaveLength(0);
  });
});

describe('writeParticipant', () => {
  it('writes only what changed, and remembers the answer', async () => {
    await writeParticipant(env, GUEST, { name: 'Otter', color: '#123' });
    await writeParticipant(env, GUEST, { name: 'Otter', color: '#456' });
    expect(accounts.callsTo('profiles/write').map((c) => c.body)).toEqual([
      { owner: `guest_${GUEST}`, name: 'Otter', color: '#123' },
      { owner: `guest_${GUEST}`, color: '#456' },
    ]);
    expect(await getParticipant(env, GUEST)).toMatchObject({ color: '#456' });
    // One read before the first write; the rest were remembered.
    expect(accounts.callsTo('profiles/read')).toHaveLength(1);
  });

  it('keeps nothing without an accounts Worker, or for an id it cannot vouch for', async () => {
    expect(await writeParticipant({} as Env, GUEST, { name: 'A', color: '#1' })).toBeNull();
    expect(await writeParticipant(env, 'owner', { name: 'A', color: '#1' })).toBeNull();
    expect(accounts.calls).toHaveLength(0);
  });
});
