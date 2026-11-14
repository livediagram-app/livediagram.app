// @vitest-environment jsdom
// The PNG export's boxed element painter (docs/specs/020-import-export): a rich-text label keeps the element's opacity.

import { describe, expect, it } from 'vitest';
import { createShape, type BoxedElement } from '@liveplanner/project';
import { drawBoxed } from './export-tab-canvas-draw';

function recordingContext() {
  const alphas: number[] = [];
  const ctx = new Proxy<Record<string, unknown>>(
    { globalAlpha: 1 },
    {
      get(target, key) {
        if (key === 'fillText') return () => alphas.push(target.globalAlpha as number);
        if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
        if (key in target) return target[key as string];
        return () => undefined;
      },
      set(target, key, value) {
        target[key as string] = value;
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, alphas };
}

describe('drawBoxed', () => {
  it('draws a rich-text label at the element’s opacity, times its layer’s', () => {
    const el = {
      ...createShape('square', 0, 0),
      label: 'Hi there',
      richText: [{ text: 'Hi', bold: true }, { text: ' there' }],
      opacity: 0.4,
    } as unknown as BoxedElement;
    const { ctx, alphas } = recordingContext();
    drawBoxed(ctx, el, undefined, 0.5);
    expect(alphas.length).toBeGreaterThan(0);
    for (const a of alphas) expect(a).toBeCloseTo(0.2, 6);
  });

  // docs/specs/020-import-export/export-fidelity.md "Borders are the element's own": the PNG drew every plain shape
  // with a 1.5px solid line at a 6px radius, whatever its border said.
  it('strokes a shape with its own border width, dash and corner radius, inset like the SVG', () => {
    const record = (el: BoxedElement) => {
      const seen = { lineWidth: 0, dash: [] as number[], radius: -1, moveTo: [] as number[] };
      const ctx = new Proxy<Record<string, unknown>>(
        {},
        {
          get(target, key) {
            if (key === 'stroke') return () => (seen.lineWidth = target.lineWidth as number);
            if (key === 'setLineDash')
              return (d: number[]) => {
                if (d.length) seen.dash = d;
              };
            if (key === 'arcTo')
              return (...a: number[]) => {
                if (seen.radius < 0) seen.radius = a[4]!;
              };
            if (key === 'moveTo')
              return (...a: number[]) => {
                if (!seen.moveTo.length) seen.moveTo = a;
              };
            if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
            if (key in target) return target[key as string];
            return () => undefined;
          },
          set(target, key, value) {
            target[key as string] = value;
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      drawBoxed(ctx, el, undefined, 1);
      return seen;
    };
    const square = {
      ...createShape('square', 0, 0),
      width: 200,
      height: 100,
      strokeWidth: 'thick',
      strokeStyle: 'dashed',
      borderRadius: 'lg',
    } as unknown as BoxedElement;
    const seen = record(square);
    // thick is 4px, inset by 2; lg is 24px, less the inset; dashed is 6 5.
    expect(seen.lineWidth).toBe(4);
    expect(seen.dash).toEqual([6, 5]);
    expect(seen.radius).toBe(22);
    expect(seen.moveTo[1]).toBe(2);
  });

  // docs/specs/009-elements/lane.md "A title wraps in its gutter" (Work Tracker 824): the PNG holds a lane title to
  // three whole-word lines in its gutter, as the SVG does.
  describe('a lane title across its gutter', () => {
    const texts = (el: BoxedElement) => {
      const drawn: string[] = [];
      const ctx = new Proxy<Record<string, unknown>>(
        {},
        {
          get(target, key) {
            if (key === 'fillText') return (s: string) => drawn.push(s);
            if (key === 'measureText') return (s: string) => ({ width: s.length * 7 });
            if (key in target) return target[key as string];
            return () => undefined;
          },
          set(target, key, value) {
            target[key as string] = value;
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      drawBoxed(ctx, el, undefined, 1);
      return drawn;
    };
    const long = 'Quarterly marketing programme review and sign off with every regional lead';
    const lane = (o: Record<string, unknown>) =>
      ({
        ...createShape('lane', 0, 0),
        width: 400,
        height: 200,
        textAlignX: 'left',
        label: long,
        ...o,
      }) as unknown as BoxedElement;

    it('wraps a plain title onto three whole-word lines, the last ending in an ellipsis', () => {
      const lines = texts(lane({}));
      expect(lines).toHaveLength(3);
      expect(lines[2]).toMatch(/…$/);
      for (const line of lines.slice(0, 2)) expect(long).toContain(line);
    });

    it('clamps a formatted title to three lines the same way', () => {
      const rich = lane({
        richText: [{ text: 'Quarterly', bold: true }, { text: long.slice('Quarterly'.length) }],
      });
      const drawn = texts(rich);
      expect(drawn[0]).toBe('Quarterly');
      expect(drawn.at(-1)).toMatch(/…$/);
    });
  });
});
