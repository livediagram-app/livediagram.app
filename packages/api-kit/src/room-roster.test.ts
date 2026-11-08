import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { agentRosterFor, type AgentPresenceRecord } from './room-agent-presence';
import { helloChangesRoster, rosterFrames, type RosterEntry } from './room-roster';

type Presence = {
  id: string;
  name: string;
  color: string;
  role?: 'edit' | 'view';
  tabId?: string;
  key?: string;
  picture?: string;
};
type Entry = RosterEntry<Presence, object>;

const person = (id: string): Presence => ({ id, name: id, color: '#000' });
const entry = (presence: Presence | null, personTag: string | null = null): Entry => ({
  ws: {},
  presence,
  personTag,
});
const parsed = (entries: readonly Entry[], agents: readonly AgentPresenceRecord[] = []) =>
  [...rosterFrames(entries, agents)].map(
    (f) => JSON.parse(f.frame) as { kind: string; participants: Presence[]; agents: unknown[] },
  );

// The frames as the rooms built them before the roster serialised each entry once: a participants array and an
// agents array per socket, stringified whole. The new frames must parse to exactly these.
function framesBefore(entries: readonly Entry[], agentEntries: readonly AgentPresenceRecord[]) {
  const sessions = entries.flatMap(({ presence, personTag }) =>
    presence ? [{ presenceId: presence.id, personTag }] : [],
  );
  return entries.map(({ ws, presence: self, personTag, account }) => {
    const agents = agentRosterFor(
      self ? { presenceId: self.id, personTag } : null,
      sessions,
      agentEntries,
    );
    const participants: Presence[] = [];
    for (const { ws: peer, presence } of entries) {
      if (peer === ws || !presence) continue;
      if (account || presence.picture === undefined) participants.push(presence);
      else {
        const { picture: _hidden, ...withoutPicture } = presence;
        participants.push(withoutPicture);
      }
    }
    return JSON.stringify({ kind: 'presence', participants, agents });
  });
}

const PICTURE = 'https://lh3.googleusercontent.com/a/ACg8ocAda=s96-c';

// A full room: 100 sockets (the room cap), half of them accounts, half with pictures, a few not yet hello'd.
function fullRoom(): Entry[] {
  return Array.from({ length: 100 }, (_, i) =>
    i % 17 === 5
      ? entry(null, `person-${i}`)
      : {
          ...entry(
            {
              id: `presence-${i}`,
              name: `Person ${i}`,
              color: '#a1b2c3',
              role: i % 3 === 0 ? 'view' : 'edit',
              tabId: `tab-${i % 4}`,
              key: `key-${i}`,
              ...(i % 2 === 0 ? { picture: PICTURE } : {}),
            },
            i % 10 === 0 ? null : `person-${i % 40}`,
          ),
          account: i % 4 < 2,
        },
  );
}

function agent(i: number, personTag: string | null): AgentPresenceRecord {
  return {
    id: `agent-${i}`,
    tokenId: `token-${i}`,
    tabId: 'tab-0',
    personTag,
    shareCode: null,
    name: `Agent ${i}`,
    color: '#123456',
    role: 'edit',
    status: i % 2 ? 'Reading' : null,
    focus: [`el-${i}`],
    setAt: 1000 - i,
    expiresAt: 10_000,
  };
}

describe('rosterFrames', () => {
  it('sends each socket everyone but itself, and nobody who has not said hello', () => {
    const frames = parsed([entry(person('a')), entry(person('b')), entry(null)]);
    expect(frames.map((f) => f.participants.map((p) => p.id))).toEqual([['b'], ['a'], ['a', 'b']]);
    expect(frames.every((f) => f.kind === 'presence' && f.agents.length === 0)).toBe(true);
  });

  // liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures": only an account session is sent others' pictures.
  it('strips pictures from the roster a guest or link visitor is sent, and keeps them for an account', () => {
    const ada = { ...entry({ ...person('ada'), picture: PICTURE }), account: true };
    const bea = { ...entry(person('bea')), account: true };
    const guest = entry(person('guest'));
    const [, toBea, toGuest] = [...rosterFrames([ada, bea, guest], [])];
    const seen = (frame: string) =>
      (JSON.parse(frame) as { participants: Presence[] }).participants.find((p) => p.id === 'ada');
    expect(seen(toBea!.frame)?.picture).toBe(PICTURE);
    expect(seen(toGuest!.frame)).toEqual(person('ada'));
    expect(toGuest!.frame).not.toContain('googleusercontent');
  });

  it('parses to exactly the frames a full room was sent before, with and without agents', () => {
    const room = fullRoom();
    const agents = [agent(0, 'person-1'), agent(1, null), agent(2, 'person-3'), agent(3, 'nobody')];
    for (const agentEntries of [[], agents]) {
      const before = framesBefore(room, agentEntries);
      const now = [...rosterFrames(room, agentEntries)];
      expect(now.map((f) => f.ws)).toEqual(room.map((e) => e.ws));
      expect(now.map((f) => JSON.parse(f.frame) as unknown)).toEqual(
        before.map((f) => JSON.parse(f) as unknown),
      );
    }
  });

  // One join, leave or changed hello in a full room rebuilds every socket's roster: measured 2.5 ms of CPU for 100
  // sockets when each socket's roster was stringified whole, 0.3 ms once each entry is serialised once.
  it('builds a full room of 100 sockets well inside its CPU budget', () => {
    const room = fullRoom();
    const broadcast = () => {
      for (const { frame } of rosterFrames(room, [])) if (frame.length === 0) throw new Error();
    };
    broadcast();
    const cpu = cpuMsOf(() => {
      for (let i = 0; i < 10; i++) broadcast();
    });
    expect(cpu / 10).toBeLessThan(cpuBudgetMs(1.5));
  });
});

describe('helloChangesRoster', () => {
  it('is true for a first hello', () => {
    expect(helloChangesRoster(null, person('a'))).toBe(true);
    expect(helloChangesRoster(undefined, person('a'))).toBe(true);
  });

  it('is false for a hello equal by value, whatever its key order or undefined fields', () => {
    const before: Presence = { id: 'a', name: 'A', color: '#000', role: undefined, tabId: 't' };
    expect(
      helloChangesRoster<Presence>(before, { tabId: 't', color: '#000', name: 'A', id: 'a' }),
    ).toBe(false);
  });

  it('is true for any field that changed, appeared or went', () => {
    const before: Presence = { ...person('a'), tabId: 't' };
    expect(helloChangesRoster(before, { ...before, name: 'B' })).toBe(true);
    expect(helloChangesRoster(before, { ...before, picture: PICTURE })).toBe(true);
    expect(helloChangesRoster(before, person('a'))).toBe(true);
  });
});
