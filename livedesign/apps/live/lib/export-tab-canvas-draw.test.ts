// @vitest-environment jsdom
// The PNG export's boxed element painter (docs/specs/020-import-export): a rich-text label keeps the element's opacity.

import { describe, expect, it } from 'vitest';
import { createShape, type BoxedElement } from '@livedesign/design';
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

  it('breaks a word wider than the box, as the SVG export does', () => {
    const texts: string[] = [];
    const ctx = new Proxy<Record<string, unknown>>(
      {},
      {
        get(target, key) {
          if (key === 'fillText') return (s: string) => texts.push(s);
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
    const el = {
      ...createShape('square', 0, 0),
      width: 80,
      label: 'Supercalifragilisticexpialidocious',
    } as unknown as BoxedElement;
    drawBoxed(ctx, el, undefined, 1);
    expect(texts.length).toBeGreaterThan(1);
    expect(texts.join('')).toBe('Supercalifragilisticexpialidocious');
  });
});
