import { describe, expect, it } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import {
  earliestRoomGrantDue,
  openRoomTicket,
  renewRoomGrant,
  roomGrantDueAt,
  roomGrantStep,
  roomTicketLevel,
  sealRoomTicket,
} from './room-ticket';

const claims = (item: string): GrantClaims => ({
  iss: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev',
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
const env = { INDEX_ORIGIN: 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev', INDEX_KEY: 'k'.repeat(32) };

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

describe("a session's grant in the room", () => {
  const ASK = 30_000;

  it('holds a workbench ticket to its cap', () => {
    expect(
      roomTicketLevel({ claims: claims('d1'), workbench: { pairing: 'p', cap: 'view' } }),
    ).toBe('view');
    expect(roomTicketLevel({ claims: claims('d1'), workbench: null })).toBe('edit');
    expect(
      roomTicketLevel({
        claims: { ...claims('d1'), level: 'participate' },
        workbench: { pairing: 'p', cap: 'edit' },
      }),
    ).toBe('participate');
  });

  it('asks before the grant lapses, then closes at the lapse', () => {
    const hold = { grantExp: 100_000 };
    expect(roomGrantDueAt(hold, ASK)).toBe(70_000);
    expect(roomGrantStep(hold, 60_000, ASK)).toBeNull();
    expect(roomGrantStep(hold, 70_000, ASK)).toBe('ask');
    expect(roomGrantDueAt({ ...hold, renewAsked: true }, ASK)).toBe(100_000);
    expect(roomGrantStep({ ...hold, renewAsked: true }, 80_000, ASK)).toBeNull();
    expect(roomGrantStep({ ...hold, renewAsked: true }, 100_000, ASK)).toBe('lapsed');
    expect(roomGrantStep(null, 100_000, ASK)).toBeNull();
    expect(roomGrantStep({}, 100_000, ASK)).toBeNull();
  });

  it('finds the earliest due among sessions', () => {
    expect(earliestRoomGrantDue([], ASK)).toBeNull();
    expect(
      earliestRoomGrantDue(
        [{ grantExp: 100_000 }, null, { grantExp: 90_000, renewAsked: true }],
        ASK,
      ),
    ).toBe(70_000);
  });

  it('renews a grant that says the same, and ends a session whose access changed', async () => {
    const held = { level: 'edit' as const, tab: null };
    expect(await renewRoomGrant(service, env, 'grant-for-d1', 'd1', held)).toEqual({
      kind: 'renewed',
      grantExp: 9_999_999_999_000,
      claims: claims('d1'),
    });
    expect(
      await renewRoomGrant(service, env, 'grant-for-d1', 'd1', { level: 'view', tab: null }),
    ).toEqual({
      kind: 'changed',
      level: 'edit',
      tab: null,
    });
    expect(
      await renewRoomGrant(service, env, 'grant-for-d1', 'd1', { level: 'edit', tab: 't1' }),
    ).toMatchObject({
      kind: 'changed',
    });
  });

  it('ignores anything that is not a good grant for this item', async () => {
    const held = { level: 'edit' as const, tab: null };
    expect(await renewRoomGrant(service, env, 'grant-for-d2', 'd1', held)).toEqual({
      kind: 'invalid',
    });
    expect(await renewRoomGrant(service, env, 42, 'd1', held)).toEqual({ kind: 'invalid' });
    expect(await renewRoomGrant(service, env, 'x'.repeat(9000), 'd1', held)).toEqual({
      kind: 'invalid',
    });
  });
});
