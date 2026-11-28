// Real 3D's piece colours (docs/specs/008-canvas/3d-engine.md "Block models"): the colours a piece's own drawing is
// painted in, so its model is the same wood, fabric and metal. Pure.

import type { FurnitureArt } from '@livehuddle/avatar/furniture-art';
import { mix, parseColour, type Rgb } from './mesh-builder';

export type PieceTones = {
  /** The piece's wash (seat fabric or theme material), as the drawing's unnamed panels take it. */
  seat: Rgb;
  /** The theme's ink, which the drawing outlines and plain legs take. */
  stroke: Rgb;
  /** The drawing's largest panel colour, and its largest face (front) colour. */
  top: Rgb;
  face: Rgb;
};

/** The colours of a drawing, by area: the biggest panel's fill for a top, the biggest face's for a front. */
export function pieceTones(art: FurnitureArt | null, seat: string, stroke: string): PieceTones {
  const s = parseColour(seat);
  const k = parseColour(stroke);
  let top = s;
  let face = mix(s, k, 0.22);
  if (art) {
    const area = (role: string) => {
      const by = new Map<string, number>();
      for (const p of art.front.parts) {
        if (p.role !== role) continue;
        const a = p.tag === 'rect' ? p.w * p.h : p.tag === 'ellipse' ? Math.PI * p.rx * p.ry : 0;
        const key = p.fill ?? seat;
        by.set(key, (by.get(key) ?? 0) + a);
      }
      let best: string | null = null;
      let most = 0;
      for (const [c, a] of by) if (a > most) [best, most] = [c, a];
      return best;
    };
    const t = area('panel');
    const f = area('face');
    if (t) top = parseColour(t);
    if (f) face = parseColour(f);
    else face = mix(top, k, 0.22);
  }
  return { seat: s, stroke: k, top, face };
}
