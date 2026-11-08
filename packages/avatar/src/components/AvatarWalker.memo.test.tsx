// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '../config';
import { walkerPropsEqual } from './AvatarWalker';

const props = (over: Partial<Parameters<typeof walkerPropsEqual>[0]> = {}) => ({
  pos: { x: 10, y: 20 },
  facing: 'right' as const,
  config: { ...DEFAULT_AVATAR_CONFIG },
  walking: false,
  stepFrame: 0,
  standingOn: null,
  name: 'Sam',
  ...over,
});

// A room's presence flush re-renders every peer's walker with fresh objects: only a real change draws the sprite again.
describe('walkerPropsEqual', () => {
  it('holds for fresh objects with the same fields', () => {
    expect(walkerPropsEqual(props(), props())).toBe(true);
  });

  it('breaks for a move, a turn, a costume, a field gained or lost and a ring', () => {
    expect(walkerPropsEqual(props(), props({ pos: { x: 11, y: 20 } }))).toBe(false);
    expect(walkerPropsEqual(props(), props({ facing: 'left' }))).toBe(false);
    expect(
      walkerPropsEqual(props(), props({ config: { ...DEFAULT_AVATAR_CONFIG, hair: 'long' } })),
    ).toBe(false);
    expect(walkerPropsEqual(props(), props({ glideMs: 66 }))).toBe(false);
    expect(
      walkerPropsEqual(props(), props({ standingOn: { x: 0, y: 0, width: 1, height: 1 } })),
    ).toBe(false);
    expect(
      walkerPropsEqual(
        props({ pos: { x: 1, y: 2 } }),
        props({ pos: { x: 1, y: 2, z: 3 } as unknown as { x: number; y: number } }),
      ),
    ).toBe(false);
  });
});
