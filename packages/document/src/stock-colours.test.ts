import { describe, expect, it } from 'vitest';
import type {
  ArrowElement,
  FreehandElement,
  ShapeElement,
  StickyElement,
  TextElement,
} from './index';
import { defaultStrokeColor } from './colors';
import { PEN_INK, penColourHex } from './pen-colours';
import { renderElementsToSvg, svgArrow, svgBoxed } from './svg-render';
import { resolveStockColours } from './stock-colours';
import { encodeStrokePoints } from './stroke-points';

const shape = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...over,
});

const stroke = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  id: 'f',
  type: 'freehand',
  x: 0,
  y: 0,
  width: 40,
  height: 40,
  packedPoints: encodeStrokePoints([
    { nx: 0, ny: 0 },
    { nx: 1, ny: 1 },
  ]),
  closed: false,
  penWidth: 4,
  ...over,
});

const text = (over: Partial<TextElement> = {}): TextElement => ({
  id: 't',
  type: 'text',
  x: 0,
  y: 0,
  width: 80,
  height: 24,
  label: 'Hello',
  ...over,
});

const arrow = (over: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 100, y: 0 },
  ...over,
});

describe('resolveStockColours', () => {
  it("fills a pen stroke's area (a closed path with no outline) in its pen colour", () => {
    const area = {
      id: 'p',
      type: 'path',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      closed: true,
      nodes: [],
      strokeWidth: 'none',
      penColour: 'ink',
    } as const;
    expect(resolveStockColours(area as never, 'dark')).toMatchObject({
      fillColor: penColourHex('ink', 'dark'),
    });
    // An outlined or open path keeps its fill as it is.
    const outlined = resolveStockColours({ ...area, strokeWidth: 'thin' } as never, 'dark');
    expect((outlined as { fillColor?: string }).fillColor).toBeUndefined();
  });

  it('draws a named line colour in its version for the canvas surface', () => {
    const el = shape({ penColour: 'blue' });
    expect(resolveStockColours(el, 'light').strokeColor).toBe(penColourHex('blue', 'light'));
    expect(resolveStockColours(el, 'dark').strokeColor).toBe(penColourHex('blue', 'dark'));
  });

  it('draws a named text colour in its version for the canvas surface', () => {
    const el = text({ penTextColour: 'red' });
    expect(resolveStockColours(el, 'dark').textColor).toBe(penColourHex('red', 'dark'));
  });

  it('draws Ink by name in the ink for each surface', () => {
    const el = shape({ penColour: 'ink', penTextColour: 'ink' });
    expect(resolveStockColours(el, 'light')).toMatchObject({
      strokeColor: PEN_INK.light,
      textColor: PEN_INK.light,
    });
    expect(resolveStockColours(el, 'dark').strokeColor).toBe(PEN_INK.dark);
  });

  it('lets an explicit colour win over a name', () => {
    const el = shape({ penColour: 'blue', strokeColor: '#123456' });
    expect(resolveStockColours(el, 'light')).toBe(el);
  });

  it('resolves names on every element that carries them', () => {
    const sticky: StickyElement = {
      id: 'n',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      penTextColour: 'green',
    };
    expect(resolveStockColours(sticky, 'light').textColor).toBe(penColourHex('green', 'light'));
    expect(resolveStockColours(arrow({ penColour: 'teal' }), 'light').strokeColor).toBe(
      penColourHex('teal', 'light'),
    );
    expect(resolveStockColours(stroke({ penColour: 'pink' }), 'dark').strokeColor).toBe(
      penColourHex('pink', 'dark'),
    );
  });

  it('returns the element itself when it carries no name', () => {
    const el = shape({ strokeColor: '#000000' });
    expect(resolveStockColours(el, 'light')).toBe(el);
  });

  it('never invents a fill or a default colour', () => {
    expect(resolveStockColours(shape(), 'light')).toEqual(shape());
  });
});

describe('the headless renderer draws stock colours', () => {
  it('draws a named shape outline on a light page', () => {
    const svg = svgBoxed(shape({ penColour: 'violet' }), { surface: 'light' });
    expect(svg).toContain(penColourHex('violet', 'light'));
  });

  it('draws a named pen stroke on a dark page', () => {
    const svg = svgBoxed(stroke({ penColour: 'orange' }), { surface: 'dark' });
    expect(svg).toContain(penColourHex('orange', 'dark'));
  });

  it('draws a named arrow in the version for its page', () => {
    const svg = svgArrow(arrow({ penColour: 'blue' }), [], 'dark');
    expect(svg).toContain(penColourHex('blue', 'dark'));
  });

  it('draws every name in a whole-tab render, as thumbnails and MCP images do', () => {
    const svg = renderElementsToSvg({
      id: 'tab',
      name: 'Tab',
      elements: [shape({ penColour: 'red' }), text({ penTextColour: 'green' })],
    });
    expect(svg).toContain(penColourHex('red', 'light'));
    expect(svg).toContain(penColourHex('green', 'light'));
  });
});

describe('unpainted pen strokes and text', () => {
  it('draws an unpainted pen stroke in Ink on either surface', () => {
    expect(svgBoxed(stroke(), { surface: 'light' })).toContain(PEN_INK.light);
    expect(svgBoxed(stroke(), { surface: 'dark' })).toContain(PEN_INK.dark);
  });

  it('draws an unpainted freehand sketch in Ink, but leaves a highlighter its recipe', () => {
    expect(defaultStrokeColor(stroke({ penWidth: undefined }), 'light')).toBe(PEN_INK.light);
    expect(defaultStrokeColor(stroke({ pen: 'highlighter' }), 'light')).not.toBe(PEN_INK.light);
  });

  it('keeps a shape on its theme default', () => {
    expect(defaultStrokeColor(shape(), 'light')).not.toBe(PEN_INK.light);
  });

  it('draws unpainted text in Ink on either surface', () => {
    expect(svgBoxed(text(), { surface: 'light' })).toContain(PEN_INK.light);
    expect(svgBoxed(text(), { surface: 'dark' })).toContain(PEN_INK.dark);
  });
});

describe('the page a whole-tab render paints', () => {
  it('is the Default theme light canvas when the tab stores none', () => {
    const svg = renderElementsToSvg({ id: 'tab', name: 'Tab', elements: [shape()] });
    expect(svg).toContain('fill="#fbfaf7"');
  });
});
