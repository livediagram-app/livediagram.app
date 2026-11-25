import { describe, expect, it } from 'vitest';
import { arcadeAt, jukeboxAt, jukeboxRoomOf, JUKEBOX_RADIUS } from './useSocialPieces';

// docs/specs/009-elements/social-pieces.md "Jukebox" and "Arcade Machine".
const room = (id: string, x: number, y: number, width: number, height: number) => ({
  id,
  x,
  y,
  width,
  height,
});
const box = (id: string, x: number, y: number, source = 'https://example.com/a.mp3') => ({
  id,
  x,
  y,
  width: 72,
  height: 112,
  source,
});

describe('the jukebox whose area holds you', () => {
  const lounge = room('lounge', 0, 0, 600, 400);
  const inLounge = box('in', 40, 40);
  const outside = box('out', 1000, 1000);

  it('follows a room that moved: a new board finds each jukebox its room again', () => {
    const rooms = [lounge];
    expect(jukeboxAt({ x: 500, y: 300 }, [inLounge], rooms)?.id).toBe('in');
    // The lounge moved away from the jukebox: a fresh rooms list, as the hook builds on every change of the board.
    const moved = [room('lounge', 2000, 2000, 600, 400)];
    // Now in no room, it is heard round its base (a stale cache would still look for you in the old lounge)...
    expect(jukeboxAt({ x: 100, y: 150 }, [inLounge], moved)?.id).toBe('in');
    // ...and no longer across the room it left, nor in the room that moved.
    expect(jukeboxAt({ x: 500, y: 300 }, [inLounge], moved)).toBeNull();
    expect(jukeboxAt({ x: 2300, y: 2200 }, [inLounge], moved)).toBeNull();
  });

  it('is the jukebox in the room you stand in, wherever in the room', () => {
    expect(jukeboxAt({ x: 500, y: 300 }, [inLounge, outside], [lounge])?.id).toBe('in');
  });

  it('is nothing outside its room, however near', () => {
    expect(jukeboxAt({ x: 640, y: 100 }, [inLounge], [lounge])).toBeNull();
  });

  it(`is a roomless jukebox within ${JUKEBOX_RADIUS}px of its base`, () => {
    const base = { x: outside.x + 36, y: outside.y + 112 * 0.9 };
    expect(jukeboxAt({ x: base.x + 200, y: base.y }, [outside], [lounge])?.id).toBe('out');
    expect(
      jukeboxAt({ x: base.x + JUKEBOX_RADIUS + 10, y: base.y }, [outside], [lounge]),
    ).toBeNull();
  });

  it('prefers the innermost room', () => {
    const booth = room('booth', 300, 200, 200, 150);
    const inBooth = box('booth-jb', 320, 210);
    expect(jukeboxAt({ x: 400, y: 300 }, [inLounge, inBooth], [lounge, booth])?.id).toBe(
      'booth-jb',
    );
    expect(jukeboxAt({ x: 100, y: 300 }, [inLounge, inBooth], [lounge, booth])?.id).toBe('in');
  });
});

describe('the arcade machine you stand at', () => {
  const arcade = { id: 'arc', x: 100, y: 100, width: 64, height: 112 };
  it('is the one whose front your feet are at', () => {
    expect(arcadeAt({ x: 130, y: 220 }, [arcade])).toBe('arc');
    expect(arcadeAt({ x: 130, y: 260 }, [arcade])).toBeNull();
    expect(arcadeAt({ x: 400, y: 220 }, [arcade])).toBeNull();
  });
});

// docs/specs/009-elements/office.md "A Room turns" (Work Tracker 1473): a turned room's jukebox is heard on its floor
// as drawn.
describe('the jukebox in a room turned 45 degrees', () => {
  // An 800 by 400 room turned about its centre (400, 200).
  const turned = jukeboxRoomOf({ id: 'lounge', x: 0, y: 0, width: 800, height: 400, rotation: 45 });
  // Its base, (400, 255.8), stands on the turned floor.
  const jukebox = box('j', 364, 155);

  it('counts you in the room on its turned floor, not in its upright box', () => {
    expect(turned.floor).toHaveLength(4);
    expect(jukeboxAt({ x: 420, y: 220 }, [jukebox], [turned])?.id).toBe('j');
    // The upright box's far corner: inside the box, outside the walls as drawn, and past the jukebox's radius.
    expect(jukeboxAt({ x: 780, y: 20 }, [jukebox], [turned])).toBeNull();
    // Out past the upright box along the turned room's long side, still on its floor.
    expect(jukeboxAt({ x: 640, y: 470 }, [jukebox], [turned])?.id).toBe('j');
  });

  it('hears a jukebox whose base is off the turned floor round its base, as one in no room', () => {
    // Its base, (780, 20), is in the upright box's corner, outside the turned walls.
    const offFloor = box('off', 744, -80.8);
    expect(jukeboxAt({ x: 780, y: 60 }, [offFloor], [turned])?.id).toBe('off');
    expect(jukeboxAt({ x: 800 + JUKEBOX_RADIUS, y: 20 }, [offFloor], [turned])).toBeNull();
  });

  it('keeps an upright room on its box', () => {
    expect(jukeboxRoomOf({ id: 'r', x: 0, y: 0, width: 600, height: 400 }).floor).toBeNull();
  });
});
