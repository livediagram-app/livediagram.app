import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import type { RetiredArrowElement, Element, ShapeElement, StickyElement, Tab } from './index';

// Exports follow the finish (docs/specs/008-canvas/finish.md): the same sketched strokes and hatching the canvas
// draws, Professional's sharper corners and thinner lines, and Sketch's lettering.

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
const arrow = (over: Partial<RetiredArrowElement> = {}): RetiredArrowElement => ({
  id: 'ar',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 200 },
  to: { kind: 'free', x: 200, y: 260 },
  ...over,
});
const tab = (elements: Element[], finish?: Tab['finish']): Tab => ({
  id: 't',
  name: 'T',
  elements,
  ...(finish ? { finish } : {}),
});

describe('renderElementsToSvg in a finish', () => {
  it('Flexible draws no sketch, as before', () => {
    const svg = renderElementsToSvg(tab([square(), sticky, arrow()]));
    expect(svg).not.toContain('data-finish="sketch"');
    expect(svg).toBe(renderElementsToSvg(tab([square(), sticky, arrow()], 'flexible')));
  });

  it('a Sketch tab sketches every box and letters in the handwriting font', () => {
    const svg = renderElementsToSvg(tab([square(), sticky], 'sketch'));
    expect(svg.match(/data-finish="sketch"/g)?.length).toBe(2);
    expect(svg).toMatch(/Kalam/);
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

  it('Sketch keeps the solid fill under faint shading, so text keeps its contrast', () => {
    // A pastel node with dark text on a dark canvas: the fill must stay, or the text sits on the canvas.
    const node = square({ fillColor: '#dbeafe', strokeColor: '#3b82f6', textColor: '#1e3a8a' });
    const svg = renderElementsToSvg({
      ...tab([node], 'sketch'),
      backgroundColor: '#0d121a',
    });
    const body = svg.slice(svg.indexOf('data-finish="sketch"'));
    expect(body).toMatch(/<path d="M[^"]+" fill="#dbeafe"\/>/);
    expect(body).toMatch(/stroke="#3b82f6" stroke-opacity="0.15"/);
  });

  it('Professional letters in Inter', () => {
    expect(renderElementsToSvg(tab([square()], 'professional'))).toMatch(/Inter/);
  });

  it('Professional squares the default corner and thins the border', () => {
    const flex = renderElementsToSvg(tab([square()]));
    const pro = renderElementsToSvg(tab([square()], 'professional'));
    expect(pro).not.toBe(flex);
    // Square corners and the thin border.
    expect(pro).toMatch(/rx="0"[^>]*stroke-width="1"/);
    expect(flex).toMatch(/rx="7"[^>]*stroke-width="2"/);
  });
});
