import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { mountsOnWall, mountedFace, snapToWallFace } from './wall-mounted';
import { isFixedSizeElement } from './placed-kinds';
import {
  isPoster,
  isPosterImageId,
  posterPicture,
  POSTER_IMAGE_ID_MAX,
  withoutPosterPicture,
  withPosterPicture,
} from './poster';
import { isValidElement } from './validate';
import type { ShapeElement } from './index';

// docs/specs/009-elements/poster.md.

const room = {
  ...createShape('room', 0, 0),
  width: 400,
  height: 300,
  roomDoor: 'none',
} as ShapeElement;

describe('the Poster', () => {
  it('is made portrait, wordless, resizable and free of an aspect lock', () => {
    const p = createShape('poster', 10, 20);
    expect(p).toMatchObject({ type: 'shape', shape: 'poster', width: 56, height: 76, label: '' });
    expect(p.height).toBeGreaterThan(p.width);
    expect(p.aspectLocked).toBeUndefined();
    expect(p.imageId).toBeUndefined();
    expect(isFixedSizeElement(p)).toBe(false);
    expect(isPoster(p)).toBe(true);
    expect(posterPicture(p)).toBeNull();
  });

  it('is a wall piece: placed in a room it hangs on the nearest wall face, and stays there', () => {
    expect(mountsOnWall('poster')).toBe(true);
    const p = { ...createShape('poster', 0, 0), x: 120, y: 60 };
    const on = snapToWallFace(p, [room, p]);
    expect(on.y).toBe(4);
    expect(mountedFace(on, [room, on])).not.toBeNull();
    expect(snapToWallFace(on, [room, on])).toBe(on);
    // Its picture and size go with it.
    const big = { ...withPosterPicture(p, { id: 'img_1' }), width: 120, height: 90 };
    const hung = snapToWallFace(big, [room, big]);
    expect(hung).toMatchObject({ imageId: 'img_1', width: 120, height: 90 });
  });
});

describe("a Poster's picture", () => {
  const p = createShape('poster', 0, 0);
  const credit = { text: '"Hills" by A. Painter', sourceUrl: 'https://example.org/hills' };

  it('sets, replaces and clears, keeping the frame', () => {
    const set = withPosterPicture(p, { id: 'img_a', credit });
    expect(set).toMatchObject({ imageId: 'img_a', credit, width: 56, height: 76 });
    expect(posterPicture(set)).toBe('img_a');
    // A pick without a credit drops the old one.
    const replaced = withPosterPicture(set, { id: 'img_b' });
    expect(replaced.imageId).toBe('img_b');
    expect(replaced).not.toHaveProperty('credit');
    const cleared = withoutPosterPicture(withPosterPicture(p, { id: 'img_c', credit }));
    expect(cleared).not.toHaveProperty('imageId');
    expect(cleared).not.toHaveProperty('credit');
    expect(cleared).toEqual(p);
  });

  it('is stored as a valid shape, and a bad id is refused', () => {
    expect(isValidElement(withPosterPicture(p, { id: 'img_a', credit }))).toBe(true);
    expect(isValidElement({ ...p, imageId: '' })).toBe(false);
    expect(isValidElement({ ...p, imageId: 3 })).toBe(false);
    expect(isPosterImageId('x'.repeat(POSTER_IMAGE_ID_MAX))).toBe(true);
    expect(isPosterImageId('x'.repeat(POSTER_IMAGE_ID_MAX + 1))).toBe(false);
    // Offline Mode keeps the picture's bytes in the id, as an Image element does.
    expect(isPosterImageId(`data:image/png;base64,${'A'.repeat(400)}`)).toBe(true);
  });

  it('is no other element’s', () => {
    const screen = { ...createShape('screen', 0, 0), imageId: 'img_a' };
    expect(isPoster(screen)).toBe(false);
    expect(posterPicture(screen)).toBeNull();
    expect(posterPicture(undefined)).toBeNull();
  });
});
