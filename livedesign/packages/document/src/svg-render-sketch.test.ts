import { describe, expect, it } from 'vitest';
import { createShape, createTable, renderElementsToSvg, type Element, type Tab } from './index';
import { SKETCH_FACE_FILTER, svgSketchArtDefs, svgSketchFace } from './svg-render-sketch';

// docs/specs/008-canvas/finish.md "Every other face is drawn by hand too": a face's ink goes through the wobble, its
// words stay crisp above it.
const FILTERED = `<g filter="url(#${SKETCH_FACE_FILTER.id})">`;

function inkLayer(svg: string): string {
  const start = svg.indexOf(FILTERED);
  return start < 0 ? '' : svg.slice(start, svg.indexOf('</g>', start));
}

function tabOf(elements: Element[], finish?: 'sketch' | 'flexible'): Tab {
  return { id: 't', name: 't', elements, ...(finish ? { finish } : {}) };
}

describe('svgSketchFace', () => {
  const face =
    '<rect x="0" y="0" width="10" height="10" fill="#0ea5e9"/>' +
    '<text x="5" y="5">4,000</text>' +
    '<image href="a.png" x="0" y="0" width="4" height="4"/>';

  it('draws the ink through the wobble with the words and photos taken out', () => {
    const ink = inkLayer(svgSketchFace(face));
    expect(ink).toContain('<rect x="0"');
    expect(ink).not.toContain('<text');
    expect(ink).not.toContain('<image');
  });

  it('draws the words above the ink, crisp, with every ink tag hidden', () => {
    const out = svgSketchFace(face);
    const words = out.slice(out.indexOf('</g>') + 4);
    expect(words).toContain('<text x="5" y="5">4,000</text>');
    expect(words).toContain('<image href="a.png"');
    expect(words).toContain('<rect visibility="hidden" x="0"');
  });

  it('adds no words layer to a face with no words', () => {
    const out = svgSketchFace('<circle cx="1" cy="1" r="1"/>');
    expect(out).toBe(`${FILTERED}<circle cx="1" cy="1" r="1"/></g>`);
  });

  it('keeps clip paths whole, so the words layer is still clipped', () => {
    const out = svgSketchFace(
      '<clipPath id="c"><rect width="4" height="4"/></clipPath><text>a</text>',
    );
    expect(out).toContain('<clipPath id="c"><rect width="4" height="4"/></clipPath><text>a</text>');
  });

  it('draws a sketched body once, unwobbled, where it was', () => {
    const body = '<g transform="translate(0 0)" data-finish="sketch"><path d="M0 0"/></g>';
    const first = svgSketchFace(`${body}<rect/>`);
    expect(first.startsWith(body)).toBe(true);
    expect(first.match(/data-finish="sketch"/g)).toHaveLength(1);
    const last = svgSketchFace(`<rect/>${body}`);
    expect(last.endsWith(body)).toBe(true);
  });
});

describe('renderElementsToSvg under Sketch', () => {
  const chart = { ...createShape('bar-chart', 0, 0), id: 'c' } as Element;

  it("draws a chart's bars by hand and its words crisp, and defines the wobble", () => {
    const svg = renderElementsToSvg(tabOf([chart], 'sketch'));
    expect(svg).toContain(`<filter id="${SKETCH_FACE_FILTER.id}"`);
    const ink = inkLayer(svg);
    expect(ink).toContain('<rect');
    expect(ink).not.toContain('<text');
    expect(svg.slice(svg.indexOf(ink) + ink.length)).toContain('<text');
  });

  it('leaves a chart as drawn on a Flexible tab', () => {
    const svg = renderElementsToSvg(tabOf([chart]));
    expect(svg).not.toContain(SKETCH_FACE_FILTER.id);
    expect(svg).not.toContain('visibility="hidden"');
  });

  it('leaves a chart with its own Flexible finish as drawn on a Sketch tab', () => {
    const own = { ...chart, finish: 'flexible' } as Element;
    expect(renderElementsToSvg(tabOf([own], 'sketch'))).not.toContain(FILTERED);
  });

  it('leaves a plain box to its sketched body', () => {
    const square = { ...createShape('square', 0, 0), id: 's', label: 'Hi' } as Element;
    const svg = renderElementsToSvg(tabOf([square], 'sketch'));
    expect(svg).not.toContain(FILTERED);
    expect(svg).toContain('data-finish="sketch"');
  });

  it("draws a table's grid by hand and keeps its sketched frame over it", () => {
    const table = { ...createTable(0, 0), id: 'tb' } as Element;
    const svg = renderElementsToSvg(tabOf([table], 'sketch'));
    expect(inkLayer(svg)).toContain('<rect');
    expect(svg.indexOf(FILTERED)).toBeLessThan(svg.indexOf('data-finish="sketch"'));
  });

  it("draws only a tab window's frame by hand", () => {
    const tw = { ...createShape('tab-window', 0, 0), id: 'tw' } as Element;
    const svg = renderElementsToSvg(tabOf([tw], 'sketch'));
    const ink = inkLayer(svg);
    expect(ink).toMatch(/^<g filter="url\(#lvd-sketch-face\)"><rect [^>]*fill="none"/);
    expect(svg).not.toContain('visibility="hidden"');
  });
});

describe('svgSketchArtDefs', () => {
  const sketch = (el: object) => [{ ...el, finish: 'sketch' }] as unknown as Element[];

  it("defines only the filters a tab's elements draw through", () => {
    expect(svgSketchArtDefs(sketch({ type: 'shape', shape: 'icon' }), undefined)).toContain(
      'lvd-sketch-art',
    );
    const faces = svgSketchArtDefs(sketch({ type: 'shape', shape: 'bar-chart' }), undefined);
    expect(faces).toContain('lvd-sketch-face');
    expect(faces).not.toContain('lvd-sketch-art');
    expect(svgSketchArtDefs(sketch({ type: 'shape', shape: 'square' }), undefined)).toBe('');
    expect(svgSketchArtDefs([{ type: 'shape', shape: 'bar-chart' }] as Element[], 'flexible')).toBe(
      '',
    );
  });

  it("draws a face's ink in one pass of one octave, the budget's filter", () => {
    const faces = svgSketchArtDefs(sketch({ type: 'shape', shape: 'pyramid' }), undefined);
    expect(faces.match(/<feDisplacementMap/g)).toHaveLength(1);
    expect(faces).toContain('numOctaves="1"');
  });
});

describe('a face\'s words under Sketch (docs/specs/008-canvas/finish.md "Lettering")', () => {
  const words = (kind: string) =>
    renderElementsToSvg(tabOf([{ ...createShape(kind as never, 0, 0), id: 'x' }], 'sketch'));

  it('writes a checklist, a legend and an empty tab window by hand', () => {
    for (const kind of ['checklist', 'legend', 'tab-window']) {
      const svg = words(kind);
      expect(svg, kind).not.toContain('font-family="system-ui');
      expect(svg, kind).toMatch(/<text[^>]*font-family="[^"]*Caveat/);
    }
  });

  it('gives words that name no face the element’s, through its group', () => {
    for (const kind of ['idea-box', 'quiz', 'mode-button', 'picker', 'reaction-pad']) {
      expect(words(kind), kind).toMatch(/<g font-family="[^"]*Caveat/);
    }
  });

  it('leaves a Flexible tab with no font to the default face', () => {
    const svg = renderElementsToSvg(tabOf([{ ...createShape('idea-box', 0, 0), id: 'x' }]));
    expect(svg).not.toContain('Caveat');
  });
});
