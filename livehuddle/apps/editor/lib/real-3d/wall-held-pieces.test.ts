import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { spaceWalls } from '@/lib/space-3d/space-3d-walls';
import { wallHeldPieces } from './wall-held-pieces';

// 3d-view.md "Walls in front of you are cut away": a piece hung on a wall goes with it when it is cut down.
const at = (kind: string, id: string, x: number, y: number, w?: number, h?: number): Element => {
  const el = { ...createShape(kind as never, x, y), id } as Element & {
    width: number;
    height: number;
  };
  if (w) el.width = w;
  if (h) el.height = h;
  return el;
};

describe('wallHeldPieces', () => {
  const room = at('room', 'room', 0, 0, 400, 300);
  // A screen on the room's back wall, a poster on its left wall, a bookshelf on the floor at the back.
  const screen = at('screen', 'scr', 180, 0);
  const poster = at('poster', 'pos', 0, 120);
  const shelf = at('bookshelf', 'shelf', 20, 0);
  const elements = [room, screen, poster, shelf];
  const held = wallHeldPieces(spaceWalls(elements), elements);
  const owner = (id: string) => [...held].filter(([, ids]) => ids.includes(id)).map(([w]) => w);

  it('puts each hung piece on the wall it hangs on, and only that one', () => {
    expect(owner('scr').length).toBeGreaterThan(0);
    expect(owner('pos').length).toBeGreaterThan(0);
    expect(owner('scr')).not.toEqual(owner('pos'));
  });

  it('leaves a piece standing on the floor against its wall alone', () => {
    expect(owner('shelf')).toEqual([]);
  });
});
