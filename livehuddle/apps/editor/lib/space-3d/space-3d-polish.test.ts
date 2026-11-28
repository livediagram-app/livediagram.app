// @vitest-environment jsdom
// The 2026-11-18 polish round (docs/specs/008-canvas/3d-view.md): the stage, turned ends, blade names, door presses.
import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@livehuddle/templates';
import type { Element } from '@livehuddle/document';
import {
  SIDE_IS_ELEVATION,
  SPACE_STAGE_LIFT,
  endSlice,
  facesCameraFlat,
  isSideFacing,
  seenFootShift,
  seenFromCamera,
  standAttr,
  standsRaised,
} from './space-3d-pieces';
import { spaceWalls } from './space-3d-walls';

const piece = (kind: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id: kind,
    type: 'shape',
    shape: kind,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    ...extra,
  }) as unknown as Element;

describe('a stage stands up', () => {
  it('rises on its sides, its curtains along their line', () => {
    expect(standAttr(piece('stage'))).toBe('raised');
    expect(standAttr(piece('stage-curtains'))).toBe('along');
    expect(seenFromCamera(piece('stage-curtains'))).toBe(false);
  });
  it('stands four stage-high sides', () => {
    const walls = spaceWalls([piece('stage', { x: 10, y: 20, width: 200, height: 100 })]);
    expect(walls).toHaveLength(4);
    expect(walls.every((w) => w.kind === 'stage' && w.height === SPACE_STAGE_LIFT)).toBe(true);
  });
  it('lifts who stands on it, not who stands beside it', () => {
    const stages = [{ x: 0, y: 0, width: 100, height: 50 }];
    expect(standsRaised(stages, { x: 50, y: 25 })).toBe(SPACE_STAGE_LIFT);
    expect(standsRaised(stages, { x: 150, y: 25 })).toBe(0);
    expect(standsRaised(stages, null)).toBe(0);
  });
});

describe('a turned piece’s end', () => {
  it('knows the side facings', () => {
    expect(isSideFacing('e')).toBe(true);
    expect(isSideFacing('w')).toBe(true);
    expect(isSideFacing('n')).toBe(false);
  });
  it('shows the end of the front drawing for a piece drawn from above, from the near end', () => {
    expect(endSlice({ width: 120, height: 132 }, { width: 50 }, 'e')).toEqual({ x: 0, width: 50 });
    expect(endSlice({ width: 120, height: 132 }, { width: 50 }, 'w')).toEqual({ x: 70, width: 50 });
    // A desk's side drawing is its box turned: its end is half its front at most.
    expect(endSlice({ width: 120, height: 112 }, { width: 112 }, 'e')).toEqual({ x: 0, width: 56 });
  });
  it('stands an upright side drawing as it is', () => {
    expect(SIDE_IS_ELEVATION.has('chair')).toBe(true);
    expect(SIDE_IS_ELEVATION.has('desk')).toBe(false);
    expect(SIDE_IS_ELEVATION.has('printer')).toBe(false);
  });
  it('stands on its footprint’s edge nearest the camera', () => {
    expect(seenFootShift({ width: 200, height: 80 }, 0, 40)).toBe(20);
    expect(seenFootShift({ width: 200, height: 80 }, 1, 40)).toBe(80);
  });
});

describe('clicking a door in 3D', () => {
  const els = buildTemplate('virtual-office', 0, 0);
  const door = els.find((el) => el.type === 'shape' && el.shape === 'door')!;
  it('names the door on its doorway, with its hinge', () => {
    const open = spaceWalls(els).find((w) => w.kind === 'doorway' && w.doorId === door.id);
    expect(['start', 'end']).toContain(open!.hinge);
  });
});

describe('flat pictures turn with the camera', () => {
  it('turns an Avatar Pad and the board controls, not a rug', () => {
    expect(facesCameraFlat(piece('avatar-pad'))).toBe(true);
    expect(facesCameraFlat(piece('timer'))).toBe(true);
    expect(facesCameraFlat(piece('rug'))).toBe(false);
  });
});
