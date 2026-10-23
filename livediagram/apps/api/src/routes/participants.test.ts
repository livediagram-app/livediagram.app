import { ProfileError } from '@liveworkspace/auth-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestRouteContext } from './test-route-context';

// Characterisation tests for handleParticipants (docs/specs/014-identity/auth-and-guest-access.md). GET is
// deliberately open (ids + display fields already leak through the WS
// room). PUT is the security-sensitive path: it must reject
// an unauthenticated caller (400) and, critically, a caller trying to
// rewrite a participant id that isn't their own resolved owner (403) —
// the impersonation guard, since a participant's name + colour shows
// across every document they collaborate on.

const { db } = vi.hoisted(() => ({
  db: {
    getParticipant: vi.fn(),
    setParticipant: vi.fn(),
  },
}));
vi.mock('../liveworkspace/profiles', () => db);

import type { RouteContext } from './context';
import { handleParticipants } from './participants';

// Guest-shaped context: resolveOwner yields 'owner-1' unless overridden.
const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null; body?: unknown } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
    accountUserId: null,
  });

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('handleParticipants', () => {
  it('GET is open and returns the participant', async () => {
    db.getParticipant.mockResolvedValue({
      id: 'p1',
      name: 'Ann',
      color: '#fff',
      createdAt: 0,
    });
    const res = await handleParticipants(makeCtx('GET', '/api/participants/p1', { owner: null }));
    expect(res.status).toBe(200);
  });

  it('GET 404 for an unknown participant', async () => {
    db.getParticipant.mockResolvedValue(null);
    const res = await handleParticipants(makeCtx('GET', '/api/participants/p9'));
    expect(res.status).toBe(404);
  });

  // docs/specs/015-api/api.md: a caller's own profile not saved yet is expected state, not an error.
  it('GET answers null for the caller own id before a profile is saved', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    db.getParticipant.mockResolvedValue(null);
    const res = await handleParticipants(makeCtx('GET', '/api/participants/owner-1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ participant: null });
    expect(info).toHaveBeenCalledWith('[participants] self_absent');
  });

  it('GET still 404s an absent id that is not the caller, signed out or as someone else', async () => {
    db.getParticipant.mockResolvedValue(null);
    for (const owner of [null, 'owner-2']) {
      const res = await handleParticipants(makeCtx('GET', '/api/participants/owner-1', { owner }));
      expect(res.status).toBe(404);
    }
  });

  it('PUT 400 when no owner resolves', async () => {
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/p1', { owner: null, body: { name: 'X', color: '#000' } }),
    );
    expect(res.status).toBe(400);
  });

  it('PUT 403 when the caller is not the participant (impersonation guard)', async () => {
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/victim', {
        owner: 'attacker',
        body: { name: 'X', color: '#000' },
      }),
    );
    expect(res.status).toBe(403);
    expect(db.setParticipant).not.toHaveBeenCalled();
  });

  it('PUT 400 on missing name/color', async () => {
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/owner-1', { owner: 'owner-1', body: { name: '' } }),
    );
    expect(res.status).toBe(400);
  });

  it('PUT 400 on a name or colour that is not a string, or a colour that could load something', async () => {
    for (const body of [
      { name: {}, color: '#abc' },
      { name: 'Ann', color: 7 },
      { name: 'Ann', color: 'red),url(//tracker.example/x),linear-gradient(red' },
    ]) {
      const res = await handleParticipants(
        makeCtx('PUT', '/api/participants/owner-1', { owner: 'owner-1', body }),
      );
      expect(res.status).toBe(400);
    }
    expect(db.setParticipant).not.toHaveBeenCalled();
  });

  it('PUT 200 when the caller updates their own participant, kept by liveworkspace', async () => {
    db.setParticipant.mockResolvedValue({
      id: 'owner-1',
      name: 'Ann',
      color: '#abc',
      createdAt: 5,
    });
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/owner-1', {
        owner: 'owner-1',
        body: { name: 'Ann', color: '#abc' },
      }),
    );
    expect(res.status).toBe(200);
    expect(db.setParticipant).toHaveBeenCalledWith(expect.anything(), 'owner-1', {
      name: 'Ann',
      color: '#abc',
    });
    expect(await res.json()).toEqual({
      participant: { id: 'owner-1', name: 'Ann', color: '#abc', createdAt: 5 },
    });
  });

  it('PUT echoes the values when this deployment keeps no profiles (guest-only)', async () => {
    db.setParticipant.mockResolvedValue(null);
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/owner-1', {
        owner: 'owner-1',
        body: { name: 'Ann', color: '#abc' },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ participant: { id: 'owner-1', name: 'Ann' } });
  });

  it('PUT 400 when liveworkspace refuses the values', async () => {
    db.setParticipant.mockRejectedValue(new ProfileError(400, 'invalid_name'));
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/owner-1', {
        owner: 'owner-1',
        body: { name: 'Ann', color: '#abc' },
      }),
    );
    expect(res.status).toBe(400);
  });
});
