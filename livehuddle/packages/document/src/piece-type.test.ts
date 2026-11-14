import { describe, expect, it } from 'vitest';
import { applyShapeVariant, changesType, createShape, turnPiece, withPieceType } from './index';

// docs/specs/009-elements/office.md "A piece's type": a placed piece changes its type in place, keeping its data.

const centre = (el: { x: number; y: number; width: number; height: number }) => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});

describe('changesType', () => {
  it('names the Door, the Rug, the Corridor and the Meeting Table, and no other kind', () => {
    for (const kind of ['door', 'rug', 'corridor', 'meeting-table'])
      expect(changesType(kind)).toBe(true);
    for (const kind of ['room', 'chair', 'plant', 'rectangle'])
      expect(changesType(kind)).toBe(false);
  });
});

// office.md "Rug": turned, a rug lies the other way round on its side, its box's sides swapped, whatever its type.
describe('turning a rug', () => {
  it('swaps its box about its centre on its side and keeps it from behind, so a Round rug stays a circle', () => {
    const round = applyShapeVariant(createShape('rug', 40, 40), 'round');
    const turned = turnPiece(round, 'e');
    expect([turned.width, turned.height]).toEqual([160, 160]);
    const persian = { ...applyShapeVariant(createShape('rug', 0, 0), 'persian'), rotation: 10 };
    const side = turnPiece(persian, 'w');
    expect([side.width, side.height]).toEqual([170, 260]);
    expect(centre(side)).toEqual(centre(persian));
    expect(side.chairFacing).toBe('w');
    expect(side.rotation).toBeUndefined();
    const back = turnPiece(side, 'e');
    expect([back.width, back.height]).toEqual([170, 260]);
    expect([turnPiece(persian, 's').width, turnPiece(persian, 's').height]).toEqual([260, 170]);
  });
});

describe('withPieceType', () => {
  it('turns a Door into a Double Door about its centre, keeping its angle, name, colours and id', () => {
    const door = {
      ...createShape('door', 300, 200),
      rotation: 90,
      label: 'Front',
      strokeColor: '#123456',
    };
    const double = withPieceType(door, 'double');
    expect(double.id).toBe(door.id);
    expect(double.variant).toBe('double');
    expect([double.width, double.height]).toEqual([144, 24]);
    expect(centre(double)).toEqual(centre(door));
    expect(double.rotation).toBe(90);
    expect(double.label).toBe('Front');
    expect(double.strokeColor).toBe('#123456');
  });

  it('clears the variant for the kind’s first type, taking the plain tile’s size back', () => {
    const plain = createShape('door', 0, 0);
    const sliding = withPieceType(plain, 'sliding');
    const back = withPieceType(sliding, 'swing');
    expect('variant' in back).toBe(false);
    expect([back.width, back.height]).toEqual([plain.width, plain.height]);
    expect(centre(back)).toEqual(centre(sliding));
  });

  it('gives a rug its type’s size and lock: a Round rug stays a circle, a Runner takes any box', () => {
    const oval = createShape('rug', 100, 100);
    const round = withPieceType(oval, 'round');
    expect([round.width, round.height]).toEqual([160, 160]);
    expect(round.aspectLocked).toBe(true);
    const runner = withPieceType(round, 'runner');
    expect([runner.width, runner.height]).toEqual([320, 88]);
    expect(runner.aspectLocked).toBeUndefined();
    expect(centre(runner)).toEqual(centre(oval));
  });

  it('turns a Meeting Table into a Long Table and back, unlocking and relocking its aspect', () => {
    const table = createShape('meeting-table', 0, 0);
    const long = withPieceType(table, 'long');
    expect(long.variant).toBe('long');
    expect([long.width, long.height]).toEqual([560, 168]);
    expect(long.aspectLocked).toBeUndefined();
    const back = withPieceType(long, 'standard');
    expect('variant' in back).toBe(false);
    expect([back.width, back.height]).toEqual([table.width, table.height]);
    expect(back.aspectLocked).toBe(table.aspectLocked);
  });

  it('keeps a turned piece on its side, its box the new type’s turned box', () => {
    const table = turnPiece(createShape('meeting-table', 0, 0), 'e');
    const long = withPieceType(table, 'long');
    expect(long.chairFacing).toBe('e');
    const expected = turnPiece(applyShapeVariant(createShape('meeting-table', 0, 0), 'long'), 'e');
    expect([long.width, long.height]).toEqual([expected.width, expected.height]);
    expect(long.height).toBeGreaterThan(long.width);
    const rug = turnPiece(createShape('rug', 0, 0), 'w');
    const runner = withPieceType(rug, 'runner');
    expect(runner.chairFacing).toBe('w');
    expect([runner.width, runner.height]).toEqual([88, 320]);
  });

  it('turns a corridor into a Corner, keeping its rotation', () => {
    const straight = { ...createShape('corridor', 0, 0), rotation: 45 };
    const corner = withPieceType(straight, 'corner');
    expect(corner.variant).toBe('corner');
    expect([corner.width, corner.height]).toEqual([360, 360]);
    expect(corner.rotation).toBe(45);
  });

  it('leaves a piece as it was for its own type, a type its kind does not take, or a kind with no types', () => {
    const rug = applyShapeVariant(createShape('rug', 0, 0), 'kilim');
    expect(withPieceType(rug, 'kilim')).toBe(rug);
    expect(withPieceType(rug, 'double')).toBe(rug);
    const room = createShape('room', 0, 0);
    expect(withPieceType(room, 'glass')).toBe(room);
  });
});
