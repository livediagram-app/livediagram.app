import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Characterisation tests for handleParticipants (docs/specs/014-identity/auth-and-guest-access.md). GET is
// deliberately open (ids + display fields already leak through the WS
// room / change-log). PUT is the security-sensitive path: it must reject
// an unauthenticated caller (400) and, critically, a caller trying to
// rewrite a participant id that isn't their own resolved owner (403) —
// the impersonation guard, since change-log rows store name + colour
// denormalised at write time.

const { db } = vi.hoisted(() => ({
  db: {
    getParticipant: vi.fn(),
    upsertParticipant: vi.fn(),
    setParticipantPicture: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleParticipants } from './participants';

// Guest-shaped context: resolveOwner yields 'owner-1' unless overridden.
const makeCtx = (
  method: string,
  path: string,
  opts: {
    owner?: string | null;
    body?: unknown;
    clerkUserId?: string | null;
    verifiedUserId?: string | null;
  } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
    clerkUserId: opts.clerkUserId ?? null,
    ...(opts.verifiedUserId !== undefined ? { verifiedUserId: opts.verifiedUserId } : {}),
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
      pictureUrl: null,
    });
    const res = await handleParticipants(makeCtx('GET', '/api/participants/p1', { owner: null }));
    expect(res.status).toBe(200);
  });

  it('GET 404 for an unknown participant', async () => {
    db.getParticipant.mockResolvedValue(null);
    const res = await handleParticipants(makeCtx('GET', '/api/participants/p9'));
    expect(res.status).toBe(404);
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
    expect(db.upsertParticipant).not.toHaveBeenCalled();
  });

  it('PUT 400 on missing name/color', async () => {
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/owner-1', { owner: 'owner-1', body: { name: '' } }),
    );
    expect(res.status).toBe(400);
  });

  it('PUT 200 when the caller updates their own participant', async () => {
    db.getParticipant.mockResolvedValue(null);
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/owner-1', {
        owner: 'owner-1',
        body: { name: 'Ann', color: '#abc' },
      }),
    );
    expect(res.status).toBe(200);
    expect(db.upsertParticipant).toHaveBeenCalled();
  });
});

// The published profile picture (docs/specs/014-identity/profile-picture.md §6).
describe('participant pictures', () => {
  const PICTURE = 'https://img.clerk.com/eyJ0eXBlIjoicHJveHkifQ?width=96&height=96&fit=crop';
  const row = { id: 'user_ann', name: 'Ann', color: '#fff', createdAt: 0, pictureUrl: PICTURE };

  it('GET hides the picture from a caller who is not signed in', async () => {
    db.getParticipant.mockResolvedValue(row);
    const res = await handleParticipants(
      makeCtx('GET', '/api/participants/user_ann', { owner: 'guest-1' }),
    );
    const body = (await res.json()) as { participant: { pictureUrl: string | null } };
    expect(body.participant.pictureUrl).toBeNull();
  });

  it('GET shows the picture to a signed-in caller', async () => {
    db.getParticipant.mockResolvedValue(row);
    const res = await handleParticipants(
      makeCtx('GET', '/api/participants/user_ann', { clerkUserId: 'user_bob' }),
    );
    const body = (await res.json()) as { participant: { pictureUrl: string | null } };
    expect(body.participant.pictureUrl).toBe(PICTURE);
  });

  it('PUT picture sets it for the participant own Clerk session', async () => {
    db.setParticipantPicture.mockResolvedValue(true);
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/user_ann/picture', {
        clerkUserId: 'user_ann',
        body: { pictureUrl: PICTURE },
      }),
    );
    expect(res.status).toBe(200);
    expect(db.setParticipantPicture).toHaveBeenCalledWith(expect.anything(), 'user_ann', PICTURE);
  });

  it('PUT picture clears it with null', async () => {
    db.setParticipantPicture.mockResolvedValue(true);
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/user_ann/picture', {
        clerkUserId: 'user_ann',
        body: { pictureUrl: null },
      }),
    );
    expect(res.status).toBe(200);
    expect(db.setParticipantPicture).toHaveBeenCalledWith(expect.anything(), 'user_ann', null);
  });

  it('PUT picture refuses a guest, an API token and another account', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const guest = await handleParticipants(
      makeCtx('PUT', '/api/participants/owner-1/picture', { body: { pictureUrl: PICTURE } }),
    );
    expect(guest.status).toBe(401);
    const token = await handleParticipants(
      makeCtx('PUT', '/api/participants/user_ann/picture', {
        verifiedUserId: 'user_ann',
        body: { pictureUrl: PICTURE },
      }),
    );
    expect(token.status).toBe(401);
    const other = await handleParticipants(
      makeCtx('PUT', '/api/participants/user_ann/picture', {
        clerkUserId: 'user_eve',
        body: { pictureUrl: PICTURE },
      }),
    );
    expect(other.status).toBe(403);
    expect(db.setParticipantPicture).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('[profile-picture] rejected', 'not_account');
  });

  it('PUT picture refuses a URL that is not on Clerk image host', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    for (const pictureUrl of ['https://evil.example/x.png', 'http://img.clerk.com/x', 42]) {
      const res = await handleParticipants(
        makeCtx('PUT', '/api/participants/user_ann/picture', {
          clerkUserId: 'user_ann',
          body: { pictureUrl },
        }),
      );
      expect(res.status).toBe(400);
    }
    expect(db.setParticipantPicture).not.toHaveBeenCalled();
  });

  it('PUT picture 404s before the participant row exists', async () => {
    db.setParticipantPicture.mockResolvedValue(false);
    const res = await handleParticipants(
      makeCtx('PUT', '/api/participants/user_ann/picture', {
        clerkUserId: 'user_ann',
        body: { pictureUrl: PICTURE },
      }),
    );
    expect(res.status).toBe(404);
  });
});
