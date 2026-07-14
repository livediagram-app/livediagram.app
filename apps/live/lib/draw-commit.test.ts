import type { ArrowElement, Element, Tab, ThemeDefinition } from '@livediagram/diagram';
import { COMPONENT_SIZE, isBoxed } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  buildDrawnArrow,
  buildDrawnBoxed,
  buildDrawnComponent,
  NEW_ARROW_THEME_STROKE_FALLBACK,
} from './draw-commit';

// Only the fields the builders read; the full ThemeDefinition carries a
// dozen backdrop fields irrelevant here.
const themed = {
  elementStroke: '#123456',
  elementFill: '#fafafa',
  elementText: '#111111',
} as unknown as ThemeDefinition;
const bareTheme = {} as unknown as ThemeDefinition;

const tab = (overrides: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements: [], ...overrides }) as unknown as Tab;

const unionBox = (els: Element[]) => {
  const boxed = els.filter(isBoxed);
  const minX = Math.min(...boxed.map((b) => b.x));
  const minY = Math.min(...boxed.map((b) => b.y));
  const maxX = Math.max(...boxed.map((b) => b.x + b.width));
  const maxY = Math.max(...boxed.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

describe('buildDrawnArrow', () => {
  it('lays a flat 160px placeholder across a stray click, unsnapped', () => {
    const out = buildDrawnArrow(500, 300, 505, 310, [], themed); // <16px travel = click
    expect(out.from).toEqual({ kind: 'free', x: 420, y: 300 });
    expect(out.to).toEqual({ kind: 'free', x: 580, y: 300 });
    expect(out.arrowEnds).toBe('none');
    expect(out.strokeColor).toBe('#123456');
  });

  it('falls back to the brand stroke when the theme has no elementStroke', () => {
    const out = buildDrawnArrow(0, 0, 5, 5, [], bareTheme);
    expect(out.strokeColor).toBe(NEW_ARROW_THEME_STROKE_FALLBACK);
  });

  it('uses the dragged endpoints as-is on a real drag', () => {
    const out = buildDrawnArrow(10, 20, 150, 90, [], themed);
    expect(out.from).toEqual({ kind: 'free', x: 10, y: 20 });
    expect(out.to).toEqual({ kind: 'free', x: 150, y: 90 });
  });

  it('snaps a dragged endpoint onto a nearby arrow (spec/50), leaving the far one free', () => {
    const existing: ArrowElement = {
      id: 'ex',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 100 },
      to: { kind: 'free', x: 200, y: 100 },
    };
    const out = buildDrawnArrow(50, 0, 100, 100, [existing], themed);
    expect(out.from).toEqual({ kind: 'free', x: 50, y: 0 });
    expect(out.to.kind).toBe('on-arrow');
    if (out.to.kind === 'on-arrow') {
      expect(out.to.arrowId).toBe('ex');
      expect(out.to.t).toBeCloseTo(0.5, 1);
    }
  });
});

describe('buildDrawnComponent', () => {
  it('drops the natural size centred on a tap', () => {
    const out = buildDrawnComponent('callout', 500, 300, 503, 302, themed);
    const box = unionBox(out);
    // Natural footprint (the union can differ a little from the nominal
    // COMPONENT_SIZE, so bound it rather than pin it exactly).
    expect(box.width).toBeGreaterThan(COMPONENT_SIZE.callout.width * 0.5);
    expect(box.width).toBeLessThan(COMPONENT_SIZE.callout.width * 1.5);
    expect(box.x + box.width / 2).toBeCloseTo(500, 0);
    expect(box.y + box.height / 2).toBeCloseTo(300, 0);
  });

  it('scales the group uniformly to fill a dragged box', () => {
    const natural = unionBox(buildDrawnComponent('callout', 0, 0, 3, 3, themed));
    const def = COMPONENT_SIZE.callout;
    const dragged = unionBox(
      buildDrawnComponent('callout', 0, 0, def.width * 2, def.height, themed),
    );
    expect(dragged.width).toBeCloseTo(natural.width * 2, 5);
    expect(dragged.height).toBeCloseTo(natural.height * 2, 5); // uniform, not per-axis
  });

  it('caps the drag scale at 8x', () => {
    const natural = unionBox(buildDrawnComponent('callout', 0, 0, 3, 3, themed));
    const huge = unionBox(buildDrawnComponent('callout', 0, 0, 100_000, 100_000, themed));
    expect(huge.width).toBeCloseTo(natural.width * 8, 5);
  });
});

describe('buildDrawnBoxed', () => {
  const shapeIntent = { type: 'shape', kind: 'square' } as const;

  it('centres the factory-default size on a tap', () => {
    const out = buildDrawnBoxed(shapeIntent, 500, 300, 504, 303, null, tab());
    expect(out.width).toBe(120); // square factory default
    expect(out.height).toBe(120);
    expect(out.x).toBe(500 - 60);
    expect(out.y).toBe(300 - 60);
  });

  it('sizes to the dragged box, normalising a backwards drag', () => {
    const out = buildDrawnBoxed(shapeIntent, 200, 100, 10, 20, null, tab());
    expect({ x: out.x, y: out.y, width: out.width, height: out.height }).toEqual({
      x: 10,
      y: 20,
      width: 190,
      height: 80,
    });
  });

  it("seeds the tab's default text size (spec/28)", () => {
    const seeded = buildDrawnBoxed(shapeIntent, 0, 0, 3, 3, null, tab({ defaultTextSize: 'lg' }));
    expect(seeded.textSize).toBe('lg');
    const unseeded = buildDrawnBoxed(shapeIntent, 0, 0, 3, 3, null, tab());
    expect(unseeded.textSize).toBe('md'); // the shape factory's own default
  });

  it('carries the icon glyph + label, unlocking aspect for a tech mark (spec/41)', () => {
    const intent = { type: 'shape', kind: 'square', iconId: 'aws-s3', label: 'S3' } as const;
    const out = buildDrawnBoxed(intent, 0, 0, 100, 100, null, tab());
    expect(out).toMatchObject({ iconId: 'aws-s3', label: 'S3', aspectLocked: false });
  });
});
