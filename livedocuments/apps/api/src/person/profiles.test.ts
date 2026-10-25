import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_ON, profileOf, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import {
  __forgetProfiles,
  DEFAULT_PARTICIPANT_COLOR,
  getParticipant,
  getParticipants,
  PROFILE_CACHE_MS,
  saveParticipant,
} from './profiles';

// Names and colours are the accounts Worker's profiles (liveworkspace/docs/accounts.md "Profiles"),
// read a list at a time and remembered per isolate for a minute.

const env = ACCOUNTS_ON as Env;
const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';

let accounts: FakeAccounts;
beforeEach(() => {
  __forgetProfiles();
  accounts = stubAccounts();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getParticipants', () => {
  it('reads a list of people in one call, guests under their accounts id', async () => {
    accounts.profiles.set('user_a', profileOf('user_a', 'Ada', '#123456'));
    accounts.profiles.set(`guest_${GUEST}`, profileOf(`guest_${GUEST}`, 'Otter', null));
    const people = await getParticipants(env, ['user_a', GUEST, 'user_a', 'user_gone', null]);
    expect(accounts.calls).toHaveLength(1);
    expect(accounts.calls[0]!.body.ids).toEqual(['user_a', `guest_${GUEST}`, 'user_gone']);
    expect(people.get('user_a')).toMatchObject({ name: 'Ada', color: '#123456' });
    // No colour of their own: the default.
    expect(people.get(GUEST)).toMatchObject({ name: 'Otter', color: DEFAULT_PARTICIPANT_COLOR });
    expect(people.has('user_gone')).toBe(false);
  });

  it('splits a list past 100 ids into batches, sent together', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `user_${i}`);
    await getParticipants(env, ids);
    expect(accounts.calls.map((c) => (c.body.ids as string[]).length)).toEqual([100, 100, 50]);
  });

  it('remembers what it read for a minute, then asks again', async () => {
    vi.useFakeTimers({ now: 1_000 });
    accounts.profiles.set('user_a', profileOf('user_a', 'Ada', null));
    await getParticipant(env, 'user_a');
    await getParticipant(env, 'user_a');
    expect(accounts.calls).toHaveLength(1);
    vi.setSystemTime(1_000 + PROFILE_CACHE_MS + 1);
    await getParticipant(env, 'user_a');
    expect(accounts.calls).toHaveLength(2);
  });

  it('a person with no name has no participant; a failed read names nobody', async () => {
    accounts.profiles.set('user_a', profileOf('user_a', null, '#123456'));
    expect(await getParticipant(env, 'user_a')).toBeNull();
    __forgetProfiles();
    accounts.failWith = 502;
    expect((await getParticipants(env, ['user_a'])).size).toBe(0);
  });

  it('asks nothing for ids the accounts Worker has no place for, or without it', async () => {
    expect(await getParticipant(env, 'owner')).toBeNull();
    expect(await getParticipant({} as Env, 'user_a')).toBeNull();
    expect(accounts.calls).toHaveLength(0);
  });

  // 500 owners on a busy list: one read of five batches, then none while remembered.
  it('reads a long list within budget', async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `user_${i}`);
    for (const id of ids) accounts.profiles.set(id, profileOf(id, id, null));
    const started = performance.now();
    expect((await getParticipants(env, ids)).size).toBe(500);
    expect((await getParticipants(env, ids)).size).toBe(500);
    expect(performance.now() - started).toBeLessThan(250);
    expect(accounts.calls).toHaveLength(5);
  });
});

describe('saveParticipant', () => {
  it('writes the profile and replaces the remembered copy at once', async () => {
    accounts.profiles.set('user_a', profileOf('user_a', 'Ada', null));
    await getParticipant(env, 'user_a');
    const saved = await saveParticipant(env, 'user_a', { name: 'Ada L', color: '#abcdef' });
    expect(saved).toMatchObject({ id: 'user_a', name: 'Ada L', color: '#abcdef' });
    expect(await getParticipant(env, 'user_a')).toMatchObject({ name: 'Ada L' });
    expect(accounts.calls.map((c) => c.path)).toEqual(['/profiles/read', '/profiles/write']);
  });

  it('keeps nothing without an accounts Worker, answering what was sent', async () => {
    const saved = await saveParticipant({} as Env, GUEST, { name: 'Otter', color: '#000' });
    expect(saved).toMatchObject({ id: GUEST, name: 'Otter', color: '#000' });
    expect(accounts.calls).toHaveLength(0);
  });
});
