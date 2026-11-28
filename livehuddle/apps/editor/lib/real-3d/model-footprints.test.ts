import { afterEach, describe, expect, it } from 'vitest';
import { officeFootprints, setModelFootprints } from '@livehuddle/avatar/office-geometry';
import { pieceFacing } from '@livehuddle/document';
import { frameToCanvas, pieceFrame } from './piece-frame';

// 3d-engine.md "Block models": in 3D a turned piece blocks where its model stands (the owner, 2026-11-27: "I seem to
// be able to walk into a bookcase").
afterEach(() => setModelFootprints(null));

const box = (pts: { x: number; y: number }[]) => ({
  x0: Math.min(...pts.map((p) => p.x)),
  y0: Math.min(...pts.map((p) => p.y)),
  x1: Math.max(...pts.map((p) => p.x)),
  y1: Math.max(...pts.map((p) => p.y)),
});

describe('model footprints', () => {
  for (const shape of ['bookshelf', 'bar', 'reception-desk'])
    for (const facing of ['n', 'e', 's', 'w'] as const)
      it(`${shape} facing ${facing} blocks where its model stands`, () => {
        setModelFootprints(pieceFacing);
        const el = { id: 'p', shape, x: 100, y: 50, width: 52, height: 196, chairFacing: facing };
        const f = pieceFrame(el);
        const want = box([
          frameToCanvas(f, f.foot.x0, f.foot.y0),
          frameToCanvas(f, f.foot.x1, f.foot.y1),
        ]);
        const [got] = officeFootprints(el);
        expect(got).toBeDefined();
        expect(got!.x).toBeCloseTo(want.x0, 3);
        expect(got!.y).toBeCloseTo(want.y0, 3);
        expect(got!.x + got!.width).toBeCloseTo(want.x1, 3);
        expect(got!.y + got!.height).toBeCloseTo(want.y1, 3);
      });
});
