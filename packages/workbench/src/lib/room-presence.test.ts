import { describe, expect, it } from 'vitest';
import {
  forgetDeparted,
  presenceRows,
  pruneMapToPresent,
  seededTabFocus,
  yieldedColour,
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
