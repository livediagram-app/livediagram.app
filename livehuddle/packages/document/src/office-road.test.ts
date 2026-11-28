import { describe, expect, it } from 'vitest';
import { ROAD_DASH, ROAD_TONES, roadDashes, roadKerb, roadParts, roadRun } from './office-road';
import { turnPiece, turnPieceBy, turnsWithFacing } from './furniture-facing';
import { paintOrder } from './paint-order';
import { createShape } from './shape-factory';
import { isFloorShape } from './index';
import type { Element } from './index';

// The Road (docs/specs/009-elements/road.md): its drawing, its turn and its place as a floor piece.
describe('roadParts', () => {
  it('draws nothing at no size', () => {
    expect(roadParts(0, 136)).toEqual([]);
    expect(roadParts(480, 0)).toEqual([]);
  });

  it('lays the asphalt first, then the kerbs along both long sides', () => {
    const parts = roadParts(480, 136);
    expect(parts[0]).toMatchObject({ tag: 'rect', role: 'floor', w: 480, h: 136 });
    const kerbs = parts.filter((p) => p.tag === 'rect' && p.fill === ROAD_TONES.kerb);
    expect(kerbs).toHaveLength(2);
    expect(kerbs.map((k) => k.tag === 'rect' && k.y)).toEqual([0, 136 - 8]);
    expect(kerbs.every((k) => k.tag === 'rect' && k.w === 480)).toBe(true);
  });

  it('turns its lines with it when it runs down the canvas', () => {
    const kerbs = roadParts(136, 480).filter((p) => p.tag === 'rect' && p.fill === ROAD_TONES.kerb);
    expect(kerbs.map((k) => k.tag === 'rect' && k.x)).toEqual([0, 136 - 8]);
    expect(kerbs.every((k) => k.tag === 'rect' && k.h === 480)).toBe(true);
  });

  it('keeps its centre dashes whole and centred however long the road', () => {
    for (const length of [24, 100, 480, 1337]) {
      const starts = roadDashes(length);
      expect(starts.length).toBeGreaterThan(0);
      expect(starts[0]).toBeGreaterThanOrEqual(0);
      expect(starts.at(-1)! + ROAD_DASH.long).toBeLessThanOrEqual(length + 1e-9);
      expect(starts[0]).toBeCloseTo(length - (starts.at(-1)! + ROAD_DASH.long));
    }
    expect(roadDashes(10)).toEqual([]);
    const dashes = roadParts(480, 136).filter((p) => p.fill === ROAD_TONES.line);
    expect(dashes).toHaveLength(roadDashes(480).length);
  });

  it('runs along the longer side and thins its kerb on a narrow road', () => {
    expect(roadRun(480, 136)).toEqual({ horizontal: true, length: 480, across: 136 });
    expect(roadRun(100, 300)).toEqual({ horizontal: false, length: 300, across: 100 });
    expect(roadKerb(136)).toBe(8);
    expect(roadKerb(50)).toBe(5);
  });
});

describe('the Road as a piece', () => {
  const road = { ...createShape('road', 100, 100), id: 'r' };

  it('is a wordless floor piece at 480 x 136 that is not aspect locked', () => {
    expect(road).toMatchObject({ width: 480, height: 136, label: '' });
    expect((road as { aspectLocked?: boolean }).aspectLocked).toBeFalsy();
    expect(isFloorShape('road')).toBe(true);
  });

  it('turns as a rug does: its sides swap about its middle', () => {
    expect(turnsWithFacing('road')).toBe(true);
    const down = turnPieceBy(road, 1);
    expect(down).toMatchObject({ width: 136, height: 480, chairFacing: 'e' });
    expect(down.x + down.width / 2).toBe(road.x + road.width / 2);
    expect(down.y + down.height / 2).toBe(road.y + road.height / 2);
    const back = turnPiece(down, 's');
    expect(back).toMatchObject({ width: 480, height: 136 });
  });

  it('paints over the lawn and under the pieces', () => {
    const grass = { ...createShape('grass', 0, 0), id: 'g' } as Element;
    const bench = { ...createShape('bench', 0, 0), id: 'b' } as Element;
    const order = paintOrder([bench, road as Element, grass]).map((e) => e.id);
    expect(order).toEqual(['g', 'r', 'b']);
  });
});
