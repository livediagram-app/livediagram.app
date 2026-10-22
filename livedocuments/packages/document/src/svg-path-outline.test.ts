import { describe, expect, it, vi } from 'vitest';
import { svgPathSubpaths } from './svg-path-outline';

describe('svgPathSubpaths', () => {
  it('splits a path at each move into open and closed subpaths', () => {
    const subs = svgPathSubpaths('M 0 0 L 10 0 L 10 10 Z M 20 0 L 30 0')!;
    expect(subs).toHaveLength(2);
    expect(subs[0]).toEqual({
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    });
    expect(subs[1]).toEqual({
      closed: false,
      points: [
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
    });
  });

  it('samples an arc by its sweep, as SVG draws it', () => {
    // From (0, 0) to (20, 0) round a radius-10 circle: sweep 1 bulges up (y down).
    const up = svgPathSubpaths('M 0 0 A 10 10 0 0 1 20 0', 12, 4)![0]!.points;
    expect(up).toHaveLength(5);
    expect(up[2]!.x).toBeCloseTo(10, 6);
    expect(up[2]!.y).toBeCloseTo(-10, 6);
    const down = svgPathSubpaths('M 0 0 A 10 10 0 0 0 20 0', 12, 4)![0]!.points;
    expect(down[2]!.y).toBeCloseTo(10, 6);
  });

  it('scales radii too small to reach the end point up, as SVG does', () => {
    const pts = svgPathSubpaths('M 0 0 A 1 1 0 0 1 20 0', 12, 4)![0]!.points;
    expect(pts[2]!.y).toBeCloseTo(-10, 6);
    expect(pts[4]!.x).toBeCloseTo(20, 6);
  });

  it('draws an arc with a zero radius as a straight line', () => {
    const pts = svgPathSubpaths('M 0 0 A 0 5 0 0 1 20 0')![0]!.points;
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
  });

  it('rejects a command it does not read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(svgPathSubpaths('M 0 0 H 10')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[shape-outline] unsupported path command=H');
    warn.mockRestore();
  });
});
