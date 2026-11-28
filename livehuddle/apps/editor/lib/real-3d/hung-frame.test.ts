import { describe, expect, it } from 'vitest';
import { hungFrame } from './scene-pieces';
import { pieceFrame, frameToCanvas } from './piece-frame';

// 3d-engine.md "Wall pieces sit on their wall": a turning piece's model stands with its back against the wall's face.
describe('hungFrame', () => {
  it("stands a back-wall bookshelf's model against the wall, not off it", () => {
    const box = { id: 'b', shape: 'bookshelf', x: 100, y: 40, width: 120, height: 160 };
    const f = hungFrame(pieceFrame(box), box, {
      line: 40,
      vertical: false,
      dir: 1,
      lo: 0,
      hi: 400,
    });
    // The model's back edge (its footprint's least y) on the canvas.
    const back = frameToCanvas(f, 0, f.foot.y0);
    expect(back.y).toBeGreaterThan(40);
    expect(back.y).toBeLessThan(40 + 10);
  });
});
