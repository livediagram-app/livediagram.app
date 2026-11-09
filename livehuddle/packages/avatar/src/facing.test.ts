import { describe, expect, it } from 'vitest';
import {
  facingSwapsBox,
  facingTurn,
  facingView,
  isSeatFacing,
  mirrorFraction,
  turnedBox,
  turnedSitterFacing,
  turnFacing,
} from './facing';

// docs/specs/009-elements/furniture-facing.md
describe('facings', () => {
  it('names the four facings and nothing else', () => {
    expect(['n', 'e', 's', 'w'].every(isSeatFacing)).toBe(true);
    expect(isSeatFacing('x')).toBe(false);
    expect(isSeatFacing(undefined)).toBe(false);
  });

  it('shows the front, back or side, mirroring the side for facing right', () => {
    expect(facingView('n')).toEqual({ view: 'front', mirrored: false });
    expect(facingView('s')).toEqual({ view: 'back', mirrored: false });
    expect(facingView('e')).toEqual({ view: 'side', mirrored: false });
    expect(facingView('w')).toEqual({ view: 'side', mirrored: true });
  });

  it('turns clockwise Down, Left, Up, Right and back, and anticlockwise the other way', () => {
    expect(turnFacing('n', 1)).toBe('e');
    expect(turnFacing('e', 1)).toBe('s');
    expect(turnFacing('s', 1)).toBe('w');
    expect(turnFacing('w', 1)).toBe('n');
    expect(turnFacing('n', -1)).toBe('w');
    expect(turnFacing('e', -5)).toBe('n');
    expect(turnFacing('s', 6)).toBe('n');
  });

  it('measures a turn in clockwise degrees and knows when it lays a piece on its side', () => {
    expect(facingTurn('n', 'e')).toBe(90);
    expect(facingTurn('e', 'n')).toBe(270);
    expect(facingTurn('w', 'e')).toBe(180);
    expect(facingTurn('s', 's')).toBe(0);
    expect(facingSwapsBox('n', 'e')).toBe(true);
    expect(facingSwapsBox('w', 'n')).toBe(true);
    expect(facingSwapsBox('n', 's')).toBe(false);
  });

  it('turns a sitter with the drawing they sit on, the mirrored side swapping only left and right', () => {
    expect(['n', 'e', 's', 'w'].map((f) => turnedSitterFacing('down', f as 'n'))).toEqual([
      'down',
      'left',
      'up',
      'right',
    ]);
    // A seat facing right in the front (a booth's left bench) faces down from the top of the side drawing, and still
    // down in its mirror, where the same bench is still at the top.
    expect(turnedSitterFacing('right', 'e')).toBe('down');
    expect(turnedSitterFacing('right', 'w')).toBe('down');
    expect(turnedSitterFacing('right', 's')).toBe('left');
    expect(turnedSitterFacing('up', 'e')).toBe('right');
    expect(turnedSitterFacing('up', 'w')).toBe('left');
  });

  it('mirrors a fraction of the side drawing for facing right', () => {
    expect(mirrorFraction({ x0: 0.1, x1: 0.4, y0: 0.5, y1: 0.9 })).toEqual({
      x0: 0.6,
      x1: 0.9,
      y0: 0.5,
      y1: 0.9,
    });
  });
});

describe('turnedBox', () => {
  it('keeps the centre and the scale, taking the new drawing proportions', () => {
    // Lockers 136 x 132 drawn at half size turned onto a 48 x 220 side drawing.
    const box = { x: 100, y: 100, width: 68, height: 66 };
    expect(turnedBox(box, { width: 136, height: 132 }, { width: 48, height: 220 })).toEqual({
      x: 122,
      y: 78,
      width: 24,
      height: 110,
    });
  });

  it('measures the scale from the drawing as fitted, so a letterboxed piece keeps its drawn size', () => {
    // A 120 x 112 desk in a box stretched twice as wide: drawn at scale 1, so it turns at scale 1.
    const box = { x: 0, y: 0, width: 240, height: 112 };
    const turned = turnedBox(box, { width: 120, height: 112 }, { width: 112, height: 120 });
    expect(turned).toEqual({ x: 64, y: -4, width: 112, height: 120 });
  });

  it('keeps the box of a turn between drawings of the same proportions', () => {
    const box = { x: 5, y: 6, width: 70, height: 80 };
    expect(turnedBox(box, { width: 64, height: 72 }, { width: 64, height: 72 })).toEqual(box);
  });

  it('keeps a box of no size as it is', () => {
    const box = { x: 5, y: 6, width: 0, height: 0 };
    expect(turnedBox(box, { width: 64, height: 72 }, { width: 72, height: 64 })).toEqual(box);
  });
});
