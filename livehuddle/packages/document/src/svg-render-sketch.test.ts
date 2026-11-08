import { describe, expect, it } from 'vitest';
import { createShape, renderElementsToSvg, type Element, type Tab } from './index';
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
  const card = { ...createShape('mode-button', 0, 0), id: 'c' } as Element;

  it("draws a button's face by hand and its words crisp, and defines the wobble", () => {
    const svg = renderElementsToSvg(tabOf([card], 'sketch'));
    expect(svg).toContain(`<filter id="${SKETCH_FACE_FILTER.id}"`);
    const ink = inkLayer(svg);
    expect(ink).toMatch(/<(rect|path)\b/);
    expect(ink).not.toContain('<text');
    expect(svg.slice(svg.indexOf(ink) + ink.length)).toContain('<text');
  });

  it('leaves a button as drawn on a Flexible tab', () => {
    const svg = renderElementsToSvg(tabOf([card]));
    expect(svg).not.toContain(SKETCH_FACE_FILTER.id);
    expect(svg).not.toContain('visibility="hidden"');
  });

  it('leaves a button with its own Flexible finish as drawn on a Sketch tab', () => {
    const own = { ...card, finish: 'flexible' } as Element;
    expect(renderElementsToSvg(tabOf([own], 'sketch'))).not.toContain(FILTERED);
  });

  it('leaves a plain box to its sketched body', () => {
    const square = { ...createShape('square', 0, 0), id: 's', label: 'Hi' } as Element;
    const svg = renderElementsToSvg(tabOf([square], 'sketch'));
    expect(svg).not.toContain(FILTERED);
    expect(svg).toContain('data-finish="sketch"');
  });
});

describe('svgSketchArtDefs', () => {
  const sketch = (el: object) => [{ ...el, finish: 'sketch' }] as unknown as Element[];

  it("defines only the filters a tab's elements draw through", () => {
    expect(svgSketchArtDefs(sketch({ type: 'shape', shape: 'icon' }), undefined)).toContain(
      'lvd-sketch-art',
    );
    const faces = svgSketchArtDefs(sketch({ type: 'shape', shape: 'mode-button' }), undefined);
    expect(faces).toContain('lvd-sketch-face');
    expect(faces).not.toContain('lvd-sketch-art');
    expect(svgSketchArtDefs(sketch({ type: 'shape', shape: 'square' }), undefined)).toBe('');
    expect(svgSketchArtDefs([{ type: 'shape', shape: 'mode-button' }] as Element[], 'flexible')).toBe('');
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

  it('gives words that name no face the element’s, through its group', () => {
    for (const kind of ['mode-button', 'focus-button']) {
      expect(words(kind), kind).toMatch(/<g font-family="[^"]*Caveat/);
    }
  });

  it('leaves a Flexible tab with no font to the default face', () => {
    const svg = renderElementsToSvg(tabOf([{ ...createShape('mode-button', 0, 0), id: 'x' }]));
    expect(svg).not.toContain('Caveat');
  });
});
