import { describe, expect, it } from 'vitest';
import type { AvatarPresence } from '@livehuddle/api-schema';
import { gameSeats, sameGameSeats, selfSeat, type GameSeatSource } from './game-seats';
import { gameSeatSources, peerSeat, rolePlays } from './useTableGameScene';

// docs/specs/009-elements/social-pieces.md "A game": the sitter on each seat plays, an Editor or a Participant only.

const at = (id: string, seat: number | null, plays = true, seatedOn: string | null = 'table') =>
  ({ id, name: id, color: '#000', seatedOn, seat, plays }) satisfies GameSeatSource;

describe('gameSeats', () => {
  it('puts each sitter of the piece on the seat they hold, you marked', () => {
    const seats = gameSeats('table', 2, 'me', [at('me', 1), at('ann', 0)]);
    expect(seats.map((p) => p?.id)).toEqual(['ann', 'me']);
    expect(seats[1]?.self).toBe(true);
    expect(selfSeat(seats)).toBe(1);
  });

  it('leaves a seat empty for a Viewer, someone at another piece, a seat it lacks or no seat known', () => {
    const seats = gameSeats('table', 2, 'me', [
      at('viewer', 0, false),
      at('elsewhere', 1, true, 'sofa'),
      at('far', 5),
      at('lost', null),
      at('odd', 0.5),
    ]);
    expect(seats).toEqual([null, null]);
    expect(selfSeat(seats)).toBeNull();
  });

  it('gives a seat two people claim to the first listed (you)', () => {
    const seats = gameSeats('table', 2, 'me', [at('me', 0), at('ann', 0)]);
    expect(seats[0]?.id).toBe('me');
    expect(seats[1]).toBeNull();
  });

  it('compares seatings by who and what colour', () => {
    const a = gameSeats('table', 2, 'me', [at('me', 0), at('ann', 1)]);
    const b = gameSeats('table', 2, 'me', [at('ann', 1), at('me', 0)]);
    expect(sameGameSeats(a, b)).toBe(true);
    expect(sameGameSeats(a, [a[0]!, null])).toBe(false);
    expect(sameGameSeats(a, [a[0]!])).toBe(false);
    expect(sameGameSeats(a, [a[0]!, { ...a[1]!, color: '#fff' }])).toBe(false);
    expect(sameGameSeats([null, null], [null, null])).toBe(true);
  });
});

describe('the scene’s people', () => {
  const presence = (over: Partial<AvatarPresence>): AvatarPresence => ({
    x: 0,
    y: 0,
    facing: 'down',
    walking: false,
    stepFrame: 0,
    lift: 0,
    wave: null,
    ...over,
  });
  const seats = [
    { x: 0, y: 0, facing: 'right' as const },
    { x: 100, y: 0, facing: 'left' as const },
  ];
  const seatsOf = (id: string) => (id === 'table' ? seats : id === 'bare' ? [] : null);

  it('plays an Editor or a Participant, never a Viewer or an unstamped peer', () => {
    expect(rolePlays('edit')).toBe(true);
    expect(rolePlays('participate')).toBe(true);
    expect(rolePlays('view')).toBe(false);
    expect(rolePlays(undefined)).toBe(false);
  });

  it('reads a peer’s seat from their claim, or the seat nearest their feet', () => {
    expect(peerSeat(presence({}), seatsOf)).toBeNull();
    expect(
      peerSeat(presence({ seatedOn: 'table', seat: { index: 1, at: 0, tie: 0 } }), seatsOf),
    ).toBe(1);
    expect(peerSeat(presence({ seatedOn: 'table', x: 95 }), seatsOf)).toBe(1);
    expect(
      peerSeat(presence({ seatedOn: 'gone', seat: { index: 0, at: 0, tie: 0 } }), seatsOf),
    ).toBe(0);
    expect(peerSeat(presence({ seatedOn: 'bare' }), seatsOf)).toBeNull();
  });

  it('lists you first, then each peer with their seat and say', () => {
    const sources = gameSeatSources(
      { id: 'me', color: '#111', seatedOn: 'table', seat: 0, plays: true },
      [
        {
          id: 'ann',
          name: 'Ann',
          color: '#222',
          avatar: presence({ seatedOn: 'table', x: 100 }),
          role: 'participate',
        },
        { id: 'vic', name: 'Vic', color: '#333', avatar: presence({}), role: 'view' },
      ],
      seatsOf,
    );
    expect(sources).toEqual([
      { id: 'me', name: 'You', color: '#111', seatedOn: 'table', seat: 0, plays: true },
      { id: 'ann', name: 'Ann', color: '#222', seatedOn: 'table', seat: 1, plays: true },
      { id: 'vic', name: 'Vic', color: '#333', seatedOn: null, seat: null, plays: false },
    ]);
  });
});
