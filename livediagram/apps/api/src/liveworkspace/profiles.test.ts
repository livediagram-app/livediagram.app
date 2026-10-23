import { colorForKey } from '@livediagram/api-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsServiceFor, type TestAccountsService } from '../test-accounts-service';
import type { Env } from '../types';
import {
  __resetProfileCache,
  forgetParticipant,
  getParticipant,
  getParticipants,
  PROFILE_CACHE_MS,
  setParticipant,
} from './profiles';

const GUEST = 'guest_0f5ca4af-9a8a-4a60-be5e-1179e5555880';

let env: Env;
let accounts: TestAccountsService;

beforeEach(() => {
  env = {} as Env;
  accounts = accountsServiceFor(env);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('getParticipants (liveworkspace profiles)', () => {
  it('reads every id in one call, a guest by its own guest_<uuid> id', async () => {
    accounts.profiles.set('user_a', { name: 'Ann', color: '#111111', createdAt: 5 });
    accounts.profiles.set(GUEST, { name: 'Gus', color: null, createdAt: 7 });
    const found = await getParticipants(env, ['user_a', GUEST, 'user_a', 'user_gone']);
    expect(accounts.calls).toEqual(['POST /profiles/read']);
    expect(found.get('user_a')).toEqual({
      id: 'user_a',
      name: 'Ann',
      color: '#111111',
      createdAt: 5,
    });
    // No colour of their own: the palette's pick for the id.
    expect(found.get(GUEST)).toEqual({
      id: GUEST,
      name: 'Gus',
      color: colorForKey(GUEST),
      createdAt: 7,
    });
    expect(found.has('user_gone')).toBe(false);
  });

  it('falls back to the account name, and treats no name as no participant', async () => {
    accounts.accounts.set('user_a', { name: 'Ann Account', email: null });
    accounts.profiles.set('user_b', { name: null, color: '#222222', createdAt: 1 });
    const found = await getParticipants(env, ['user_a', 'user_b']);
    expect(found.get('user_a')?.name).toBe('Ann Account');
    expect(found.get('user_a')?.createdAt).toBe(0);
    expect(found.has('user_b')).toBe(false);
  });

  it('remembers reads, found or not, for PROFILE_CACHE_MS', async () => {
    vi.useFakeTimers();
    accounts.profiles.set('user_a', { name: 'Ann', color: null, createdAt: 1 });
    await getParticipants(env, ['user_a', 'user_none']);
    await getParticipants(env, ['user_a', 'user_none']);
    expect(accounts.calls).toHaveLength(1);
    vi.advanceTimersByTime(PROFILE_CACHE_MS + 1);
    await getParticipant(env, 'user_a');
    expect(accounts.calls).toHaveLength(2);
    forgetParticipant('user_a');
    await getParticipant(env, 'user_a');
    expect(accounts.calls).toHaveLength(3);
  });

  it('asks nothing for ids liveworkspace cannot hold, or without sign-in configured', async () => {
    expect((await getParticipants(env, ['owner', 'not-a-uuid'])).size).toBe(0);
    __resetProfileCache();
    expect(await getParticipant({} as Env, 'user_a')).toBeNull();
    expect(accounts.calls).toEqual([]);
  });

  it('never throws: liveworkspace out of reach means not found', async () => {
    accounts.failWith = 503;
    expect(await getParticipant(env, 'user_a')).toBeNull();
    expect(console.warn).toHaveBeenCalledWith('[profiles] read_failed', expect.anything());
  });
});

describe('setParticipant', () => {
  it('writes the caller’s own profile and remembers it at once', async () => {
    const made = await setParticipant(env, GUEST, { name: 'Gus', color: '#333333' });
    expect(made).toMatchObject({ id: GUEST, name: 'Gus', color: '#333333' });
    expect(accounts.profiles.get(GUEST)?.name).toBe('Gus');
    expect(await getParticipant(env, GUEST)).toEqual(made);
    expect(accounts.calls).toEqual(['POST /profiles/write']);
  });

  it('keeps nothing where liveworkspace can hold nothing', async () => {
    expect(await setParticipant({} as Env, 'user_a', { name: 'A', color: '#000' })).toBeNull();
    expect(await setParticipant(env, 'owner', { name: 'A', color: '#000' })).toBeNull();
  });
});
