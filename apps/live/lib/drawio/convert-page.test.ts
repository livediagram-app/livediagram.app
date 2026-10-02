// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  MAX_ELEMENTS_PER_TAB,
  actorFigureRect,
  actorNameRoom,
  type ShapeElement,
  PADDING_PX,
  isValidElement,
  labelFontPx,
} from '@livediagram/document';
import { LABEL_LINE_HEIGHT, labelTextWidth } from './text-size';
import { ReportTally } from './notes';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { model, vertex } from './test-support';

function convert(xml: string, attrs = '') {
  const tally = new ReportTally();
  const page = convertPage(readGraph(model(xml, attrs)), {
    tally,
    pageIdToTab: new Map(),
    // Geometry rules read in draw.io units; the page scale has its own tests (scale.test.ts).
    scale: 1,
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
      { tally, pageIdToTab: new Map(), images, imageKeys: new Map(), scale: 1 },
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
  it('widens an actor to hold its name on one line and its figure unsquashed', () => {
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
    // The wider of the name (9 character widths of the 14 px face, its padding, the caption padding)
    // and the figure at draw.io's height (90 wide for every 112 of the legs' reach).
    const width = Math.max(9 * 0.4785 * 14 + 2 * 6 + 16, (135 * 90) / 112);
    expect((actor as { width: number }).width).toBeCloseTo(width, 1);
    expect((actor as { x: number }).x).toBeCloseTo(130 - width / 2, 1);
  });

  it('keeps the figure at the drawn height, its name in its own room below', () => {
    const { page } = convert(
      vertex(
        'a',
        'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;',
        'x="0" y="0" width="30" height="60"',
        'parent="1" value="Returning visitor"',
      ),
    );
    const actor = page.elements[0] as ShapeElement;
    const figure = actorFigureRect(actor);
    // The legs reach 112 of the geometry's 130: draw.io's 60 px figure, then the name's room.
    expect((figure.height * 112) / 130).toBeCloseTo(60, 6);
    expect(figure.y + (figure.height * 112) / 130).toBeCloseTo(
      actor.height - actorNameRoom(actor),
      6,
    );
  });

  it("brings an image's label in as a caption under it", () => {
    const { page } = convert(
      vertex(
        'i',
        'shape=image;verticalLabelPosition=bottom;verticalAlign=top;image=https://x.test/a.png;',
        'x="0" y="0" width="200" height="100"',
        'parent="1" value="Sample picture"',
      ),
    );
    expect(page.elements.map((e) => e.type)).toEqual(['image', 'text']);
    expect(page.elements[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      alt: 'Sample picture',
    });
    expect(page.elements[1]).toMatchObject({
      label: 'Sample picture',
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

describe('paper colours follow the theme', () => {
  it('leaves near-white fills and near-black ink unset, and keeps chosen colours', () => {
    const { page } = convert(
      vertex(
        'a',
        'fillColor=#ffffff;strokeColor=#000000;fontColor=#333333;',
        'width="120" height="60"',
        'parent="1" value="A"',
      ) +
        vertex(
          'b',
          'fillColor=#fff2cc;strokeColor=#d6b656;fontColor=#000000;',
          'x="200" width="120" height="60"',
          'parent="1" value="B"',
        ),
    );
    const [a, b] = page.elements as Record<string, unknown>[];
    expect(a).not.toHaveProperty('fillColor');
    expect(a).not.toHaveProperty('strokeColor');
    expect(a).not.toHaveProperty('textColor');
    // The ink that reads on the chosen fill, as for any label without a colour of its own.
    expect(b).toMatchObject({ fillColor: '#fff2cc', strokeColor: '#d6b656', textColor: '#1e293b' });
  });

  it('keeps a white-filled text a text, not a white panel', () => {
    const { page } = convert(
      vertex(
        't',
        'text;html=1;fillColor=#ffffff;',
        'width="200" height="30"',
        'parent="1" value="Title"',
      ),
    );
    expect(page.elements[0]).toMatchObject({ type: 'text', label: 'Title' });
    expect(page.elements[0]).not.toHaveProperty('fillColor');
  });

  it('gives black arrows and black runs the theme ink', () => {
    const { page } = convert(
      vertex('a', '', 'width="10" height="10"', 'parent="1"') +
        vertex('b', '', 'x="100" width="10" height="10"', 'parent="1"') +
        '<mxCell id="e" edge="1" parent="1" source="a" target="b" style="strokeColor=#000000;"><mxGeometry relative="1" as="geometry"/></mxCell>' +
        vertex(
          'r',
          'html=1;',
          'y="100" width="100" height="40"',
          'parent="1" value="&lt;font color=&quot;#000000&quot;&gt;x&lt;/font&gt;&lt;b&gt;y&lt;/b&gt;"',
        ),
    );
    const arrow = page.elements.find((e) => e.type === 'arrow')!;
    expect(arrow).not.toHaveProperty('strokeColor');
    const rich = page.elements.find((e) => 'richText' in e && e.richText) as { richText: object[] };
    expect(rich.richText).toEqual([{ text: 'x' }, { text: 'y', bold: true }]);
  });
});

describe('opacity over paper', () => {
  it('blends a translucent fill with the white paper when it overlaps nothing', () => {
    const { page } = convert(
      vertex(
        'd',
        'rhombus;fillColor=#fff2cc;opacity=50;',
        'width="80" height="80"',
        'parent="1" value="?"',
      ),
    );
    expect(page.elements[0]).toMatchObject({ fillColor: '#fff9e6' });
    expect(page.elements[0]).not.toHaveProperty('opacity');
  });

  it('reads fillOpacity the same way', () => {
    const { page } = convert(
      vertex('d', 'fillColor=#000000;fillOpacity=20;', 'width="80" height="80"', 'parent="1"'),
    );
    expect(page.elements[0]).toMatchObject({ fillColor: '#cccccc' });
  });

  it('keeps the opacity where seeing through it matters', () => {
    const { page } = convert(
      vertex(
        'e',
        'ellipse;fillColor=#ffd966;opacity=50;',
        'width="300" height="200"',
        'parent="1"',
      ) + vertex('b', '', 'x="50" y="50" width="100" height="40"', 'parent="1" value="Inside"'),
    );
    expect(page.elements[0]).toMatchObject({ fillColor: '#ffd966', opacity: 0.5 });
  });
});

describe('actor captions on the canvas', () => {
  it("does not take the head's fill as the backdrop of the name below", () => {
    const { page } = convert(
      vertex(
        'a',
        'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;fillColor=#f8cecc;strokeColor=#b85450;',
        'width="30" height="60"',
        'parent="1" value="guest"',
      ),
    );
    expect(page.elements[0]).not.toHaveProperty('textColor');
  });
});

describe('the page scale', () => {
  it("grows the page so draw.io's labels keep their room", () => {
    const tally = new ReportTally();
    const page = convertPage(
      readGraph(
        model(vertex('a', '', 'x="100" y="50" width="120" height="60"', 'parent="1" value="A"')),
      ),
      { tally, pageIdToTab: new Map(), images: [], imageKeys: new Map() },
    );
    const a = page.elements[0] as { x: number; y: number; width: number; height: number };
    const k = a.width / 120;
    expect(k).toBeGreaterThan(1.2);
    expect(a).toMatchObject({ x: 100 * k, y: 50 * k, height: 60 * k });
  });
});

describe('auto-sized text', () => {
  // draw.io lets a text cell have no size: it draws the text about the cell's point.
  const at = (style: string, value = 'Ready / Waiting') =>
    `<mxCell id="t" value="${value}" style="text;html=1;${style}" vertex="1" parent="1"><mxGeometry x="400" y="280" as="geometry"/></mxCell>`;
  const sized = (lines: string[]) => {
    const px = labelFontPx('sm');
    const chars = Math.max(...lines.map((l) => l.length)) + 1;
    return {
      width: labelTextWidth(chars, px) + 2 * PADDING_PX.sm,
      height: lines.length * px * LABEL_LINE_HEIGHT + 2 * PADDING_PX.sm,
    };
  };

  it('sizes text in a zero-size box to its text, centred on the point', () => {
    const { page } = convert(at('align=center;verticalAlign=middle;'));
    const { width, height } = sized(['Ready / Waiting']);
    expect(page.elements).toHaveLength(1);
    const el = page.elements[0]!;
    expect(el).toMatchObject({ type: 'text', label: 'Ready / Waiting' });
    expect(el).toMatchObject({ width, height, x: 400 - width / 2, y: 280 - height / 2 });
  });

  it('grows from the point the way the text is aligned', () => {
    const { page } = convert(at('align=left;verticalAlign=top;', 'One&lt;br&gt;Two'));
    const { width, height } = sized(['One', 'Two']);
    expect(page.elements[0]).toMatchObject({ x: 400, y: 280, width, height });
  });

  it('keeps a size the cell does have', () => {
    const xml =
      '<mxCell id="t" value="Note" style="text;html=1;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="160" as="geometry"/></mxCell>';
    const { page } = convert(xml);
    expect(page.elements[0]).toMatchObject({ x: 10, width: 160, height: sized(['Note']).height });
  });
});

describe('notes and the text laid on them', () => {
  it("keeps a pale note pale: the nearest sticky colour, with that colour's ink", () => {
    const { page } = convert(
      vertex(
        'n',
        'shape=note;fillColor=#f5f5f5;',
        'width="120" height="60"',
        'parent="1" value="x"',
      ),
    );
    expect(page.elements[0]).toMatchObject({
      type: 'sticky',
      fillColor: '#ffffff',
      textColor: '#0f172a',
    });
  });

  it('makes the text laid on an empty note the words of that note', () => {
    const { page } = convert(
      vertex('n', 'shape=note;fillColor=#f5f5f5;', 'width="120" height="60"', 'parent="1"') +
        vertex(
          't',
          'text;html=1;align=left;',
          'x="10" y="10" width="100" height="40"',
          'parent="1" value="&lt;u&gt;Event&lt;/u&gt;&lt;br&gt;viewed"',
        ),
    );
    expect(page.elements).toHaveLength(1);
    expect(page.elements[0]).toMatchObject({
      type: 'sticky',
      label: 'Event\nviewed',
      richText: [{ text: 'Event', underline: true }, { text: '\nviewed' }],
      textAlignX: 'left',
      textColor: '#0f172a',
    });
  });

  it('gives text laid over a filled shape the ink that reads on that fill', () => {
    const { page } = convert(
      vertex('n', 'fillColor=#fff2cc;', 'width="120" height="60"', 'parent="1"') +
        vertex(
          't',
          'text;html=1;',
          'x="10" y="10" width="100" height="20"',
          'parent="1" value="Title"',
        ) +
        vertex(
          'o',
          'text;html=1;',
          'x="300" y="10" width="100" height="20"',
          'parent="1" value="Off"',
        ),
    );
    expect(page.elements.find((e) => 'label' in e && e.label === 'Title')).toMatchObject({
      textColor: '#1e293b',
    });
    expect(page.elements.find((e) => 'label' in e && e.label === 'Off')).not.toHaveProperty(
      'textColor',
    );
  });
});
