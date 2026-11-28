// Palette portraits' pure part (docs/specs/008-canvas/3d-engine.md "Palette portraits"): the key every tile's image
// is found by, how each crop is framed, the still each Behaviour is caught in, and the store's cap.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_BUILDS } from '@livehuddle/avatar/config';
import { BODY } from './character';
import {
  PORTRAIT_BUFFER_PX,
  PORTRAIT_CACHE_CAP,
  PORTRAIT_FAILED,
  facingYaw,
  liftInSpritePx,
  portraitCamera,
  portraitCount,
  portraitFrame,
  portraitKey,
  portraitMove,
  portraitPack,
  portraitPixels,
  portraitRatio,
  portraitUrl,
  putPortrait,
  resetPortraits,
  subscribePortraits,
  type PortraitRequest,
} from './figure-portrait';

const req = (over: Partial<PortraitRequest> = {}): PortraitRequest => ({
  look: { gender: 'male', clothing: 'tee', hair: 'short', hairColour: 'brown', shirt: '#0ea5e9' },
  crop: 'full',
  move: null,
  width: 56,
  height: 76,
  ...over,
});

afterEach(() => resetPortraits());

describe('the key', () => {
  it("is shared by stored styles the scene draws the same (a man's Long draws as his Short)", () => {
    const long = req({ look: { ...req().look, hair: 'long' } });
    const short = req({ look: { ...req().look, hair: 'short' } });
    expect(portraitKey(long, 1)).toBe(portraitKey(short, 1));
  });

  it('splits on what the scene draws differently: outfit, gender, hair colour, shirt', () => {
    const base = portraitKey(req(), 1);
    expect(portraitKey(req({ look: { ...req().look, clothing: 'suit' } }), 1)).not.toBe(base);
    expect(portraitKey(req({ look: { ...req().look, gender: 'female' } }), 1)).not.toBe(base);
    expect(portraitKey(req({ look: { ...req().look, hairColour: 'blue' } }), 1)).not.toBe(base);
    expect(portraitKey(req({ look: { ...req().look, shirt: '#ff0000' } }), 1)).not.toBe(base);
  });

  // avatar-mode.md "Status": the preview card wears a status's signature; every other picture keeps its key.
  it('splits on a worn status, and keeps the key as it was without one', () => {
    const base = portraitKey(req(), 1);
    expect(portraitKey(req({ status: null }), 1)).toBe(base);
    expect(portraitKey(req({ status: 'lunch' }), 1)).not.toBe(base);
    expect(portraitKey(req({ status: 'lunch' }), 1)).not.toBe(
      portraitKey(req({ status: 'focus' }), 1),
    );
  });

  // docs/specs/008-canvas/3d-engine.md "Palette portraits": each Build tile is its own picture, and Regular's is the
  // picture it always was.
  it('splits on the build, and keeps a Regular key as it was without one', () => {
    const base = portraitKey(req(), 1);
    expect(portraitKey(req({ look: { ...req().look, build: 'regular' } }), 1)).toBe(base);
    expect(portraitKey(req({ look: { ...req().look, build: 'tartan' } }), 1)).toBe(base);
    const keys = AVATAR_BUILDS.map((b) =>
      portraitKey(req({ look: { ...req().look, build: b.id } }), 1),
    );
    expect(new Set(keys).size).toBe(AVATAR_BUILDS.length);
  });

  it('splits on the move, the crop and the device size', () => {
    const base = portraitKey(req(), 1);
    expect(portraitKey(req({ move: 'cheer' }), 1)).not.toBe(base);
    expect(portraitKey(req({ crop: 'head' }), 1)).not.toBe(base);
    expect(portraitKey(req(), 2)).not.toBe(base);
    expect(portraitKey(req(), 2)).toContain('#112x152');
  });

  it('names the pack by gender', () => {
    expect(portraitPack(req())).toBe('men');
    expect(portraitPack(req({ look: { gender: 'female' } }))).toBe('women');
  });
});

describe('sizes', () => {
  it('renders at the screen ratio, from 1 up to 2', () => {
    expect(portraitRatio(undefined)).toBe(1);
    expect(portraitRatio(0.5)).toBe(1);
    expect(portraitRatio(1.5)).toBe(1.5);
    expect(portraitRatio(3)).toBe(2);
  });

  it('never asks for more than the renderer buffer holds', () => {
    expect(portraitPixels({ width: 400, height: 10 }, 2)).toEqual({ w: PORTRAIT_BUFFER_PX, h: 20 });
  });
});

describe('framing', () => {
  it('fits the whole figure, the raised arms, or the head', () => {
    const full = portraitFrame('full');
    const action = portraitFrame('action');
    const head = portraitFrame('head');
    expect(full.centreZ - full.span / 2).toBeLessThanOrEqual(0);
    expect(full.centreZ + full.span / 2).toBeGreaterThanOrEqual(BODY.height);
    expect(action.centreZ + action.span / 2).toBeGreaterThan(full.centreZ + full.span / 2);
    // The preview card's stage has room for a hop over the raised arms.
    const stage = portraitFrame('stage');
    expect(stage.centreZ + stage.span / 2).toBeGreaterThan(action.centreZ + action.span / 2);
    expect(head.centreZ).toBeGreaterThan(BODY.height * 0.75);
    expect(head.span).toBeLessThan(BODY.height / 2);
  });

  it('stands the camera in front (canvas +y), a little above, backing off for a narrow picture', () => {
    const square = portraitCamera('full', 1);
    const narrow = portraitCamera('full', 0.5);
    expect(square.position[1]).toBeGreaterThan(0);
    expect(square.position[2]).toBeGreaterThan(square.target[2]);
    expect(Math.abs(square.position[0])).toBeLessThan(square.position[1]);
    expect(Math.hypot(...narrow.position)).toBeGreaterThan(Math.hypot(...square.position));
  });
});

describe('moves', () => {
  it('stands still with no move', () => {
    expect(portraitMove(null)).toEqual({
      armsUp: false,
      armsOut: false,
      waving: false,
      legsApart: false,
      yaw: 0,
    });
  });

  it('catches each Behaviour at its telling moment', () => {
    expect(portraitMove('cheer').armsUp).toBe(true);
    expect(portraitMove('jumping-jacks')).toMatchObject({ armsOut: true, legsApart: true });
    expect(portraitMove('wave').waving).toBe(true);
    expect(portraitMove('spin').yaw).not.toBe(0);
  });

  it('turns by facing and lifts in sprite px', () => {
    expect(facingYaw(undefined)).toBe(0);
    expect(facingYaw('up')).toBe(Math.PI);
    expect(liftInSpritePx(-3)).toBe(0);
    expect(liftInSpritePx(4.75)).toBeCloseTo(1);
  });
});

describe('the store', () => {
  it('tells its listeners, and keeps a failure as one', () => {
    const heard = vi.fn();
    const off = subscribePortraits(heard);
    putPortrait('a', 'blob:a');
    putPortrait('b', PORTRAIT_FAILED);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(portraitUrl('a')).toBe('blob:a');
    expect(portraitUrl('b')).toBe(PORTRAIT_FAILED);
    expect(portraitUrl('c')).toBeUndefined();
    off();
  });

  it('keeps the cap, the oldest going with its URL let go', () => {
    const revoked: string[] = [];
    resetPortraits((url) => revoked.push(url));
    for (let i = 0; i <= PORTRAIT_CACHE_CAP; i++) putPortrait(`k${i}`, `blob:${i}`);
    expect(portraitCount()).toBe(PORTRAIT_CACHE_CAP);
    expect(portraitUrl('k0')).toBeUndefined();
    expect(revoked).toEqual(['blob:0']);
  });

  it('lets go of a replaced URL', () => {
    const revoked: string[] = [];
    resetPortraits((url) => revoked.push(url));
    putPortrait('a', 'blob:1');
    putPortrait('a', 'blob:2');
    expect(revoked).toEqual(['blob:1']);
    expect(portraitUrl('a')).toBe('blob:2');
  });
});
