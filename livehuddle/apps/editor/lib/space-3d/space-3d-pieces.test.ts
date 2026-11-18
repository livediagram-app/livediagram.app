import { describe, expect, it } from 'vitest';
import { buildTemplate } from '@livehuddle/templates';
import { SHAPE_KINDS, type Element } from '@livehuddle/document';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { viewArea } from './space-3d-cutaway';
import {
  SPACE_HANG_ACROSS,
  SPACE_SCREEN_MARGIN,
  SPACE_SEAT_LIFT_SHARE,
  hangOnWall,
  pieceQuarters,
  seenFromCamera,
  screenRoomOnWall,
  seatBehind,
  seatLift,
  standAttr,
  standingIdsInArea,
  standingPiecePointAt,
  standsIn3D,
  type StandingOnScreen,
} from './space-3d-pieces';

const shape = (shapeKind: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id: shapeKind,
    type: 'shape',
    shape: shapeKind,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    ...extra,
  }) as unknown as Element;

describe('which pieces stand (docs/specs/008-canvas/3d-view.md "Pieces stand up")', () => {
  it('stands every piece drawn upright', () => {
    for (const kind of [
      'chair',
      'desk',
      'sofa',
      'plant',
      'bookshelf',
      'tree',
      'jukebox',
      'portal',
      'screen',
    ])
      expect(standsIn3D(shape(kind)), kind).toBe(true);
  });

  it('lays floor coverings, walled pieces, wall parts and controls flat', () => {
    for (const kind of [
      'room',
      'corridor',
      'office-pod',
      'fence',
      'door',
      'window',
      'rug',
      'grass',
      'stage',
    ])
      expect(standsIn3D(shape(kind)), kind).toBe(false);
    for (const kind of [
      'pond',
      'swimming-pool',
      'car-park',
      'stairs',
      'avatar-pad',
      'mode-button',
      'sticker',
    ])
      expect(standsIn3D(shape(kind)), kind).toBe(false);
  });

  it('lays every element that is not a shape flat', () => {
    expect(standsIn3D({ ...shape('chair'), type: 'sticky' } as unknown as Element)).toBe(false);
  });

  it('classifies every shape kind, standing most of them', () => {
    const standing = [...SHAPE_KINDS].filter((k) => standsIn3D(shape(k)));
    expect(standing.length).toBeGreaterThan(SHAPE_KINDS.size / 2);
  });

  it('stands an upright piece about its front edge and a turned one about its middle', () => {
    expect(standAttr(shape('chair'))).toBe('base');
    expect(standAttr(shape('chair', { rotation: 360 }))).toBe('base');
    expect(standAttr(shape('chair', { rotation: 15 }))).toBe('centre');
    // An Office Pod lies flat; its furniture stands inside its walls (3d-view.md "Which pieces").
    expect(standAttr(shape('office-pod'))).toBe('inside');
    expect(standAttr(shape('rug'))).toBeUndefined();
  });
});

describe('the near pieces', () => {
  const office = buildTemplate('virtual-office', 0, 0);

  it('stands only the pieces whose box meets the area', () => {
    const area = viewArea({ zoom: 1, offset: { x: 0, y: 0 } }, { width: 1200, height: 800 });
    const near = standingIdsInArea(office, area);
    expect(near.size).toBeGreaterThan(0);
    for (const el of office) {
      if (!near.has(el.id)) continue;
      expect(standsIn3D(el)).toBe(true);
    }
    const far = viewArea(
      { zoom: 1, offset: { x: -100000, y: -100000 } },
      { width: 1200, height: 800 },
    );
    expect(standingIdsInArea(office, far).size).toBe(0);
  });

  it('chooses from a big Space within a CPU budget', () => {
    const big = Array.from({ length: 20 }, (_, i) =>
      buildTemplate('virtual-office', i * 2000, 0),
    ).flat();
    const area = viewArea({ zoom: 1, offset: { x: 0, y: 0 } }, { width: 1200, height: 800 });
    expect(cpuMsOf(() => standingIdsInArea(big, area))).toBeLessThan(20);
  });
});

describe('the seat lift', () => {
  const chair = { x: 0, y: 100, width: 64, height: 72 };

  it('draws a sitter near the front edge in front of the piece', () => {
    expect(seatLift(chair, { x: 32, y: 100 + 72 * 0.62 })).toBe(Math.ceil(72 * 0.38) + 1);
    expect(seatLift(chair, { x: 32, y: 172 })).toBe(1);
  });

  it('draws a sitter deep in the piece over it too, with their legs behind its front', () => {
    const deep = { x: 32, y: 100 + 72 * 0.26 };
    expect(seatLift(chair, deep)).toBe(Math.ceil(72 - 72 * 0.26) + 1);
    expect(seatBehind(chair, deep)).toBe(true);
    const edge = 100 + 72 - 72 * SPACE_SEAT_LIFT_SHARE;
    expect(seatBehind(chair, { x: 32, y: edge + 1 })).toBe(false);
    expect(seatBehind(chair, { x: 32, y: 200 })).toBe(false);
    expect(seatBehind(null, deep)).toBe(false);
  });

  it('lifts nobody standing in front of the piece, or with no piece', () => {
    expect(seatLift(chair, { x: 32, y: 200 })).toBe(0);
    expect(seatLift(null, { x: 32, y: 120 })).toBe(0);
    expect(seatLift(undefined, { x: 32, y: 120 })).toBe(0);
  });
});

describe('a press on a standing piece', () => {
  const piece = (y: number, rect: StandingOnScreen['rect'], rotated = false): StandingOnScreen => ({
    box: { x: 100, y, width: 50, height: 40 },
    rect,
    rotated,
  });

  it("maps the press back into the piece's box", () => {
    const p = piece(200, { left: 10, top: 20, width: 100, height: 80 });
    expect(standingPiecePointAt([p], { x: 60, y: 60 })).toEqual({ x: 125, y: 220 });
  });

  it('picks the piece nearest the camera where two overlap', () => {
    const back = piece(100, { left: 0, top: 0, width: 100, height: 100 });
    const front = piece(300, { left: 50, top: 50, width: 100, height: 100 });
    expect(standingPiecePointAt([front, back], { x: 75, y: 75 })!.y).toBeGreaterThanOrEqual(300);
    expect(standingPiecePointAt([back, front], { x: 75, y: 75 })!.y).toBeGreaterThanOrEqual(300);
  });

  it('answers a turned piece with its middle', () => {
    const p = piece(200, { left: 0, top: 0, width: 100, height: 100 }, true);
    expect(standingPiecePointAt([p], { x: 5, y: 5 })).toEqual({ x: 125, y: 220 });
  });

  it('answers null off every piece, and skips an empty rect', () => {
    const p = piece(200, { left: 0, top: 0, width: 100, height: 100 });
    expect(standingPiecePointAt([p], { x: 500, y: 5 })).toBeNull();
    expect(standingPiecePointAt([p], { x: 5, y: 500 })).toBeNull();
    expect(
      standingPiecePointAt([piece(0, { left: 0, top: 0, width: 0, height: 0 })], { x: 0, y: 0 }),
    ).toBeNull();
    expect(standingPiecePointAt([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('wall pieces hang on the wall (3d-view.md "Wall pieces hang on the wall")', () => {
  const back = { a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, kind: 'wall' };

  it('hangs a piece below a back wall on it, its foot a hair in front of the face', () => {
    const sign = shape('room-sign', { x: 100, y: 20, width: 60, height: 30 });
    expect(hangOnWall(sign, [back])).toBe(0 + 1 - 50);
  });

  it('hangs a piece over a wall line, or just behind it, on that wall', () => {
    const sign = shape('room-sign', { x: 100, y: -30, width: 60, height: 30 });
    expect(hangOnWall(sign, [back])).toBe(1);
    const far = shape('room-sign', {
      x: 100,
      y: -30 - SPACE_HANG_ACROSS - 10,
      width: 60,
      height: 30,
    });
    expect(hangOnWall(far, [back])).toBeNull();
  });

  it('hangs nothing that does not hang, or is turned', () => {
    expect(hangOnWall(shape('desk', { x: 100, y: 20 }), [back])).toBeNull();
    expect(hangOnWall(shape('room-sign', { x: 100, y: 20, rotation: 90 }), [back])).toBeNull();
  });

  it('lets a Screen grow to its wall run, less a margin each end, about its middle', () => {
    const screen = shape('screen', { x: 150, y: 20, width: 100, height: 60 });
    const dy = hangOnWall(screen, [back])!;
    expect(screenRoomOnWall(screen, [back], dy)).toBe(2 * (200 - SPACE_SCREEN_MARGIN));
    const nearEnd = shape('screen', { x: 0, y: 20, width: 100, height: 60 });
    expect(screenRoomOnWall(nearEnd, [back], hangOnWall(nearEnd, [back])!)).toBe(
      2 * (50 - SPACE_SCREEN_MARGIN),
    );
    expect(screenRoomOnWall(shape('room-sign', { x: 150, y: 20 }), [back], dy)).toBeNull();
  });
});

describe('pieces turned on the plan are seen from the camera (3d-view.md "Turning the camera")', () => {
  it("reads a quarter-turned piece's turn, and none for another angle", () => {
    expect(pieceQuarters(shape('sofa'))).toBe(0);
    expect(pieceQuarters(shape('sofa', { rotation: 90 }))).toBe(1);
    expect(pieceQuarters(shape('sofa', { rotation: -90 }))).toBe(3);
    expect(pieceQuarters(shape('sofa', { rotation: 45 }))).toBeNull();
  });
  it('sees a quarter-turned sofa from the camera, not one at 45 degrees', () => {
    expect(seenFromCamera(shape('sofa', { rotation: 90 }))).toBe(true);
    expect(seenFromCamera(shape('sofa', { rotation: 45 }))).toBe(false);
  });
});
