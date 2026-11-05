import { describe, expect, it } from 'vitest';
import { arcadeAt, jukeboxAt, JUKEBOX_RADIUS } from './useSocialPieces';

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
