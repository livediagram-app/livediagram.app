import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import {
  defaultPieceFacing,
  isFurnitureShape,
  pieceArt,
  pieceFacing,
  TURNING_SHAPES,
  turnPiece,
  turnPieceBy,
  turnsWithFacing,
} from './furniture-facing';
import { rotationOf, supportsRotation } from './rotation';
import { dropUnturnableRotation } from './unturnable-rotation';
import type { BoxedElement, ShapeElement } from './index';

// docs/specs/009-elements/furniture-facing.md: every piece with a front faces four ways, and a turn keeps its centre
// and its scale.

const centre = (el: { x: number; y: number; width: number; height: number }) => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});

describe('what turns', () => {
  it('turns every piece with a front, and none that read the same from every side or hang on the back wall', () => {
    expect(turnsWithFacing('sofa')).toBe(true);
    expect(turnsWithFacing('bookshelf')).toBe(true);
    expect(turnsWithFacing('meeting-table')).toBe(true);
    for (const kind of ['plant', 'room', 'fence', 'square'])
      expect(turnsWithFacing(kind)).toBe(false);
  });

  it('draws every piece that turns from three drawings', () => {
    for (const kind of TURNING_SHAPES) {
      const art = pieceArt(kind);
      expect(art, kind).not.toBeNull();
      expect(art!.front.parts.length, kind).toBeGreaterThan(0);
    }
    expect(pieceArt('square')).toBeNull();
  });

  // A Rug's back is its front: it is flat, so from behind it is the same pattern.
  it('gives every piece that turns a back and a side of its own', () => {
    for (const kind of TURNING_SHAPES) {
      const art = pieceArt(kind)!;
      if (kind !== 'rug') expect(art.back, `${kind} back`).not.toEqual(art.front);
      expect(art.side, `${kind} side`).not.toEqual(art.front);
    }
  });

  it('never takes the ordinary rotation, and a stored one is dropped and drawn upright', () => {
    expect(isFurnitureShape('sofa')).toBe(true);
    expect(isFurnitureShape('plant')).toBe(true);
    expect(isFurnitureShape('square')).toBe(false);
    const sofa = { ...createShape('sofa', 0, 0), rotation: 90 } as BoxedElement;
    expect(supportsRotation(sofa)).toBe(false);
    expect(rotationOf(sofa)).toBe(0);
    const [stored] = dropUnturnableRotation([sofa]);
    expect(stored).not.toHaveProperty('rotation');
    expect(stored).toMatchObject({ x: sofa.x, y: sofa.y, width: sofa.width, height: sofa.height });
  });
});

describe('a piece facing', () => {
  it('defaults to Down, and Up for the pieces whose sitter faces up at what they use', () => {
    expect(defaultPieceFacing('sofa')).toBe('n');
    expect(defaultPieceFacing('bookshelf')).toBe('n');
    expect(defaultPieceFacing('desk')).toBe('s');
  });

  it('is its own when set, its default when not, and Down on a piece that never turns', () => {
    const sofa = createShape('sofa', 0, 0);
    expect(pieceFacing(sofa)).toBe('n');
    expect(pieceFacing({ ...sofa, chairFacing: 'e' })).toBe('e');
    expect(pieceFacing({ shape: 'plant', chairFacing: 'e' })).toBe('n');
    expect(pieceFacing({ shape: 'desk' })).toBe('s');
  });
});

describe('a turn', () => {
  it('keeps the centre and gives the box the turned drawing proportions', () => {
    const sofa = createShape('sofa', 100, 50);
    const side = turnPiece(sofa, 'e');
    expect(side.chairFacing).toBe('e');
    expect(centre(side).x).toBeCloseTo(centre(sofa).x);
    expect(centre(side).y).toBeCloseTo(centre(sofa).y);
    const art = pieceArt('sofa')!;
    expect(side.width / side.height).toBeCloseTo(art.side.width / art.side.height);
    // And back again to the box it had, give or take the slack a box not quite the drawing's proportions has.
    const back = turnPiece(side, 'n');
    expect(back.width).toBeCloseTo(sofa.width, 0);
    expect(back.height).toBeCloseTo(sofa.height, 0);
    expect(centre(back).x).toBeCloseTo(centre(sofa).x);
  });

  it('drops a rotation stored before furniture stopped rotating', () => {
    const sofa = { ...createShape('sofa', 0, 0), rotation: 45 } as ShapeElement;
    expect(turnPiece(sofa, 's')).not.toHaveProperty('rotation');
  });

  it('turns a quarter at a time, either way, round to where it began', () => {
    let shelf = createShape('bookshelf', 0, 0);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      shelf = turnPieceBy(shelf, 1);
      seen.push(shelf.chairFacing!);
    }
    expect(seen).toEqual(['e', 's', 'w', 'n']);
    expect(turnPieceBy(shelf, -1).chairFacing).toBe('w');
  });

  it('leaves a piece that does not turn as it is', () => {
    const plant = createShape('plant', 0, 0);
    expect(turnPiece(plant, 'e')).toBe(plant);
    expect(turnPieceBy(plant, 1)).toBe(plant);
  });
});
