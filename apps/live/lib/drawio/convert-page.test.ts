// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_ELEMENTS_PER_TAB, isValidElement } from '@livediagram/document';
import { ReportTally } from './notes';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { model, vertex } from './test-support';

function convert(xml: string, attrs = '') {
  const tally = new ReportTally();
  const page = convertPage(readGraph(model(xml, attrs)), {
    tally,
    pageIdToTab: new Map(),
    images: [],
    imageKeys: new Map(),
  });
  return { page, notes: tally.notes() };
}

describe('convertPage', () => {
  it('keeps paint order: parents before children, edges where they were', () => {
    const { page } = convert(
      vertex('p', 'swimlane;', 'x="0" y="0" width="300" height="200"', 'parent="1" value="P"') +
        '<mxCell id="e" edge="1" parent="1" source="c" target="p"><mxGeometry relative="1" as="geometry"/></mxCell>' +
        vertex('c', '', 'x="10" y="40" width="50" height="50"', 'parent="p" value="C"'),
    );
    expect(page.elements.map((e) => e.type)).toEqual(['shape', 'shape', 'arrow']);
  });

  it('skips a vertex with no geometry and counts it', () => {
    const { page, notes } = convert('<mxCell id="v" vertex="1" parent="1" value="x"/>');
    expect(page.elements).toEqual([]);
    expect(notes).toEqual([{ kind: 'hidden-skipped', count: 1 }]);
  });

  it('counts a hidden container with everything inside it', () => {
    const { notes } = convert(
      vertex('p', '', 'width="10" height="10"', 'parent="1" visible="0"') +
        vertex('c1', '', 'width="1" height="1"', 'parent="p"') +
        vertex('c2', '', 'width="1" height="1"', 'parent="c1"'),
    );
    expect(notes).toEqual([{ kind: 'hidden-skipped', count: 3 }]);
  });

  it('hands connections to a collapsed container’s children to the container', () => {
    const { page, notes } = convert(
      vertex('p', 'swimlane;', 'width="100" height="23"', 'parent="1" collapsed="1" value="P"') +
        vertex('c', '', 'x="10" y="30" width="10" height="10"', 'parent="p"') +
        vertex('o', '', 'x="300" width="10" height="10"', 'parent="1" value="O"') +
        '<mxCell id="e" edge="1" parent="1" source="o" target="c"><mxGeometry relative="1" as="geometry"/></mxCell>',
    );
    const arrow = page.elements.find((e) => e.type === 'arrow')!;
    const p = page.elements.find((e) => 'label' in e && e.label === 'P')!;
    expect(arrow).toMatchObject({ to: { kind: 'pinned', elementId: p.id } });
    expect(notes).toEqual([{ kind: 'collapsed-skipped', count: 1 }]);
  });

  it('survives a parent cycle', () => {
    const { page } = convert(
      vertex('a', '', 'width="1" height="1"', 'parent="b"') +
        vertex('b', '', 'width="1" height="1"', 'parent="a"'),
    );
    expect(page.elements.every(isValidElement)).toBe(true);
  });

  it('counts an image on a shape that is not an image, and a page background image', () => {
    const { notes } = convert(
      vertex('v', 'label;image=https://x.test/i.png;', 'width="10" height="10"', 'parent="1"'),
      'backgroundImage="{&quot;src&quot;:&quot;x&quot;}"',
    );
    expect(notes).toEqual([{ kind: 'image-unavailable', count: 2 }]);
  });

  it('requests each embedded image once per distinct picture, and never a URL', () => {
    const images: import('@/lib/import-images').ImportImageRequest[] = [];
    const tally = new ReportTally();
    const img = (id: string, src: string) =>
      vertex(id, `shape=image;image=${src};`, 'width="20" height="10"', 'parent="1"');
    convertPage(
      readGraph(
        model(
          img('a', 'data:image/png,QUJD') +
            img('b', 'data:image/png,QUJD') +
            img('c', 'data:image/svg+xml,PHN2Zy8+') +
            img('d', 'https://x.test/y.png') +
            img('e', 'data:image/svg+xml,%3Csvg%2F%3E'),
        ),
      ),
      { tally, pageIdToTab: new Map(), images, imageKeys: new Map() },
    );
    expect(images.map((i) => [i.key, i.source?.kind === 'data-url' && i.source.dataUrl])).toEqual([
      ['drawio-image-1', 'data:image/png;base64,QUJD'],
      ['drawio-image-1', 'data:image/png;base64,QUJD'],
      ['drawio-image-2', 'data:image/svg+xml;base64,PHN2Zy8+'],
      ['drawio-image-3', 'data:image/svg+xml,%3Csvg%2F%3E'],
    ]);
    expect(images[0]!.hint).toEqual({ width: 20, height: 10 });
    // Embedded images are the pipeline's to report; only the one it never sees is a note.
    expect(tally.notes()).toEqual([{ kind: 'image-unavailable', count: 1 }]);
  });

  it('leaves one layer implicit', () => {
    const { page } = convert(vertex('v', '', 'width="1" height="1"', 'parent="1"'));
    expect(page.layers).toBeUndefined();
    expect(page.elements[0]).not.toHaveProperty('layerId');
  });

  it('truncates a page beyond the element limit and counts the rest', () => {
    const many = Array.from({ length: MAX_ELEMENTS_PER_TAB + 3 }, (_, i) =>
      vertex(`v${i}`, '', `x="${i}" width="1" height="1"`, 'parent="1"'),
    ).join('');
    const { page, notes } = convert(many);
    expect(page.elements).toHaveLength(MAX_ELEMENTS_PER_TAB);
    expect(notes).toEqual([{ kind: 'content-truncated', count: 3 }]);
  });
});

describe('captions below figures', () => {
  it('widens an actor so its name reads on one line under the figure', () => {
    const { page } = convert(
      vertex(
        'a',
        'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;fontSize=16.7;',
        'x="100" y="560" width="60" height="135"',
        'parent="1" value="Consumer"',
      ),
    );
    const actor = page.elements[0]!;
    expect(actor).toMatchObject({ shape: 'actor', label: 'Consumer', textAlignY: 'bottom' });
    // 9 character widths of the 14 px label face, its padding, and the caption padding.
    const width = 9 * 0.4785 * 14 + 2 * 6 + 16;
    expect((actor as { width: number }).width).toBeCloseTo(width, 1);
    expect((actor as { x: number }).x).toBeCloseTo(130 - width / 2, 1);
  });

  it("brings an image's label in as a caption under it", () => {
    const { page } = convert(
      vertex(
        'i',
        'shape=image;verticalLabelPosition=bottom;verticalAlign=top;image=https://x.test/a.png;',
        'x="0" y="0" width="200" height="100"',
        'parent="1" value="Home page"',
      ),
    );
    expect(page.elements.map((e) => e.type)).toEqual(['image', 'text']);
    expect(page.elements[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      alt: 'Home page',
    });
    expect(page.elements[1]).toMatchObject({
      label: 'Home page',
      y: 100,
      width: 200,
      textAlignX: 'center',
    });
  });
});

describe('marks, end states and braces', () => {
  it("colours a mark's icon with its stencil's fill when it has no stroke", () => {
    const { page } = convert(
      vertex(
        'x',
        'shape=mxgraph.basic.x;fillColor=#ff0000;strokeColor=none;',
        'width="30" height="30"',
        'parent="1"',
      ),
    );
    expect(page.elements[0]).toMatchObject({ shape: 'icon', iconId: 'x', strokeColor: '#ff0000' });
  });

  it('draws an end state as a filled circle in a thick ring', () => {
    const { page, notes } = convert(
      vertex(
        'e',
        'ellipse;shape=endState;fillColor=#000000;strokeColor=#ff0000;',
        'width="30" height="30"',
        'parent="1"',
      ),
    );
    expect(page.elements[0]).toMatchObject({
      shape: 'circle',
      strokeColor: '#ff0000',
      strokeWidth: 'thick',
    });
    expect(notes).toEqual([]);
  });

  it('draws a curly bracket as a line down its spine', () => {
    const { page, notes } = convert(
      vertex('b', 'shape=curlyBracket;', 'x="0" y="0" width="20" height="400"', 'parent="1"'),
    );
    expect(page.elements[0]).toMatchObject({
      type: 'arrow',
      arrowEnds: 'none',
      from: { kind: 'free', x: 10, y: 0 },
      to: { kind: 'free', x: 10, y: 400 },
    });
    expect(notes).toEqual([{ kind: 'shape-approximated', count: 1 }]);
  });
});
