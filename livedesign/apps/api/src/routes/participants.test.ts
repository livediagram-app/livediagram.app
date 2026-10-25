import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __forgetProfiles } from '../accounts/profiles';
import { fakeAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import type { RouteContext } from './context';
import { handleParticipants } from './participants';
import { makeTestRouteContext } from './test-route-context';

// handleParticipants (docs/specs/014-identity/auth-and-guest-access.md "Identity display name"), against a
// stand-in for the liveworkspace accounts Worker, which keeps every person's profile. GET is deliberately
// open (ids + display fields already leak through the WS room). PUT is the security-sensitive path: it must
// reject an unauthenticated caller (400) and, critically, a caller trying to rewrite an id that isn't their
// own resolved owner (403): the impersonation guard, since a profile's name + colour shows in every app.

const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const OTHER = '7d2c1b8e-3f4a-4c5d-9e6f-0a1b2c3d4e5f';

let accounts: FakeAccounts;
beforeEach(() => {
  __forgetProfiles();
  accounts = fakeAccounts();
  vi.stubGlobal('fetch', accounts.fetch);
});
afterEach(() => vi.unstubAllGlobals());

const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null; body?: unknown; env?: Partial<Env> } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    owner: opts.owner === undefined ? GUEST : opts.owner,
    accountUserId: null,
    env: (opts.env ?? accounts.env) as Env,
  });

describe('GET /api/participants/:id', () => {
  it('is open, and answers the profile with its colour', async () => {
    accounts.profiles.set(`guest_${OTHER}`, {
      name: 'Ann',
      color: '#abc',
      createdAt: 5,
      updatedAt: 5,
    });
    const res = await handleParticipants(
      makeCtx('GET', `/api/participants/${OTHER}`, { owner: null }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      participant: { id: OTHER, name: 'Ann', color: '#abc', createdAt: 5 },
    });
    expect(accounts.callsTo('profiles/read')[0]!.body).toEqual({ ids: [`guest_${OTHER}`] });
  });

  it('answers an account that set nothing with its account name and the default colour', async () => {
    accounts.accounts.set('user_ann', { name: 'Ann Smith', email: 'ann@example.com' });
    const res = await handleParticipants(makeCtx('GET', '/api/participants/user_ann'));
    expect(await res.json()).toMatchObject({
      participant: { id: 'user_ann', name: 'Ann Smith', color: '#0ea5e9' },
    });
  });

  it('404s an unknown id, naming why', async () => {
    const res = await handleParticipants(makeCtx('GET', `/api/participants/${OTHER}`));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'participant_not_found' });
  });

  // docs/specs/015-api/api.md: a caller's own profile not saved yet is expected state, not an error.
  it('answers null for the caller’s own id before they set anything, an account included', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    let res = await handleParticipants(makeCtx('GET', `/api/participants/${GUEST}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ participant: null });
    accounts.accounts.set('user_ann', { name: 'Ann Smith', email: null });
    res = await handleParticipants(
      makeCtx('GET', '/api/participants/user_ann', { owner: 'user_ann' }),
    );
    expect(await res.json()).toEqual({ participant: null });
    expect(info).toHaveBeenCalledWith('[participants] self_absent');
    info.mockRestore();
  });

  it('answers 503 when the accounts Worker cannot be reached, never "no profile"', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.failing.set('profiles/read', 500);
    const res = await handleParticipants(makeCtx('GET', `/api/participants/${GUEST}`));
    expect(res.status).toBe(503);
    warn.mockRestore();
  });

  it('remembers a profile for a minute, so a second read asks nobody', async () => {
    accounts.profiles.set(`guest_${OTHER}`, {
      name: 'Ann',
      color: '#abc',
      createdAt: 5,
      updatedAt: 5,
    });
    await handleParticipants(makeCtx('GET', `/api/participants/${OTHER}`));
    await handleParticipants(makeCtx('GET', `/api/participants/${OTHER}`));
    expect(accounts.callsTo('profiles/read')).toHaveLength(1);
  });

  it('has no stored profiles without an accounts Worker', async () => {
    const res = await handleParticipants(makeCtx('GET', `/api/participants/${GUEST}`, { env: {} }));
    expect(await res.json()).toEqual({ participant: null });
    expect(accounts.calls).toHaveLength(0);
  });
});

describe('PUT /api/participants/:id', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleParticipants(
      makeCtx('PUT', `/api/participants/${GUEST}`, {
        owner: null,
        body: { name: 'X', color: '#000' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('403 when the caller is not the participant (impersonation guard)', async () => {
    const res = await handleParticipants(
      makeCtx('PUT', `/api/participants/${OTHER}`, { body: { name: 'X', color: '#000' } }),
    );
    expect(res.status).toBe(403);
    expect(accounts.calls).toHaveLength(0);
  });

  it('400 on a missing, non-string or unsafe name or colour', async () => {
    for (const body of [
      { name: '' },
      { name: {}, color: '#abc' },
      { name: 'Ann', color: 7 },
      { name: 'Ann', color: 'red),url(//tracker.example/x),linear-gradient(red' },
      { name: 'x'.repeat(121), color: '#abc' },
    ]) {
      const res = await handleParticipants(makeCtx('PUT', `/api/participants/${GUEST}`, { body }));
      expect(res.status).toBe(400);
    }
    expect(accounts.calls).toHaveLength(0);
  });

  it('sets a guest’s own name and colour on their profile', async () => {
    const res = await handleParticipants(
      makeCtx('PUT', `/api/participants/${GUEST}`, { body: { name: 'Ann', color: '#abc' } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      participant: { id: GUEST, name: 'Ann', color: '#abc' },
    });
    expect(accounts.callsTo('profiles/write')[0]!.body).toEqual({
      owner: `guest_${GUEST}`,
      name: 'Ann',
      color: '#abc',
    });
  });

  it('leaves an account’s name unset when the editor sends the account’s own name', async () => {
    accounts.accounts.set('user_ann', { name: 'Ann Smith', email: null });
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/user_ann', {
        owner: 'user_ann',
        body: { name: 'Ann Smith', color: '#abc' },
      }),
    );
    expect(res.status).toBe(200);
    expect(accounts.callsTo('profiles/write')[0]!.body).toEqual({
      owner: 'user_ann',
      color: '#abc',
    });
    // Nothing changed: nothing written.
    await handleParticipants(
      makeCtx('PUT', '/api/participants/user_ann', {
        owner: 'user_ann',
        body: { name: 'Ann Smith', color: '#abc' },
      }),
    );
    expect(accounts.callsTo('profiles/write')).toHaveLength(1);
  });

  it('passes on the accounts Worker’s refusal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/user_gone', {
        owner: 'user_gone',
        body: { name: 'Ann', color: '#abc' },
      }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown_owner' });
    warn.mockRestore();
  });

  it('answers 503 when the accounts Worker cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.failing.set('profiles/read', 500);
    const res = await handleParticipants(
      makeCtx('PUT', `/api/participants/${GUEST}`, { body: { name: 'Ann', color: '#abc' } }),
    );
    expect(res.status).toBe(503);
    expect(accounts.callsTo('profiles/write')).toHaveLength(0);
    warn.mockRestore();
  });

  it('answers what was sent without an accounts Worker, keeping nothing', async () => {
    const res = await handleParticipants(
      makeCtx('PUT', `/api/participants/${GUEST}`, {
        env: {},
        body: { name: 'Ann', color: '#abc' },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ participant: { id: GUEST, name: 'Ann' } });
    expect(accounts.calls).toHaveLength(0);
  });
});
