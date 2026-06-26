import { describe, expect, it } from 'vitest';
import type { ArrowElement, ShapeElement, Tab } from './index';
import { renderElementsToSvg } from './svg-render';

const shape = (id: string, o: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...o,
});

const pinnedArrow = (
  id: string,
  fromId: string,
  toId: string,
  o: Partial<ArrowElement> = {},
): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: fromId, anchor: 'e' },
  to: { kind: 'pinned', elementId: toId, anchor: 'w' },
  ...o,
});

const tab = (elements: Tab['elements'], o: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements,
  ...o,
});

describe('renderElementsToSvg', () => {
  it('renders a self-contained SVG with shapes, an arrow and a background', () => {
    const svg = renderElementsToSvg(
      tab([shape('a'), shape('b', { x: 200 }), pinnedArrow('arr', 'a', 'b')]),
    );
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('<rect'); // shape bodies + background
    expect(svg).toContain('<path'); // the arrow
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('wraps a long label headlessly (no DOM canvas needed)', () => {
    const svg = renderElementsToSvg(
      tab([shape('a', { label: 'one two three four five six seven eight nine', width: 80 })]),
    );
    // The char-width fallback measure kicks in without a document, so a long
    // label still wraps to multiple <tspan> lines rather than one overflowing run.
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it('sizes the viewBox to the content bounds plus padding', () => {
    const svg = renderElementsToSvg(tab([shape('a', { x: 10, y: 20, width: 100, height: 80 })]), {
      padding: 32,
    });
    // bounds (10,20,100,80) inflated by 32 each side -> -22 -12 164 144.
    expect(svg).toContain('viewBox="-22 -12 164 144"');
  });

  it('honours an explicit background colour', () => {
    const svg = renderElementsToSvg(tab([shape('a')], { backgroundColor: '#abcdef' }));
    expect(svg).toContain('#abcdef');
  });

  it('defaults an empty tab to a standard page rather than a 0x0 frame', () => {
    const svg = renderElementsToSvg(tab([]));
    expect(svg).toContain('viewBox="-32 -32 664 464"');
  });
});
