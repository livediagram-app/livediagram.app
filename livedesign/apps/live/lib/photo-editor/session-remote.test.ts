import { describe, expect, it } from 'vitest';
import { PHOTO_TILE, tileKey, type Photo } from '@livedesign/photo-engine';
import { harness, pixel, photoOf, pixelLayer, lastCommit, type Harness } from './photo-test-utils';

// docs/specs/031-photo/photo-pages.md "Collaboration": a peer's change to a tile this person is still
// painting, or committing, waits; this person's commit, the later, wins it. A peer's change to any other
// tile shows at once, and a cancelled gesture takes up what a peer changed meanwhile.
const LEFT = tileKey(0, 0);
const RIGHT = tileKey(1, 0);
const GREEN = [0, 200, 0, 255];
const RED = [255, 0, 0, 255];

function greenTile(h: Harness, id: string): void {
  const data = new Uint8ClampedArray(PHOTO_TILE * PHOTO_TILE * 4);
  for (let i = 0; i < data.length; i += 4) data.set(GREEN, i);
  h.store.put(id, data);
}

const peerPhoto = (tiles: Record<string, string>): Photo =>
  photoOf(PHOTO_TILE * 2, PHOTO_TILE, [pixelLayer('a', { pixels: { tiles } })]);

function paintLeftRed(h: Harness): void {
  const tile = h.s.raster('a').writable(0, 0);
  for (let i = 0; i < tile.length; i += 4) tile.set(RED, i);
}

function start(): Harness {
  const h = harness(peerPhoto({}));
  greenTile(h, 'peer-left');
  greenTile(h, 'peer-right');
  return h;
}

describe('a peer’s change to the layer in hand', () => {
  it('waits on the tiles being painted, shows on the rest, and loses to this person’s commit', async () => {
    const h = start();
    paintLeftRed(h);
    h.s.setPhoto(peerPhoto({ [LEFT]: 'peer-left', [RIGHT]: 'peer-right' }));
    expect(pixel(h, 0, 0)).toEqual(RED);
    expect(pixel(h, PHOTO_TILE + 1, 0)).toEqual(GREEN);

    h.s.commitPixels('Brush', [{ layerId: 'a', target: 'layer' }]);
    await h.s.settled();
    const tiles = (lastCommit(h)!.photo.layers[0] as { pixels: { tiles: Record<string, string> } })
      .pixels.tiles;
    expect(tiles[LEFT]).not.toBe('peer-left');
    expect(tiles[RIGHT]).toBe('peer-right');
    expect(pixel(h, 0, 0)).toEqual(RED);

    // Nothing is held any more: the peer's next change to the tile shows.
    greenTile(h, 'peer-left-2');
    h.s.setPhoto(peerPhoto({ [LEFT]: 'peer-left-2', [RIGHT]: 'peer-right' }));
    expect(pixel(h, 0, 0)).toEqual(GREEN);
  });

  it('waits on the tiles being committed', async () => {
    const h = start();
    paintLeftRed(h);
    h.s.commitPixels('Brush', [{ layerId: 'a', target: 'layer' }]);
    h.s.setPhoto(peerPhoto({ [LEFT]: 'peer-left' }));
    expect(pixel(h, 0, 0)).toEqual(RED);
    await h.s.settled();
    expect(pixel(h, 0, 0)).toEqual(RED);
    expect(h.s.raster('a').peekDirty().size).toBe(0);
  });

  it('is taken up when the gesture is cancelled', () => {
    const h = start();
    const before = h.s.raster('a').clone();
    paintLeftRed(h);
    h.s.setPhoto(peerPhoto({ [LEFT]: 'peer-left', [RIGHT]: 'peer-right' }));
    h.s.restorePixels('a', 'layer', before);
    expect(pixel(h, 0, 0)).toEqual(GREEN);
    expect(pixel(h, PHOTO_TILE + 1, 0)).toEqual(GREEN);
  });

  it('back to nothing keeps the stroke’s other tiles waiting to be committed', () => {
    const h = start();
    h.s.setPhoto(peerPhoto({ [RIGHT]: 'peer-right' }));
    paintLeftRed(h);
    h.s.setPhoto(peerPhoto({}));
    expect([...h.s.raster('a').peekDirty()]).toEqual([LEFT]);
    expect(pixel(h, PHOTO_TILE + 1, 0)).toEqual([0, 0, 0, 0]);
  });
});
