import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_PUT_AWAY_HEADER } from '@liveworkspace/index-app';
import { DOC, identityOf, roomWorld, type RoomWorld } from './automations/test-automation-world';

// Work Tracker 1323 (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Where an item stands"): an API
// token's grant is kept by the worker until a minute before it lapses, so the design's room, which hears the index's
// standing call, refuses a grant signed before the design was archived or trashed, and refuses nothing once it is back.

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// The token's grant, signed a minute ago and kept by its worker since.
const signedAt = Date.now() - 60_000;
function asToken(w: RoomWorld, method: string, body?: unknown): Promise<Response> {
  const identity = identityOf({ token: {} });
  return w.room.route(
    DOC,
    new Request(`https://api.test/api/designs/${DOC}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    {
      ...identity,
      grant: { ...identity.grant!, iat: Math.floor(signedAt / 1000), iatMs: signedAt },
    },
  );
}

describe('a grant from before the design was put away', () => {
  it('is refused 409 archived, then as trashed, and let through once it is back', async () => {
    const w = roomWorld();
    await w.create();
    expect((await asToken(w, 'GET')).status).toBe(200);

    await w.room.takeStanding(DOC, { archived: true, trashed: false, at: signedAt + 1_000 });
    const read = await asToken(w, 'GET');
    expect(read.status).toBe(409);
    expect(await read.json()).toEqual({ error: 'archived' });
    expect(read.headers.get(ITEM_PUT_AWAY_HEADER)).toBe('archived');
    expect((await asToken(w, 'PUT', { name: 'Changed' })).status).toBe(409);
    // The room-ticket door's question: the same grant, and one signed since.
    expect(await w.room.standingRefusal(DOC, { iatMs: signedAt })).toBe('archived');
    expect(await w.room.standingRefusal(DOC, { iatMs: signedAt + 2_000 })).toBeNull();

    await w.room.takeStanding(DOC, { archived: false, trashed: true, at: signedAt + 3_000 });
    const trashed = await asToken(w, 'GET');
    expect(trashed.status).toBe(410);
    expect(await trashed.json()).toEqual({ error: 'design_trashed' });
    expect(trashed.headers.get(ITEM_PUT_AWAY_HEADER)).toBe('trashed');

    await w.room.takeStanding(DOC, { archived: false, trashed: false, at: signedAt + 4_000 });
    expect((await asToken(w, 'GET')).status).toBe(200);
    expect(await w.room.standingRefusal(DOC, { iatMs: signedAt })).toBeNull();
  });
});
