import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Characterisation tests for handleParticipants (spec/04). GET is
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
  },
}));
vi.mock('../db', () => db);

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
  });

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('handleParticipants', () => {
  it('GET is open and returns the participant', async () => {
    db.getParticipant.mockResolvedValue({ id: 'p1', name: 'Ann', color: '#fff', createdAt: 0 });
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
