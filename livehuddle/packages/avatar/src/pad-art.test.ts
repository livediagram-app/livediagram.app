import { describe, expect, it } from 'vitest';
import {
  AVATAR_PAD_DEFAULT_SIZE,
  avatarPadArtRect,
  avatarPadCore,
  avatarPadFootprint,
} from './pad-art';

describe('avatarPadArtRect', () => {
  it('fills a box of the grid proportions exactly', () => {
    expect(avatarPadArtRect(AVATAR_PAD_DEFAULT_SIZE)).toEqual({ x: 0, y: 0, scale: 4 });
  });
  it('scales whole and centres in a box of other proportions', () => {
    expect(avatarPadArtRect({ width: 320, height: 80 })).toEqual({ x: 96, y: 0, scale: 4 });
    expect(avatarPadArtRect({ width: 64, height: 200 })).toEqual({ x: 0, y: 80, scale: 2 });
  });
  it('draws nothing in a zero box', () => {
    expect(avatarPadArtRect({ width: 0, height: 80 }).scale).toBe(0);
  });
});

describe('avatarPadCore', () => {
  const pad = { x: 100, y: 200, ...AVATAR_PAD_DEFAULT_SIZE };
  it('is the bright core on the top face', () => {
    expect(avatarPadCore(pad)).toEqual({ x: 164, y: 232 });
  });
  it('turns with the element about its centre', () => {
    const turned = avatarPadCore({ ...pad, rotation: 180 });
    expect(turned.x).toBeCloseTo(164);
    expect(turned.y).toBeCloseTo(248);
  });
  it('sizes the footprint with the drawing', () => {
    expect(avatarPadFootprint(pad)).toEqual({ rx: 60, ry: 28 });
  });
});
