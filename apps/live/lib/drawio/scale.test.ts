// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element } from '@livediagram/document';
import { readGraph } from './cells';
import { DRAWIO_MAX_PAGE_SCALE, pageScale, scalePage } from './scale';
import { model, vertex } from './test-support';

const graphOf = (xml: string) => readGraph(model(xml));
const box = (id: string, style: string, width = 120, value = 'Label') =>
  vertex(id, style, `width="${width}" height="60"`, `parent="1" value="${value}"`);

describe('pageScale', () => {
  it('is 1 for a page without labels', () => {
    expect(pageScale(graphOf(vertex('a', '', 'width="120" height="60"', 'parent="1"')))).toBe(1);
  });

  it("gives draw.io's 12 px labels in 120 px boxes livediagram's room", () => {
    // 14 px labels: the padded ratio wins, (1.4114 · 116 + 12) / 120 ≈ 1.4644... over the line ratio.
    const rw = (14 * 0.4785) / (12 * 0.4746);
    const rh = (14 * 1.25) / (12 * 1.2);
    const rp = (rw * (120 - 4) + 12) / 120;
    expect(pageScale(graphOf(box('a', '') + box('b', '')))).toBeCloseTo(Math.max(rw, rh, rp), 4);
  });

  it('reads the commonest label size and the median labelled box width', () => {
    const g = graphOf(
      box('a', 'fontSize=16;', 200) + box('b', 'fontSize=16;', 200) + box('c', 'fontSize=12;', 60),
    );
    // 16 px maps to the 14 px preset (nearest of 14, 22, 32): smaller than draw.io, so no growth.
    expect(pageScale(g)).toBe(1);
  });

  it('never goes past the largest scale', () => {
    const g = graphOf(box('a', 'fontSize=6;', 30) + box('b', 'fontSize=6;', 30));
    expect(pageScale(g)).toBe(DRAWIO_MAX_PAGE_SCALE);
  });
});

describe('scalePage', () => {
  it('scales positions, sizes, waypoints and free ends about the origin, and leaves strokes', () => {
    const els: Element[] = [
      {
        id: 's',
        type: 'shape',
        shape: 'lane',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        headerSize: 30,
        strokeWidth: 'thin',
      } as Element,
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 's', anchor: 'e' },
        to: { kind: 'free', x: 300, y: 40 },
        curvePoints: [{ dx: 10, dy: -4 }],
        strokeWidth: 3,
        labelOffset: { t: 0.3, offset: 8 },
      } as ArrowElement,
    ];
    const [lane, arrow] = scalePage(els, 2) as [Record<string, unknown>, ArrowElement];
    expect(lane).toMatchObject({
      x: 20,
      y: 40,
      width: 200,
      height: 100,
      headerSize: 60,
      strokeWidth: 'thin',
    });
    expect(arrow.to).toEqual({ kind: 'free', x: 600, y: 80 });
    expect(arrow.curvePoints).toEqual([{ dx: 20, dy: -8 }]);
    expect(arrow.labelOffset).toEqual({ t: 0.3, offset: 16 });
    expect(arrow.strokeWidth).toBe(3);
  });

  it('returns the elements untouched at scale 1', () => {
    const els: Element[] = [{ id: 't', type: 'text', x: 1, y: 2, width: 3, height: 4 } as Element];
    expect(scalePage(els, 1)).toBe(els);
  });
});
