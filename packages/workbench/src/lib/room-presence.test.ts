import { describe, expect, it } from 'vitest';
import {
  forgetDeparted,
  presenceRows,
  pruneMapToPresent,
  seededTabFocus,
  syncRoomPresence,
  yieldedColour,
  type RoomPresenceEntry,
} from './room-presence';

describe('pruneMapToPresent', () => {
  it('keeps the same map when nobody left, and drops whoever did', () => {
    const prev = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    expect(pruneMapToPresent(prev, new Set(['a', 'b']))).toBe(prev);
    expect([...pruneMapToPresent(prev, new Set(['a']))]).toEqual([['a', 1]]);
  });
});

describe('presenceRows', () => {
  const peers = [
    { id: 'a', key: 'ka', name: 'Ann', color: '#a', role: 'edit', picture: 'https://p/a' },
    { id: 'b', name: 'Bo', color: '#b' },
  ];

  it('draws each peer online, seeding one not seen yet with now', () => {
    expect(presenceRows(peers, new Map([['a', 5]]), 9)).toEqual([
      {
        id: 'a',
        key: 'ka',
        name: 'Ann',
        color: '#a',
        status: 'online',
        lastActiveAt: 5,
        role: 'edit',
        picture: 'https://p/a',
      },
      { id: 'b', name: 'Bo', color: '#b', status: 'online', lastActiveAt: 9 },
    ]);
  });

  it('leaves out a picture the product will not draw', () => {
    expect(presenceRows(peers, new Map(), 1, () => false)[0]).not.toHaveProperty('picture');
  });
});

describe('yieldedColour', () => {
  const next = () => '#new';

  it('keeps our colour when we are not listed, nobody shares it, or we joined first', () => {
    expect(
      yieldedColour([{ id: 'b', name: '', color: '#a' }], { id: 'z', color: '#a' }, next),
    ).toBe(null);
    const room = [
      { id: 'm', name: '', color: '#a' },
      { id: 'n', name: '', color: '#b' },
    ];
    expect(yieldedColour(room, { id: 'm', color: '#a' }, next)).toBe(null);
    const shared = [
      { id: 'm', name: '', color: '#a' },
      { id: 'n', name: '', color: '#a' },
    ];
    expect(yieldedColour(shared, { id: 'm', color: '#a' }, next)).toBe(null);
  });

  it('moves the later joiner to a colour nobody else holds, unless that is the one it has', () => {
    const shared = [
      { id: 'm', name: '', color: '#a' },
      { id: 'n', name: '', color: '#a' },
    ];
    const taken: Set<string>[] = [];
    expect(
      yieldedColour(shared, { id: 'n', color: '#a' }, (t) => {
        taken.push(t);
        return '#new';
      }),
    ).toBe('#new');
    expect(taken).toEqual([new Set(['#a'])]);
    expect(yieldedColour(shared, { id: 'n', color: '#a' }, () => '#a')).toBe(null);
  });
});

describe('seededTabFocus', () => {
  it("seeds each peer's tab, skipping self and peers with none, and drops those who left", () => {
    const prev = new Map([
      ['gone', 't0'],
      ['b', 't9'],
    ]);
    const participants = [
      { id: 'me', name: '', color: '', tabId: 't1' },
      { id: 'a', name: '', color: '', tabId: 't2' },
      { id: 'b', name: '', color: '', tabId: null },
    ];
    const next = seededTabFocus(prev, participants, new Set(['me', 'a', 'b']), 'me');
    expect(next).not.toBe(prev);
    expect([...next]).toEqual([
      ['b', 't9'],
      ['a', 't2'],
    ]);
  });
});

describe('forgetDeparted', () => {
  it('drops departed peers from the idle tracker', () => {
    const seen = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    forgetDeparted(seen, new Set(['b']));
    expect([...seen]).toEqual([['b', 2]]);
  });
});

describe('syncRoomPresence', () => {
  // A page's presence state, held as each hook holds it, with every call it makes in order.
  const page = (self: { id: string; color: string }) => {
    const calls: string[] = [];
    let tabFocus = new Map([['gone', 't9']]);
    let selections = new Map([
      ['b', 'sel-b'],
      ['gone', 'sel-gone'],
    ]);
    let cursors = new Map([['gone', 'cur-gone']]);
    const lastSeen = new Map([
      ['b', 5],
      ['gone', 1],
    ]);
    let colour = self.color;
    const sync = {
      lastSeen,
      markSeen: (id: string) => {
        calls.push(`seen ${id}`);
        lastSeen.set(id, 9);
      },
      self: () => ({ ...self, color: colour }),
      nextFreeColor: () => 'teal',
      takeColour: (c: string) => {
        calls.push(`colour ${c}`);
        colour = c;
      },
      prunePeerDragPreviews: (present: Set<string>) => calls.push(`drag ${[...present].join(',')}`),
      setRemoteTabFocus: (u: (prev: Map<string, string>) => Map<string, string>) => {
        tabFocus = u(tabFocus);
      },
      setRemoteSelections: (u: (prev: Map<string, string>) => Map<string, string>) => {
        selections = u(selections);
      },
      setRemoteCursors: (u: (prev: Map<string, string>) => Map<string, string>) => {
        cursors = u(cursors);
      },
    };
    return {
      calls,
      sync,
      state: () => ({ tabFocus, selections, cursors, lastSeen, colour }),
    };
  };
  const roster: (RoomPresenceEntry & { besideTabId?: string })[] = [
    { id: 'a', name: 'Me', color: 'red' },
    { id: 'b', name: 'Bo', color: 'blue', tabId: 't2', besideTabId: 't3' },
    { id: 'c', name: 'Cy', color: 'red' },
  ];

  it('seeds arrivals, yields a shared colour and drops whoever left', () => {
    const { calls, sync, state } = page({ id: 'd', color: 'red' });
    syncRoomPresence([...roster, { id: 'd', name: 'Di', color: 'red' }], sync);
    expect(calls).toEqual(['seen a', 'seen c', 'seen d', 'colour teal', 'drag a,b,c,d']);
    const now = state();
    expect([...now.tabFocus]).toEqual([['b', 't2']]);
    expect([...now.selections]).toEqual([['b', 'sel-b']]);
    expect(now.cursors.size).toBe(0);
    expect(now.lastSeen.has('gone')).toBe(false);
  });

  it("runs a product's own steps where they sit, and keeps a colour nobody shares", () => {
    const { calls, sync } = page({ id: 'a', color: 'red' });
    syncRoomPresence(roster, {
      ...sync,
      onPresent: (people, present) => calls.push(`present ${people.length} ${present.size}`),
      onPruned: (present) => calls.push(`pruned ${present.size}`),
    });
    expect(calls).toEqual(['seen a', 'seen c', 'drag a,b,c', 'present 3 3', 'pruned 3']);
  });
});
