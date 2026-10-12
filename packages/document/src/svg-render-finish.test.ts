import { describe, expect, it } from 'vitest';
import { svgArrow, renderElementsToSvg } from './svg-render';
import type { ArrowElement, Element, ShapeElement, StickyElement, Tab } from './index';

// Exports follow the finish (docs/specs/008-canvas/finish.md): the same sketched strokes, hatching and
// heads the canvas draws, Professional's sharper corners and thinner lines, and Sketch's lettering.

const square = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'sq',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 160,
  height: 100,
  label: 'Box',
  ...over,
});
const sticky: StickyElement = {
  id: 'st',
  type: 'sticky',
  x: 300,
  y: 0,
  width: 160,
  height: 160,
  text: 'Note',
} as StickyElement;
const arrow = (over: Partial<ArrowElement> = {}): ArrowElement =>
  ({
    id: 'ar',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 200 },
    to: { kind: 'free', x: 200, y: 260 },
    ...over,
  }) as ArrowElement;
const tab = (elements: Element[], finish?: Tab['finish']): Tab =>
  ({ id: 't', name: 'T', elements, ...(finish ? { finish } : {}) }) as Tab;

describe('renderElementsToSvg in a finish', () => {
  it('Flexible draws no sketch, as before', () => {
    const svg = renderElementsToSvg(tab([square(), sticky, arrow()]));
    expect(svg).not.toContain('data-finish="sketch"');
    expect(svg).toBe(renderElementsToSvg(tab([square(), sticky, arrow()], 'flexible')));
  });

  it('a Sketch tab sketches every box and letters in the handwriting font', () => {
    const svg = renderElementsToSvg(tab([square(), sticky], 'sketch'));
    expect(svg.match(/data-finish="sketch"/g)?.length).toBe(2);
    expect(svg).toMatch(/Caveat/);
  });

  it("an element's own finish beats its tab's", () => {
    const own = renderElementsToSvg(tab([square({ finish: 'flexible' }), sticky], 'sketch'));
    expect(own.match(/data-finish="sketch"/g)?.length).toBe(1);
    const sketched = renderElementsToSvg(tab([square({ finish: 'sketch' })]));
    expect(sketched).toContain('data-finish="sketch"');
  });

  it('Sketch hatches a plain filled shape, and is the same drawing every time', () => {
    const a = renderElementsToSvg(tab([square()], 'sketch'));
    expect(a).toBe(renderElementsToSvg(tab([square()], 'sketch')));
    // Hatching is a path in the fill colour drawn as a stroke.
    expect(a).toMatch(/<path d="M[^"]+" stroke="[^"]+" stroke-width="[\d.]+" fill="none"/);
  });

  it('Professional sharpens the default corner and thins the border', () => {
    const flex = renderElementsToSvg(tab([square()]));
    const pro = renderElementsToSvg(tab([square()], 'professional'));
    expect(pro).not.toBe(flex);
    // The 2 px corner and the thin border, the corner inset by half the border as the canvas's CSS one is.
    expect(pro).toMatch(/rx="1.5"[^>]*stroke-width="1"/);
    expect(flex).toMatch(/rx="7"[^>]*stroke-width="2"/);
  });
});

describe('svgArrow in a finish', () => {
  const draw = (a: ArrowElement, finish?: Tab['finish']) =>
    svgArrow(a, [a], 'light', undefined, undefined, undefined, undefined, undefined, finish);

  it('Professional thins an arrow without its own width, never one with', () => {
    expect(draw(arrow(), 'professional')).not.toContain('stroke-width="2"');
    expect(draw(arrow({ strokeWidth: 4 }), 'professional')).toContain('stroke-width="4"');
  });

  it('Sketch draws the line by hand and the triangle head as strokes, not a marker shape', () => {
    const flex = draw(arrow());
    const sketch = draw(arrow(), 'sketch');
    expect(sketch).not.toBe(flex);
    // Two paths: the line and the loose head; no filled head polygon.
    expect(sketch.match(/<path /g)?.length).toBe(2);
    expect(sketch).not.toMatch(/<polygon/);
  });

  it('Sketch keeps a meaningful head (a diamond) as drawn', () => {
    const sketch = draw(arrow({ arrowheadShape: 'diamond' } as Partial<ArrowElement>), 'sketch');
    expect(sketch.match(/<path /g)?.length).toBe(1);
  });
});
