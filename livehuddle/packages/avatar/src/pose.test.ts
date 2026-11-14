import { describe, expect, it } from 'vitest';
import { mergePose, NO_POSE, poseFeet, posePlaced, poseWalking } from './pose';

describe('mergePose', () => {
  it('hands back the same pose for a patch that changes nothing', () => {
    const at = { ...NO_POSE, pos: { x: 1, y: 2 } };
    expect(mergePose(at, {})).toBe(at);
    expect(mergePose(at, { pos: { x: 1, y: 2 }, walking: false, wave: null })).toBe(at);
    expect(mergePose(at, { lift: undefined })).toBe(at);
  });

  it('lays a change over a copy', () => {
    const at = { ...NO_POSE, pos: { x: 1, y: 2 } };
    const moved = mergePose(at, { pos: { x: 3, y: 2 }, walking: true, facing: 'right' });
    expect(moved).not.toBe(at);
    expect(moved).toEqual({ ...at, pos: { x: 3, y: 2 }, walking: true, facing: 'right' });
    expect(at.pos).toEqual({ x: 1, y: 2 });
    expect(mergePose(at, { pos: null }).pos).toBeNull();
    expect(mergePose(NO_POSE, { pos: { x: 0, y: 0 } }).pos).toEqual({ x: 0, y: 0 });
  });

  it('reads the feet and whether the character is placed', () => {
    expect(poseFeet(NO_POSE)).toBeNull();
    expect(posePlaced(NO_POSE)).toBe(false);
    expect(posePlaced({ ...NO_POSE, pos: { x: 0, y: 0 } })).toBe(true);
    expect(poseWalking(NO_POSE)).toBe(false);
    expect(poseWalking({ ...NO_POSE, walking: true })).toBe(true);
  });
});
