// @vitest-environment jsdom
// The 2026-11-18 polish round (docs/specs/008-canvas/3d-view.md): the stage, turned ends, blade names, door presses.
import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@livehuddle/templates';
import type { Element } from '@livehuddle/document';
import {
  SPACE_END_SLACK,
  SPACE_STAGE_LIFT,
  endView,
  isSideFacing,
  seenFootShift,
  seenFromCamera,
  standAttr,
  standsRaised,
} from './space-3d-pieces';
import { runsAway } from './space-3d-turn';
import { spaceWalls } from './space-3d-walls';
import { doorPointAt } from './standing-pieces-on-screen';

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
  it('draws an upright end whole, and cuts one seen from above to the front’s height from its foot', () => {
    expect(endView({ height: 100 }, { height: 110 })).toEqual({ top: 0, height: 110 });
    expect(SPACE_END_SLACK).toBeGreaterThan(1);
    expect(endView({ height: 60 }, { height: 140 })).toEqual({ top: 80, height: 60 });
  });
  it('stands on its footprint’s edge nearest the camera', () => {
    expect(seenFootShift({ width: 200, height: 80 }, 0, 40)).toBe(20);
    expect(seenFootShift({ width: 200, height: 80 }, 1, 40)).toBe(80);
  });
});

describe('a room’s name over a door in a wall running away (runsAway)', () => {
  const across = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
  const down = { a: { x: 0, y: 0 }, b: { x: 0, y: 100 } };
  it('is level across the screen unturned', () => {
    expect(runsAway(across, 0)).toBe(0);
    expect(runsAway(down, 0)).toBe(-1);
    expect(runsAway({ a: down.b, b: down.a }, 0)).toBe(1);
  });
  it('runs away once the camera turns a quarter', () => {
    expect(runsAway(across, 1)).not.toBe(0);
    expect(runsAway(down, 1)).toBe(0);
  });
});

describe('clicking a door in 3D', () => {
  const els = buildTemplate('virtual-office', 0, 0);
  const door = els.find((el) => el.type === 'shape' && el.shape === 'door' && !el.doorClosed)!;
  const room = els.find((el) => el.type === 'shape' && el.shape === 'room')!;
  it('names the door on its doorway, open with a hinge, shut without', () => {
    const open = spaceWalls(els).find((w) => w.kind === 'doorway' && w.doorId === door.id);
    expect(['start', 'end']).toContain(open!.hinge);
    const closed = els.map((el) =>
      el.id === door.id ? ({ ...el, doorClosed: true } as Element) : el,
    );
    const shut = spaceWalls(closed).find((w) => w.kind === 'doorway' && w.doorId === door.id);
    expect(shut).toMatchObject({ shut: true });
    expect(shut!.hinge).toBeUndefined();
  });
  it('reads a press on the doorway as a press at the door', () => {
    const root = document.createElement('div');
    const node = document.createElement('div');
    node.setAttribute('data-space-door-id', door.id);
    node.getBoundingClientRect = () => ({ left: 10, right: 60, top: 10, bottom: 90 }) as DOMRect;
    const stray = document.createElement('div');
    stray.setAttribute('data-space-door-id', 'gone');
    stray.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 100 }) as DOMRect;
    root.append(stray, node);
    const d = door as Extract<Element, { type: 'shape' }>;
    expect(doorPointAt(root, [room, door], { x: 30, y: 50 })).toEqual({
      x: d.x + d.width / 2,
      y: d.y + d.height / 2,
    });
    expect(doorPointAt(root, [room, door], { x: 200, y: 50 })).toBeNull();
  });
});
