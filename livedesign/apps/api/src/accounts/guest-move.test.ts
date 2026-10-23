import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { moveGuestAccountState } from './guest-move';

// A guest's settings, name and colour follow their designs when they sign in (or a legacy guest upgrades
// to a signed id), by the accounts Worker's own merge rule: what the target has stays, the guest's fills
// the gaps, then the guest's are cleared.

const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const SIGNED = '7d2c1b8e-3f4a-4c5d-9e6f-0a1b2c3d4e5f';

let accounts: FakeAccounts;
let env: Env;
beforeEach(() => {
  accounts = fakeAccounts();
  accounts.accounts.set('user_ann', { name: 'Ann Smith', email: null });
  env = accounts.env as unknown as Env;
  vi.stubGlobal('fetch', accounts.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe('moveGuestAccountState', () => {
  it('fills the account’s gaps from the guest, keeping what the account has, then clears the guest', async () => {
    accounts.settings.set(`guest_${GUEST}`, {
      all: { reduceMotion: true, notifyTips: false },
      app: { mapSize: 'tall' },
      updatedAt: 1,
    });
    accounts.settings.set('user_ann', { all: { reduceMotion: false }, app: {}, updatedAt: 1 });
    accounts.profiles.set(`guest_${GUEST}`, {
      name: 'Otter',
      color: '#123',
      createdAt: 1,
      updatedAt: 1,
    });

    expect(await moveGuestAccountState(env, GUEST, 'user_ann')).toEqual({
      settings: 2,
      profile: true,
    });

    expect(accounts.settings.get('user_ann')).toMatchObject({
      all: { reduceMotion: false, notifyTips: false },
      app: { mapSize: 'tall' },
    });
    expect(accounts.settings.get(`guest_${GUEST}`)).toMatchObject({ all: {}, app: {} });
    // The account keeps its own name and takes the guest's colour, which it had none of.
    expect(accounts.profiles.get('user_ann')).toMatchObject({ name: null, color: '#123' });
    expect(accounts.profiles.get(`guest_${GUEST}`)).toMatchObject({ name: null, color: null });
  });

  it('gives a legacy guest’s name and colour to the signed id it upgrades to', async () => {
    accounts.profiles.set(`guest_${GUEST}`, {
      name: 'Otter',
      color: '#123',
      createdAt: 1,
      updatedAt: 1,
    });
    await moveGuestAccountState(env, GUEST, SIGNED);
    // Stamped now by the accounts Worker, never with the legacy id's date.
    expect(accounts.profiles.get(`guest_${SIGNED}`)).toMatchObject({
      name: 'Otter',
      color: '#123',
    });
    expect(accounts.profiles.get(`guest_${SIGNED}`)!.createdAt).toBeGreaterThan(1);
  });

  it('has nothing to give a second time', async () => {
    accounts.settings.set(`guest_${GUEST}`, { all: { reduceMotion: true }, app: {}, updatedAt: 1 });
    accounts.profiles.set(`guest_${GUEST}`, {
      name: 'Otter',
      color: null,
      createdAt: 1,
      updatedAt: 1,
    });
    await moveGuestAccountState(env, GUEST, 'user_ann');
    const writes = accounts.calls.filter((c) => c.path.endsWith('/write')).length;
    expect(await moveGuestAccountState(env, GUEST, 'user_ann')).toEqual({
      settings: 0,
      profile: false,
    });
    expect(accounts.calls.filter((c) => c.path.endsWith('/write'))).toHaveLength(writes);
  });

  it('does nothing without an accounts Worker, for the same id, or an id it cannot vouch for', async () => {
    for (const [e, from, to] of [
      [{} as Env, GUEST, 'user_ann'],
      [env, GUEST, GUEST],
      [env, 'owner', 'user_ann'],
    ] as const) {
      expect(await moveGuestAccountState(e, from, to)).toEqual({ settings: 0, profile: false });
    }
    expect(accounts.calls).toHaveLength(0);
  });

  it('throws when the accounts Worker cannot be reached, so the caller can log it', async () => {
    accounts.failing.set('settings/read', 500);
    await expect(moveGuestAccountState(env, GUEST, 'user_ann')).rejects.toThrow();
  });
});
