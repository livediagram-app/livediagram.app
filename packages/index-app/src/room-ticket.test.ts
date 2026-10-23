import { describe, expect, it } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { openRoomTicket, sealRoomTicket } from './room-ticket';

const claims = (item: string): GrantClaims => ({
  iss: 'https://liveworkspace.app',
  aud: 'livediagram',
  sub: 'user_1',
  item,
  level: 'edit',
  tab: null,
  team: null,
  iat: 0,
  exp: 9_999_999_999,
  jti: 'j1',
});

// A verifier that takes `grant-for-<item>` as a good grant for that item.
const service = {
  verifyGrant: async (_env: unknown, token: string | null | undefined, itemId: string) =>
    token === `grant-for-${itemId}` ? claims(itemId) : null,
};
const env = { INDEX_ORIGIN: 'https://liveworkspace.app', INDEX_KEY: 'k'.repeat(32) };

describe('room tickets', () => {
  it('is the grant itself for everyone but a workbench session', async () => {
    const ticket = await sealRoomTicket(env, 'grant-for-d1', null);
    expect(ticket).toBe('grant-for-d1');
    expect(await openRoomTicket(service, env, ticket, 'd1')).toEqual({
      claims: claims('d1'),
      grant: 'grant-for-d1',
      workbench: null,
    });
  });

  it("seals a workbench session's pairing and cap to the grant", async () => {
    const ticket = await sealRoomTicket(env, 'grant-for-d1', { pairing: 'p1', cap: 'view' });
    const opened = await openRoomTicket(service, env, ticket, 'd1');
    expect(opened?.workbench).toEqual({ pairing: 'p1', cap: 'view' });
  });

  it('refuses a raised cap, another pairing or another key', async () => {
    const ticket = await sealRoomTicket(env, 'grant-for-d1', { pairing: 'p1', cap: 'view' });
    const [grant, , , mac] = ticket.split('~');
    expect(await openRoomTicket(service, env, `${grant}~p1~edit~${mac}`, 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, `${grant}~p2~view~${mac}`, 'd1')).toBeNull();
    expect(await openRoomTicket(service, { ...env, INDEX_KEY: 'other' }, ticket, 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, `${grant}~p1~boss~${mac}`, 'd1')).toBeNull();
  });

  it('refuses a grant for another item, a malformed ticket and none at all', async () => {
    expect(await openRoomTicket(service, env, 'grant-for-d2', 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, 'a~b', 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, null, 'd1')).toBeNull();
  });

  it('cannot seal without the app key', async () => {
    await expect(
      sealRoomTicket({}, 'grant-for-d1', { pairing: 'p1', cap: 'edit' }),
    ).rejects.toThrow();
  });
});
