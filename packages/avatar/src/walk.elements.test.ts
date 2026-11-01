import { describe, expect, it } from 'vitest';
import {
  AVATAR_HEIGHT,
  avatarPortraitBox,
  elementUnderFeet,
  followCorrection,
  peerPushTarget,
  viewportOffsetCentredOn,
} from './walk';

// livediagram's docs/specs/008-canvas/avatar-mode.md "Walking", on plain elements: each product also tests its own
// element kinds under the feet.
const box = (id: string, type: string, shape?: string) => ({
  id,
  type,
  shape,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
});

describe('elementUnderFeet on any board', () => {
  const feet = { x: 50, y: 50 };

  it('rings the frontmost boxed element, never an arrow', () => {
    expect(elementUnderFeet([box('a', 'sticky'), box('b', 'shape', 'square')], feet)).toBe('b');
    expect(elementUnderFeet([box('a', 'sticky'), { id: 'arrow', type: 'arrow' }], feet)).toBe('a');
    expect(elementUnderFeet([box('a', 'sticky')], { x: 500, y: 50 })).toBeNull();
  });

  it('skips frames, fences, the floor and the scenery walked round', () => {
    for (const shape of ['frame', 'fence', 'room', 'rug', 'avatar-pad', 'plant', 'bookshelf'])
      expect(elementUnderFeet([box('s', 'shape', shape)], feet)).toBeNull();
  });
});

describe('the walk’s camera and reach', () => {
  it('sizes a portrait at the regular scale by default', () => {
    expect(avatarPortraitBox()).toEqual(avatarPortraitBox(1));
    expect(avatarPortraitBox(2).height).toBeGreaterThan(AVATAR_HEIGHT);
  });

  it('treats a zoom of zero as one', () => {
    const size = { width: 1000, height: 800 };
    expect(followCorrection({ x: 0, y: 0 }, size, 0)).toEqual(
      followCorrection({ x: 0, y: 0 }, size, 1),
    );
    expect(followCorrection({ x: 500, y: 790 }, size, 1).y).toBeLessThan(0);
    expect(viewportOffsetCentredOn({ x: 0, y: 0, width: 100, height: 100 }, size, 0)).toEqual({
      x: 450,
      y: 350,
    });
  });

  it('shoves a peer standing in the air or at another size', () => {
    const shove = peerPushTarget(
      [{ id: 'p', feet: { x: 100, y: 100 }, lift: 20, scale: 2 }],
      { x: 100, y: 60 },
      { x: 0, y: 100 },
    );
    expect(shove).toMatchObject({ id: 'p', dx: 1, dy: 0 });
    const lifted = peerPushTarget(
      [{ id: 'q', feet: { x: 100, y: 100 }, lift: 20 }],
      { x: 100, y: 70 },
      null,
    );
    expect(lifted).toMatchObject({ id: 'q', dx: 0, dy: 1 });
  });
});
