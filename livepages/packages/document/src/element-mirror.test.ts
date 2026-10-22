import { describe, expect, it } from 'vitest';
import type { FreehandElement, ShapeElement, TextElement } from './element-types';
import { layOutPages, newLogoPage } from './page';
import { mirrorElement, twinFor } from './element-mirror';
import { decodeStrokePoints } from './stroke-points-cache';
import { encodeStrokePoints } from './stroke-points';

// docs/specs/007-editor/logo-pages.md "Mirror".
describe('mirrorElement', () => {
  it('reflects a shape box across the axis and turns it the other way', () => {
    const s: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'triangle',
      x: 10,
      y: 5,
      width: 30,
      height: 20,
      rotation: 15,
    };
    expect(mirrorElement(s, 100)).toMatchObject({ x: 160, y: 5, rotation: -15 });
  });

  it("reflects a stroke's points, keeping its pressures", () => {
    const f: FreehandElement = {
      id: 'f',
      type: 'freehand',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      closed: false,
      packedPoints: encodeStrokePoints(
        [
          { nx: 0, ny: 0 },
          { nx: 0.25, ny: 1 },
        ],
        [0.5, 1],
      ),
    };
    const pts = decodeStrokePoints(mirrorElement(f, 0).packedPoints);
    expect(pts.nx[0]).toBeCloseTo(1);
    expect(pts.nx[1]).toBeCloseTo(0.75);
    expect(pts.pressures).not.toBeNull();
  });
});

describe('twinFor', () => {
  const pages = layOutPages([newLogoPage('l')]);
  const shape = (x: number): ShapeElement => ({
    id: 's',
    type: 'shape',
    shape: 'circle',
    x,
    y: -50,
    width: 100,
    height: 100,
  });
  const text: TextElement = { id: 't', type: 'text', x: -300, y: 0, width: 100, height: 20 };

  it('reflects across the logo page centre', () => {
    expect(twinFor(shape(-300), pages, 'drawing')?.x).toBe(200);
  });

  it('gives nothing on the axis, off the page, or for text while drawing', () => {
    expect(twinFor(shape(-55), pages, 'drawing')).toBeNull();
    expect(twinFor(shape(5000), pages, 'drawing')).toBeNull();
    expect(twinFor(text, pages, 'drawing')).toBeNull();
  });

  it('copies text and images, unlocked, with Mirror Copy', () => {
    expect(twinFor({ ...text, locked: true }, pages, 'copy')).toMatchObject({
      x: 200,
      locked: false,
    });
  });
});

describe('mirrorElement turning', () => {
  it('turns a rotated element the other way', () => {
    const t = { id: 't', type: 'text', x: 0, y: 0, width: 10, height: 10, rotation: 15 } as const;
    expect(mirrorElement({ ...t }, 50).rotation).toBe(-15);
  });
});
