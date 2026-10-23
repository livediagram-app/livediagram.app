import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsServiceFor, type TestAccountsService } from '../test-accounts-service';
import type { Env } from '../types';
import { mergeGuestIntoOwner } from './guest-merge';
import { getParticipant } from './profiles';

const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const SIGNED = '7d2c1b8e-3f4a-4c5d-9e6f-0a1b2c3d4e5f';

let env: Env;
let accounts: TestAccountsService;

beforeEach(() => {
  env = {} as Env;
  accounts = accountsServiceFor(env);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('mergeGuestIntoOwner (docs/specs/014-identity/auth-and-guest-access.md)', () => {
  it('fills the account’s gaps from the guest, keeps its own values, then clears the guest', async () => {
    accounts.accounts.set('user_a', { name: null, email: null });
    accounts.settings.set(`guest_${GUEST} all`, { reduceMotion: true, uiScale: 2 });
    accounts.settings.set(`guest_${GUEST} livediagram.app`, { gridSnap: true });
    accounts.settings.set('user_a all', { uiScale: 1 });
    accounts.profiles.set(`guest_${GUEST}`, { name: 'Gus', color: '#123456', createdAt: 1 });
    accounts.profiles.set('user_a', { name: null, color: '#abcdef', createdAt: 9 });
    await getParticipant(env, 'user_a'); // remembered as nameless

    await mergeGuestIntoOwner(env, GUEST, 'user_a');

    expect(accounts.settings.get('user_a all')).toEqual({ uiScale: 1, reduceMotion: true });
    expect(accounts.settings.get('user_a livediagram.app')).toEqual({ gridSnap: true });
    expect(accounts.settings.get(`guest_${GUEST} all`)).toEqual({});
    expect(accounts.settings.get(`guest_${GUEST} livediagram.app`)).toEqual({});
    // The name was missing, so it comes over; the colour was the account's own, so it stays.
    expect(accounts.profiles.get('user_a')).toMatchObject({
      name: 'Gus',
      color: '#abcdef',
      createdAt: 9,
    });
    expect(accounts.profiles.get(`guest_${GUEST}`)).toMatchObject({ name: null, color: null });
    // The remembered copy was forgotten, so the merged name shows at once.
    expect((await getParticipant(env, 'user_a'))?.name).toBe('Gus');
  });

  it('never renames an account that has a name, and the new id keeps its own age', async () => {
    accounts.accounts.set('user_a', { name: 'Ann', email: null });
    accounts.profiles.set(`guest_${GUEST}`, { name: 'Gus', color: '#123456', createdAt: 1 });
    await mergeGuestIntoOwner(env, GUEST, 'user_a');
    expect(accounts.profiles.get('user_a')).toMatchObject({ name: null, color: '#123456' });
    expect(accounts.profiles.get('user_a')?.createdAt).not.toBe(1);
    expect((await getParticipant(env, 'user_a'))?.name).toBe('Ann');
  });

  it('moves a legacy guest onto its signed guest id', async () => {
    accounts.profiles.set(`guest_${GUEST}`, { name: 'Gus', color: null, createdAt: 1 });
    await mergeGuestIntoOwner(env, GUEST, SIGNED);
    expect(accounts.profiles.get(`guest_${SIGNED}`)).toMatchObject({ name: 'Gus' });
  });

  it('writes nothing when the guest has nothing', async () => {
    await mergeGuestIntoOwner(env, GUEST, 'user_a');
    expect(accounts.calls.filter((c) => c.endsWith('/write'))).toEqual([]);
  });

  it('does nothing for the same owner, an id liveworkspace can’t hold, or without sign-in', async () => {
    await mergeGuestIntoOwner(env, GUEST, GUEST);
    await mergeGuestIntoOwner(env, 'owner', 'user_a');
    await mergeGuestIntoOwner({} as Env, GUEST, 'user_a');
    expect(accounts.calls).toEqual([]);
  });

  it('is best effort: a failure is logged, not thrown', async () => {
    accounts.failWith = 503;
    await expect(mergeGuestIntoOwner(env, GUEST, 'user_a')).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[guest-merge] failed', expect.any(String));
  });
});
