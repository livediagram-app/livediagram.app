import { describe, expect, it } from 'vitest';
import { AGENT_PRESENCE_MAX_TTL_MS, AGENT_PRESENCE_ROOM_MAX } from '@livediagram/api-schema';
import {
  agentPresenceKey,
  agentRosterFor,
  RoomAgentPresence,
  type AgentPresenceRecord,
  type AgentPresenceWrite,
} from './room-agent-presence';

function setup() {
  const stored = new Map<string, unknown>();
  const clock = { now: 1_000 };
  let ids = 0;
  const storage = {
    put: async (k: string, v: unknown) => void stored.set(k, v),
    delete: async (k: string) => stored.delete(k),
    list: async ({ prefix }: { prefix: string }) =>
      new Map([...stored].filter(([k]) => k.startsWith(prefix))),
  };
  const presence = new RoomAgentPresence(
    storage,
    () => clock.now,
    () => `ap${++ids}`,
  );
  return { stored, clock, presence, storage };
}

const write = (over: Partial<AgentPresenceWrite> = {}): AgentPresenceWrite => ({
  tokenId: 'tok_1',
  tabId: 't1',
  personTag: 'p-webber',
  shareCode: null,
  name: 'Webber',
  color: '#3b82f6',
  role: 'edit',
  status: 'adding payment service',
  focus: ['n3'],
  ttlMs: 30_000,
  mode: 'set',
  ...over,
});

describe('RoomAgentPresence', () => {
  it('sets an entry under its token and tab, and replaces status and focus on the next set', async () => {
    const { presence, stored } = setup();
    expect(await presence.write(write())).toEqual({
      ok: true,
      expiresAt: 31_000,
      created: true,
      broadcast: true,
    });
    expect(stored.get(agentPresenceKey('tok_1', 't1'))).toMatchObject({
      id: 'ap1',
      status: 'adding payment service',
    });
    await presence.write(write({ status: null, focus: [] }));
    expect(presence.live()).toEqual([
      expect.objectContaining({ id: 'ap1', status: null, focus: [] }),
    ]);
  });

  it('refreshes without broadcasting, keeping status, focus and a longer expiry; a refresh creates a bare entry', async () => {
    const { presence, clock } = setup();
    await presence.write(write({ ttlMs: 120_000 }));
    clock.now = 2_000;
    const refreshed = await presence.write(write({ mode: 'refresh', status: null, focus: [] }));
    expect(refreshed).toEqual({ ok: true, expiresAt: 121_000, created: false, broadcast: false });
    expect(presence.live()[0]).toMatchObject({
      status: 'adding payment service',
      focus: ['n3'],
      setAt: 1_000,
    });
    expect(await presence.write(write({ mode: 'refresh', name: 'Webber T' }))).toMatchObject({
      broadcast: true,
    });
    expect(await presence.write(write({ tabId: 't2', mode: 'refresh' }))).toMatchObject({
      created: true,
      broadcast: true,
    });
    expect(presence.live().find((r) => r.tabId === 't2')).toMatchObject({
      status: null,
      focus: [],
    });
  });

  it('caps the ttl and the number of entries a room holds', async () => {
    const { presence } = setup();
    expect(await presence.write(write({ ttlMs: AGENT_PRESENCE_MAX_TTL_MS * 10 }))).toMatchObject({
      expiresAt: 1_000 + AGENT_PRESENCE_MAX_TTL_MS,
    });
    for (let i = 1; i < AGENT_PRESENCE_ROOM_MAX; i += 1)
      await presence.write(write({ tokenId: `tok_x${i}` }));
    expect(await presence.write(write({ tokenId: 'tok_over' }))).toEqual({
      ok: false,
      error: 'agent_presence_full',
    });
    expect(await presence.write(write())).toMatchObject({ ok: true, created: false });
  });

  it('clears one entry, entries by a rule, and sweeps the expired', async () => {
    const { presence, clock, stored } = setup();
    await presence.write(write());
    await presence.write(write({ tokenId: 'tok_2', shareCode: 'CODE', ttlMs: 5_000 }));
    await presence.write(write({ tokenId: 'tok_3', ttlMs: 2_000 }));
    expect(presence.nextExpiry()).toBe(3_000);
    expect(await presence.clear('tok_1', 't1')).toBe(true);
    expect(await presence.clear('tok_1', 't1')).toBe(false);
    clock.now = 3_000;
    expect((await presence.sweep()).map((r) => r.tokenId)).toEqual(['tok_3']);
    expect(
      (await presence.clearWhere((r) => r.shareCode === 'CODE')).map((r) => r.tokenId),
    ).toEqual(['tok_2']);
    expect(presence.live()).toEqual([]);
    expect(presence.nextExpiry()).toBeNull();
    expect([...stored.keys()]).toEqual([]);
  });

  it('restores entries after a wake, dropping those that expired meanwhile', async () => {
    const first = setup();
    await first.presence.write(write());
    await first.presence.write(write({ tokenId: 'tok_2', ttlMs: 2_000 }));
    const woken = new RoomAgentPresence(
      first.storage,
      () => 4_000,
      () => 'never',
    );
    expect((await woken.restore()).map((r) => r.tokenId)).toEqual(['tok_2']);
    expect(woken.live().map((r) => r.id)).toEqual(['ap1']);
  });
});

describe('agentRosterFor', () => {
  const entry = (id: string, over: Partial<AgentPresenceRecord> = {}): AgentPresenceRecord => ({
    id,
    tokenId: `tok_${id}`,
    tabId: 't1',
    personTag: 'p-webber',
    shareCode: null,
    name: 'Webber',
    color: '#3b82f6',
    role: 'edit',
    status: null,
    focus: [],
    setAt: 1,
    expiresAt: 99,
    ...over,
  });
  const sessions = [
    { presenceId: 'pr-laptop', personTag: 'p-webber' },
    { presenceId: 'pr-ada', personTag: 'p-ada' },
    { presenceId: 'pr-guest', personTag: null },
  ];

  it('joins an agent to its owner’s other sessions, marks the owner’s own, and numbers persons', () => {
    const entries = [
      entry('b', { setAt: 2, status: 'drafting' }),
      entry('a'),
      entry('c', { personTag: 'p-sam', setAt: 3 }),
    ];
    const forAda = agentRosterFor(sessions[1]!, sessions, entries);
    expect(forAda.map((a) => [a.id, a.joins, a.self ?? false, a.person])).toEqual([
      ['a', ['pr-laptop'], false, 0],
      ['b', ['pr-laptop'], false, 0],
      ['c', [], false, 1],
    ]);
    expect(forAda[1]).toMatchObject({ status: 'drafting' });
    expect(forAda[0]).not.toHaveProperty('status');
    const forOwner = agentRosterFor(sessions[0]!, sessions, entries);
    expect(forOwner[0]).toMatchObject({ joins: [], self: true });
  });

  it('never leaks a person tag or token id, and keeps a tagless agent apart', () => {
    const roster = agentRosterFor(null, sessions, [
      entry('x', { personTag: null }),
      entry('y', { personTag: null }),
    ]);
    expect(roster.map((a) => [a.joins, a.self, a.person])).toEqual([
      [[], undefined, 0],
      [[], undefined, 1],
    ]);
    expect(JSON.stringify(roster)).not.toMatch(/p-webber|tok_/);
    expect(agentRosterFor(null, sessions, [])).toEqual([]);
  });
});
