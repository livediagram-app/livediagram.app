import { describe, expect, it } from 'vitest';
import type { BoxedElement } from './index';
import {
  INDICATOR_MIDDLE_CLEARANCE_PX,
  INDICATOR_OUTLINE_CLEARANCE_PX,
  topAnchor,
  footerAnchor,
  indicatorRings,
  contentBox,
  contentShift,
  pipInset,
  placeIndicators,
} from './indicator-placement';

const CLUSTER = { width: 60, height: 20 };

function shape(kind: string, width: number, height: number, extra: object = {}): BoxedElement {
  return {
    id: 'a',
    type: 'shape',
    shape: kind,
    x: 0,
    y: 0,
    width,
    height,
    ...extra,
  } as BoxedElement;
}

function place(el: BoxedElement, cornerPx: number, anchor: Parameters<typeof placeIndicators>[4]) {
  return placeIndicators(indicatorRings(el, cornerPx), el.width, el.height, CLUSTER, anchor);
}

describe('placeIndicators', () => {
  it('sits tight in the top-right of a rounded box, clear of its corner', () => {
    const box = place(shape('mind-node', 250, 116), 14, 'top-right');
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(INDICATOR_OUTLINE_CLEARANCE_PX);
    expect(box!.y).toBeLessThanOrEqual(12);
    expect(250 - (box!.x + box!.width)).toBe(box!.y);
  });

  it('slides along the diagonal of a circle and stays inside it', () => {
    const el = shape('circle', 160, 160);
    const box = place(el, 0, 'top-right')!;
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThan(20);
    const r = 80;
    for (const [px, py] of [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x + box.width, box.y + box.height],
    ] as const) {
      expect(Math.hypot(px - r, py - r)).toBeLessThan(r - INDICATOR_OUTLINE_CLEARANCE_PX + 2);
    }
  });

  it('never reaches the middle band', () => {
    const el = shape('circle', 160, 160);
    const box = place(el, 0, 'top-right')!;
    expect(box.y + box.height).toBeLessThanOrEqual(80 - INDICATOR_MIDDLE_CLEARANCE_PX);
  });

  it('reports no fit on a small diamond, a short pill and a thin bar', () => {
    expect(place(shape('diamond', 120, 120), 0, 'top-right')).toBeNull();
    expect(place(shape('stadium', 140, 40), 0, 'top-right')).toBeNull();
    expect(place(shape('square', 200, 16), 0, 'top-right')).toBeNull();
  });

  it('fits a wide diamond whose corner has room', () => {
    expect(place(shape('diamond', 420, 260), 0, 'top-right')).not.toBeNull();
  });

  it('starts a box footer at the bottom-left and a circle footer at the bottom centre', () => {
    const rect = shape('mind-node', 250, 116);
    const left = place(rect, 14, footerAnchor(rect))!;
    expect(left.x).toBe(116 - (left.y + left.height));
    const circle = shape('circle', 180, 180);
    expect(footerAnchor(circle)).toBe('bottom-centre');
    const centre = place(circle, 0, 'bottom-centre')!;
    expect(centre.x + centre.width / 2).toBe(90);
    expect(centre.y).toBeGreaterThanOrEqual(90 + INDICATOR_MIDDLE_CLEARANCE_PX);
  });

  it('has nothing to place against on an empty element', () => {
    expect(place(shape('square', 0, 0), 0, 'top-right')).toBeNull();
  });

  it('puts the pip on a hexagon’s edge, not in the empty box corner', () => {
    const el = shape('hexagon', 220, 140);
    const inset = pipInset(indicatorRings(el, 0), 220, 140, false)!;
    expect(inset.x).toBeGreaterThan(20);
    expect(inset.x).toBe(inset.y);
  });

  it('puts the pip on a rounded box’s corner curve', () => {
    const inset = pipInset(indicatorRings(shape('mind-node', 250, 116), 14), 250, 116, false)!;
    expect(inset.x).toBeGreaterThan(2);
    expect(inset.x).toBeLessThan(6);
  });

  it('fits a short node whose fixed-size label leaves the corner free', () => {
    const el = shape('mind-node', 220, 76);
    const rings = indicatorRings(el, 12);
    const one = { width: 24, height: 24 };
    expect(placeIndicators(rings, 220, 76, one, 'top-right')).toBeNull();
    const text = contentBox({
      width: 220,
      height: 76,
      label: 'HTML',
      textSize: 'md',
      padding: 14,
      alignX: 'center',
      alignY: 'middle',
    });
    expect(placeIndicators(rings, 220, 76, one, 'top-right', text)).not.toBeNull();
  });

  it('keeps clear of a fixed-size label that reaches the corner', () => {
    const el = shape('mind-node', 220, 76);
    const text = contentBox({
      width: 220,
      height: 76,
      label: 'A much longer heading that wraps',
      textSize: 'md',
      padding: 14,
      alignX: 'center',
      alignY: 'middle',
    });
    const box = placeIndicators(indicatorRings(el, 12), 220, 76, CLUSTER, 'top-right', text);
    expect(box).toBeNull();
  });

  it('estimates no text box for a scale-to-fit or empty label', () => {
    const base = {
      width: 200,
      height: 100,
      padding: 14,
      alignX: 'center',
      alignY: 'middle',
    } as const;
    expect(contentBox({ ...base, label: 'Hi', textSize: 'scale' })).toBeNull();
    expect(contentBox({ ...base, label: '  ', textSize: 'md' })).toBeNull();
    const top = contentBox({ ...base, label: 'Hi', textSize: 'md', alignY: 'top' })!;
    expect(top.y).toBe(14);
  });

  it('centres Top along the top of round and pointed shapes, not boxes', () => {
    for (const kind of ['circle', 'diamond', 'hexagon', 'cloud', 'triangle'] as const) {
      expect(topAnchor(shape(kind, 200, 200))).toBe('top-centre');
      expect(footerAnchor(shape(kind, 200, 200))).toBe('bottom-centre');
    }
    for (const kind of ['square', 'mind-node', 'stadium', 'browser'] as const) {
      expect(topAnchor(shape(kind, 200, 200))).toBe('top-right');
      expect(footerAnchor(shape(kind, 200, 200))).toBe('bottom-left');
    }
  });

  it('sits a centred cluster inside the top of a circle and a hexagon', () => {
    const circle = place(shape('circle', 200, 200), 0, 'top-centre')!;
    expect(circle.x + circle.width / 2).toBe(100);
    expect(circle.y).toBeGreaterThan(INDICATOR_OUTLINE_CLEARANCE_PX);
    const hex = place(shape('hexagon', 250, 150), 0, 'top-centre')!;
    expect(hex.x + hex.width / 2).toBe(125);
  });

  it('puts a centred pip on a diamond’s apex', () => {
    const el = shape('diamond', 160, 120);
    const inset = pipInset(indicatorRings(el, 0), 160, 120, true)!;
    expect(inset.x).toBe(80);
    expect(inset.y).toBeLessThan(6);
  });

  it('counts an inline icon above the label in the content box', () => {
    const base = {
      width: 290,
      height: 190,
      label: 'Cloud',
      textSize: 'md',
      padding: 14,
      alignX: 'center',
      alignY: 'middle',
    } as const;
    const text = contentBox(base)!;
    const withIcon = contentBox({
      ...base,
      fontPx: 22,
      icon: { size: 35, position: 'above', gap: 7 },
    })!;
    expect(withIcon.height).toBeCloseTo(text.height + 42, 5);
    expect(withIcon.y).toBeLessThan(text.y);
    expect(
      contentBox({ ...base, label: '', icon: { size: 30, position: 'left', gap: 8 } })!.width,
    ).toBe(30);
  });

  it('shifts middle content twice the overlap, refuses to push against the alignment', () => {
    const cluster = { x: 100, y: 10, width: 80, height: 24 };
    const content = { x: 90, y: 30, width: 100, height: 40 };
    expect(contentShift(cluster, content, 190, 14, 'middle', false)).toEqual({
      top: 20,
      bottom: 0,
    });
    expect(contentShift(cluster, content, 190, 14, 'top', false)).toEqual({ top: 10, bottom: 0 });
    expect(contentShift(cluster, content, 190, 14, 'bottom', false)).toBeNull();
    expect(contentShift(cluster, content, 60, 14, 'middle', false)).toBeNull();
    expect(contentShift(cluster, { ...content, y: 60 }, 190, 14, 'middle', false)).toEqual({
      top: 0,
      bottom: 0,
    });
  });
});
