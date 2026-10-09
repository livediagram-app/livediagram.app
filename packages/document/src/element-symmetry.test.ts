// Mirror's symmetry (docs/specs/007-editor/logo-pages.md "Mirror").
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIRROR,
  freehandCanvasPoints,
  layOutIllustratePages,
  mapElement,
  newLogoPage,
  symmetryMaps,
  symmetryTwins,
  encodeStrokePoints,
  type BoxedElement,
  type FreehandElement,
  type MirroredPage,
  type MirrorSettings,
} from './index';

const [laid] = layOutIllustratePages([newLogoPage('l')]);
const r = laid!.rect;
const cx = r.x + r.width / 2;
const cy = r.y + r.height / 2;
const on = (mirror: Partial<MirrorSettings>): MirroredPage[] => [
  { ...laid!, mirror: { ...DEFAULT_MIRROR, ...mirror } },
];

const square = {
  id: 's',
  type: 'shape',
  shape: 'square',
  x: cx + 100,
  y: cy - 300,
  width: 40,
  height: 40,
} as BoxedElement;
const stroke = {
  id: 'f',
  type: 'freehand',
  closed: false,
  x: cx + 100,
  y: cy + 100,
  width: 100,
  height: 50,
  packedPoints: encodeStrokePoints([
    { nx: 0, ny: 0 },
    { nx: 1, ny: 1 },
  ]),
} as FreehandElement;
const centre = (el: BoxedElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

describe('symmetry', () => {
  it('counts its maps: one reflection, three for both, copies less one when radial', () => {
    expect(symmetryMaps(r, { ...DEFAULT_MIRROR, axis: 'vertical' })).toHaveLength(1);
    expect(symmetryMaps(r, { ...DEFAULT_MIRROR, axis: 'horizontal' })).toHaveLength(1);
    expect(symmetryMaps(r, { ...DEFAULT_MIRROR, axis: 'both' })).toHaveLength(3);
    expect(symmetryMaps(r, { ...DEFAULT_MIRROR, axis: 'radial', copies: 6 })).toHaveLength(5);
  });

  it('reflects a shape across the horizontal centre line', () => {
    const [twin] = symmetryTwins(square, on({ axis: 'horizontal' }));
    expect(centre(twin!).x).toBeCloseTo(centre(square).x);
    expect(centre(twin!).y).toBeCloseTo(2 * cy - centre(square).y);
  });

  it('turns a shape round the centre, its rotation following', () => {
    const twins = symmetryTwins(square, on({ axis: 'radial', copies: 4 }));
    expect(twins).toHaveLength(3);
    const quarter = twins[0]! as BoxedElement & { rotation?: number };
    // A clockwise quarter turn on screen: (dx, dy) to (-dy, dx).
    const dx = centre(square).x - cx;
    const dy = centre(square).y - cy;
    expect(centre(quarter).x).toBeCloseTo(cx - dy);
    expect(centre(quarter).y).toBeCloseTo(cy + dx);
    expect(quarter.rotation).toBe(90);
    // Half round brings it back to no turn written as 180.
    expect((twins[1] as { rotation?: number }).rotation).toBe(180);
  });

  it('maps a stroke point by point, both ways for Both', () => {
    const twins = symmetryTwins(stroke, on({ axis: 'both' }));
    expect(twins).toHaveLength(3);
    const [first, last] = [freehandCanvasPoints(stroke)[0]!, freehandCanvasPoints(stroke)[1]!];
    const opposite = freehandCanvasPoints(twins[2] as FreehandElement);
    expect(opposite[0]!.x).toBeCloseTo(2 * cx - first.x);
    expect(opposite[0]!.y).toBeCloseTo(2 * cy - first.y);
    expect(opposite[1]!.x).toBeCloseTo(2 * cx - last.x);
  });

  it('bakes a stroke rotation into its points', () => {
    const turned = { ...stroke, rotation: 90 } as FreehandElement;
    const out = mapElement(turned, symmetryMaps(r, { ...DEFAULT_MIRROR, axis: 'vertical' })[0]!);
    expect((out as { rotation?: number }).rotation).toBeUndefined();
  });

  it('adds no twin that would sit on the drawing itself, or off a mirrored page', () => {
    const onAxis = { ...square, x: cx - 20 } as BoxedElement;
    expect(symmetryTwins(onAxis, on({ axis: 'vertical' }))).toHaveLength(0);
    expect(symmetryTwins(onAxis, on({ axis: 'horizontal' }))).toHaveLength(1);
    expect(symmetryTwins({ ...square, x: r.x - 500 } as BoxedElement, on({}))).toHaveLength(0);
  });
});
