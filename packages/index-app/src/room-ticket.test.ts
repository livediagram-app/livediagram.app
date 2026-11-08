import { describe, expect, it } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import {
  earliestRoomGrantDue,
  openRoomSockets,
  openRoomTicket,
  renewRoomGrant,
  roomGrantDueAt,
  roomGrantStep,
  roomTicketLevel,
  sealRoomTicket,
} from './room-ticket';

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

  it('never shows a workbench session the grant, so it cannot be stripped and used bare', async () => {
    // A pairing long enough that random ciphertext can't contain it by chance: a two-letter 'p1' turned up
    // in 439 of 20,000 sealed tickets (2.2%) and failed main's CI.
    const pairing = 'pairing-for-d1';
    const ticket = await sealRoomTicket(env, 'grant-for-d1', { pairing, cap: 'view' });
    expect(ticket.startsWith('rt2~')).toBe(true);
    expect(ticket).not.toContain('grant-for-d1');
    expect(ticket).not.toContain(pairing);
    // Every piece a client could cut out of it is refused.
    for (const part of ticket.split(/[~.]/)) {
      expect(await openRoomTicket(service, env, part, 'd1')).toBeNull();
    }
    // Sealed twice, never alike: a fresh IV each time.
    expect(await sealRoomTicket(env, 'grant-for-d1', { pairing, cap: 'view' })).not.toBe(ticket);
  });

  it('refuses a tampered ticket, another key, or the old readable shape', async () => {
    const ticket = await sealRoomTicket(env, 'grant-for-d1', { pairing: 'p1', cap: 'view' });
    const body = ticket.slice('rt2~'.length);
    for (let i = 0; i < body.length; i += 7) {
      const flipped = `rt2~${body.slice(0, i)}${body[i] === 'A' ? 'B' : 'A'}${body.slice(i + 1)}`;
      expect(await openRoomTicket(service, env, flipped, 'd1')).toBeNull();
    }
    expect(await openRoomTicket(service, env, `rt2~${body.slice(0, -2)}`, 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, 'rt2~', 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, 'rt2~AAAA', 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, 'rt2~!!!', 'd1')).toBeNull();
    expect(await openRoomTicket(service, { ...env, INDEX_KEY: 'other' }, ticket, 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, ticket, 'd1')).not.toBeNull();
    expect(await openRoomTicket(service, { INDEX_ORIGIN: env.INDEX_ORIGIN }, ticket, 'd1')).toBe(
      null,
    );
    // The v1 shape showed the grant beside an HMAC: no longer a ticket at all.
    expect(
      await openRoomTicket(service, env, `grant-for-d1~p1~edit~${'0'.repeat(64)}`, 'd1'),
    ).toBeNull();
  });

  it('refuses sealed facts that are not a grant, a pairing and a level', async () => {
    // Sealed by the same key, but not by sealRoomTicket: a cap that is not a level.
    const odd = await sealRoomTicket(env, 'grant-for-d1', {
      pairing: 'p1',
      cap: 'boss' as unknown as 'view',
    });
    expect(await openRoomTicket(service, env, odd, 'd1')).toBeNull();
  });

  it('seals for another item only that item', async () => {
    const ticket = await sealRoomTicket(env, 'grant-for-d2', { pairing: 'p1', cap: 'edit' });
    expect(await openRoomTicket(service, env, ticket, 'd1')).toBeNull();
    expect((await openRoomTicket(service, env, ticket, 'd2'))?.workbench).toEqual({
      pairing: 'p1',
      cap: 'edit',
    });
  });

  it('derives the sealing key again when the app key changes', async () => {
    const other = { ...env, INDEX_KEY: 'j'.repeat(32) };
    const a = await sealRoomTicket(env, 'grant-for-d1', { pairing: 'p1', cap: 'view' });
    const b = await sealRoomTicket(other, 'grant-for-d1', { pairing: 'p1', cap: 'view' });
    expect(await openRoomTicket(service, other, b, 'd1')).not.toBeNull();
    expect(await openRoomTicket(service, other, a, 'd1')).toBeNull();
    expect(await openRoomTicket(service, env, a, 'd1')).not.toBeNull();
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

  it('watches only open sockets, so a closed one left listed never re-arms the alarm', () => {
    const open = { readyState: 1, grantExp: 100_000 };
    const closing = { readyState: 2, grantExp: 1 };
    const closed = { readyState: 3, grantExp: 1 };
    const connecting = { readyState: 0, grantExp: 1 };
    const live = openRoomSockets([closing, open, closed, connecting]);
    expect(live).toEqual([open]);
    // The lapsed grant of the closing socket would put the alarm in the past, every time it rang.
    expect(earliestRoomGrantDue(live, ASK)).toBe(70_000);
    expect(openRoomSockets([])).toEqual([]);
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

  it('renews a workbench session only with a ticket sealed to its own pairing, held to its cap', async () => {
    const held = { level: 'view' as const, tab: null, pairing: 'p1' };
    const sealed = await sealRoomTicket(env, 'grant-for-d1', { pairing: 'p1', cap: 'view' });
    expect(await renewRoomGrant(service, env, sealed, 'd1', held)).toMatchObject({
      kind: 'renewed',
    });
    // The owner's bare grant (edit) on a view session: the session ends, it never rises to edit.
    expect(await renewRoomGrant(service, env, 'grant-for-d1', 'd1', held)).toEqual({
      kind: 'changed',
      level: 'edit',
      tab: null,
    });
    // A bare grant at the very level held still ends it: it would drop the pairing.
    expect(
      await renewRoomGrant(service, env, 'grant-for-d1', 'd1', { ...held, level: 'edit' }),
    ).toMatchObject({ kind: 'changed' });
    // Another pairing's ticket ends it too.
    const other = await sealRoomTicket(env, 'grant-for-d1', { pairing: 'p2', cap: 'view' });
    expect(await renewRoomGrant(service, env, other, 'd1', held)).toMatchObject({
      kind: 'changed',
    });
    // And a session opened without a pairing is not renewed into one.
    expect(
      await renewRoomGrant(service, env, sealed, 'd1', { level: 'view', tab: null }),
    ).toMatchObject({ kind: 'changed' });
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
