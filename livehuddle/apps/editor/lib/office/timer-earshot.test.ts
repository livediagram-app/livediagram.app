import { afterEach, describe, expect, it } from 'vitest';
import { createShape, type CallZone, type Element } from '@livehuddle/document';
import { hearsTimer, setTimerEarshot, timerRooms } from './timer-earshot';

// docs/specs/009-elements/timer-and-stopwatch.md "The chime": who hears a Timer reach zero.

const zone = (id: string, x0: number, y0: number, x1: number, y1: number): CallZone => ({
  id,
  x0,
  y0,
  x1,
  y1,
  area: (x1 - x0) * (y1 - y0),
});
const timerAt = (id: string, x: number, y: number): Element => ({
  ...createShape('timer', x, y),
  id,
});

afterEach(() => setTimerEarshot(null));

describe('timer earshot', () => {
  const zones = [zone('room-a', 0, 0, 400, 400), zone('room-b', 1000, 0, 1400, 400)];
  const rooms = timerRooms(
    [
      timerAt('in-a', 100, 100),
      timerAt('outside', 3000, 3000),
      { ...createShape('stopwatch', 100, 100), id: 'sw' },
    ],
    zones,
  );

  it("finds each Timer's room, and none far from every room; a Stopwatch makes no sound", () => {
    expect(rooms.get('in-a')).toBe('room-a');
    expect(rooms.get('outside')).toBeNull();
    expect(rooms.has('sw')).toBe(false);
  });

  it('lets everyone hear when nobody wrote it, and anyone not walking', () => {
    expect(hearsTimer('in-a')).toBe(true);
    setTimerEarshot({ inMode: false, selfZone: null, rooms });
    expect(hearsTimer('in-a')).toBe(true);
  });

  it("lets a walker hear only their own room's Timer, and one in no room", () => {
    setTimerEarshot({ inMode: true, selfZone: 'room-b', rooms });
    expect(hearsTimer('in-a')).toBe(false);
    expect(hearsTimer('outside')).toBe(true);
    setTimerEarshot({ inMode: true, selfZone: 'room-a', rooms });
    expect(hearsTimer('in-a')).toBe(true);
    setTimerEarshot({ inMode: true, selfZone: null, rooms });
    expect(hearsTimer('in-a')).toBe(false);
  });
});
