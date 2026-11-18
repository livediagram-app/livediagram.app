// Every wall piece in every template stands against a wall, clear of the other pieces
// (docs/specs/009-elements/wall-pieces.md "Only on a wall").
import { describe, expect, it } from 'vitest';
import { mountsOnWall, officeFootprint, snapToWallFace, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

type Box = { x: number; y: number; width: number; height: number };
const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe('template wall pieces', () => {
  for (const t of TEMPLATES) {
    it(`${t.kind}: each wall piece is on a wall and clear of the rest`, () => {
      const els = buildTemplate(t.kind, 0, 0);
      const mounted = els.filter(
        (el): el is Extract<Element, { type: 'shape' }> =>
          el.type === 'shape' && mountsOnWall(el.shape),
      );
      for (const el of mounted) {
        expect(snapToWallFace(el, els), `${el.shape} at ${el.x},${el.y}`).toBe(el);
        for (const o of els) {
          if (o === el || o.type !== 'shape') continue;
          const box = mountsOnWall(o.shape) ? o : officeFootprint(o);
          if (box) expect(meets(el, box), `${el.shape} over ${o.shape}`).toBe(false);
        }
      }
    });
  }
});
