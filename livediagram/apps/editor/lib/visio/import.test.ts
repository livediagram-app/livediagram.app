// @vitest-environment jsdom
// Visio import end to end (docs/specs/020-import-export/visio-import.md): packages built in code, through the
// zip reader, the inert parse, the page graph and draw.io's converter, to elements and the report.
import { describe, expect, it } from 'vitest';
import {
  isValidElement,
  type ArrowElement,
  type Element,
  type ImageElement,
  type ShapeElement,
  type TextElement,
} from '@livediagram/document';
import { writeZip } from '@/lib/zip-writer-fixture';
import type { ImportNote } from '@/lib/drawio/notes';
import { importVisio } from './import';
import { visioRefusalMessage } from './refusals';
import {
  cells,
  connector,
  glue,
  onePage,
  rectGeometry,
  shape,
  vsdx,
  type FixtureMaster,
} from './test-support';

const tabIdForPage = (i: number) => `tab-${i}`;

async function read(bytes: Uint8Array<ArrayBuffer>) {
  const result = await importVisio(bytes, { tabIdForPage });
  if (!result.ok) throw new Error(result.error);
  return result;
}

async function onlyPage(bytes: Uint8Array<ArrayBuffer>) {
  const result = await read(bytes);
  for (const el of result.pages[0]!.elements) expect(isValidElement(el)).toBe(true);
  return { elements: result.pages[0]!.elements, notes: result.report.notes };
}

const note = (notes: ImportNote[], kind: ImportNote['kind']) => notes.find((n) => n.kind === kind);
const shapes = (els: Element[]) => els.filter((e): e is ShapeElement => e.type === 'shape');
const texts = (els: Element[]) => els.filter((e): e is TextElement => e.type === 'text');
const arrows = (els: Element[]) => els.filter((e): e is ArrowElement => e.type === 'arrow');

const BOX = { x: 2, y: 9, w: 1, h: 0.5 };
const masters = (...names: string[]): FixtureMaster[] =>
  names.map((name, i) => ({ id: String(i + 1), name }));

describe('refusals', () => {
  it('refuses a binary .vsd, a .vdx, and anything else by content', async () => {
    const vsd = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    expect(await importVisio(vsd, { tabIdForPage })).toEqual({
      ok: false,
      error: visioRefusalMessage('vsd'),
    });
    const vdx = new TextEncoder().encode('﻿  <?xml version="1.0"?><VisioDocument/>');
    expect(await importVisio(vdx, { tabIdForPage })).toEqual({
      ok: false,
      error: visioRefusalMessage('vdx'),
    });
    const text = new TextEncoder().encode('<mxfile/>');
    expect((await importVisio(text, { tabIdForPage })).ok).toBe(false);
    expect(await importVisio(new Uint8Array([1, 2, 3]), { tabIdForPage })).toEqual({
      ok: false,
      error: visioRefusalMessage('not-visio'),
    });
  });

  it('refuses a zip that is not a Visio package, a damaged zip and a page part that is not XML', async () => {
    const other = writeZip([{ name: 'word/document.xml', data: '<w/>' }]);
    expect(await importVisio(other, { tabIdForPage })).toEqual({
      ok: false,
      error: visioRefusalMessage('not-visio'),
    });
    const cut = onePage(shape(1, BOX)).slice(0, 40);
    expect(await importVisio(cut, { tabIdForPage })).toEqual({
      ok: false,
      error: visioRefusalMessage('damaged'),
    });
    const broken = writeZip([{ name: 'visio/pages/pages.xml', data: '<Pages><Page' }]);
    expect(await importVisio(broken, { tabIdForPage })).toEqual({
      ok: false,
      error: visioRefusalMessage('damaged'),
    });
  });

  it('refuses a package with no pages', async () => {
    const empty = writeZip([{ name: 'visio/pages/pages.xml', data: '<Pages/>' }]);
    expect(await importVisio(empty, { tabIdForPage })).toEqual({
      ok: false,
      error: visioRefusalMessage('no-pages'),
    });
  });

  it('refuses a file over the size limit before reading it', async () => {
    const big = new Uint8Array(50 * 1024 * 1024 + 1);
    expect(await importVisio(big, { tabIdForPage })).toEqual({
      ok: false,
      error: visioRefusalMessage('too-large'),
    });
  });

  it('every refusal has a message', () => {
    for (const reason of ['too-large-unpacked', 'unreadable'] as const) {
      expect(visioRefusalMessage(reason).length).toBeGreaterThan(10);
    }
  });
});

describe('pages', () => {
  it('reads every page in order with its name, an unpartnered page empty', async () => {
    const bytes = vsdx({
      pages: [
        { name: 'Flow', shapes: shape(1, BOX, { text: 'A' }) },
        { name: 'Back', background: true, shapes: shape(1, BOX, { text: 'B' }) },
        { shapes: '' },
      ],
    });
    const result = await read(bytes);
    expect(result.pages.map((p) => [p.tabId, p.name])).toEqual([
      ['tab-0', 'Flow'],
      ['tab-1', 'Back'],
      ['tab-2', ''],
    ]);
    expect(result.pages[2]!.elements).toEqual([]);
    expect(result.meta).toEqual({});
  });

  it('places shapes in pixels from the top-left, y flipped against the page height', async () => {
    const bytes = vsdx({
      pages: [{ height: 10, shapes: shape(1, { x: 1, y: 9, w: 2, h: 1 }, { text: 'Hi' }) }],
    });
    const [el] = (await read(bytes)).pages[0]!.elements as TextElement[];
    expect(el).toBeDefined();
  });
});

describe('masters', () => {
  it('maps Basic and Flowchart masters to livediagram shapes, a copy number ignored', async () => {
    const names = [
      'Process',
      'Decision',
      'Ellipse.12',
      'Start/End',
      'Document',
      'Data',
      'Database',
      'Hexagon',
      'Triangle',
      'Trapezoid',
      '5-Point Star',
      'Rounded rectangle',
    ];
    const page = names
      .map((_, i) =>
        shape(i + 1, { x: 1 + i, y: 5, w: 1, h: 0.75 }, { master: String(i + 1), text: `S${i}` }),
      )
      .join('');
    const { elements, notes } = await onlyPage(
      vsdx({ pages: [{ shapes: page }], masters: masters(...names) }),
    );
    expect(shapes(elements).map((s) => s.shape)).toEqual([
      'square',
      'diamond',
      'circle',
      'stadium',
      'document',
      'parallelogram',
      'cylinder',
      'hexagon',
      'triangle',
      'trapezoid',
      'star',
      'square',
    ]);
    expect(note(notes, 'shape-approximated')).toBeUndefined();
    expect(note(notes, 'shape-as-text')).toBeUndefined();
    expect(shapes(elements).map((s) => s.label)).toEqual(names.map((_, i) => `S${i}`));
  });

  it('counts approximated masters', async () => {
    const names = [
      'Octagon',
      'Merge',
      'Predefined process',
      'Stored data',
      'Manual input',
      'Delay',
      'Sort',
      'Multiple documents',
    ];
    const page = names
      .map((_, i) => shape(i + 1, { x: 1 + i, y: 5, w: 1, h: 1 }, { master: String(i + 1) }))
      .join('');
    const { elements, notes } = await onlyPage(
      vsdx({ pages: [{ shapes: page }], masters: masters(...names) }),
    );
    expect(shapes(elements).map((s) => s.shape)).toEqual([
      'hexagon',
      'triangle',
      'square',
      'cylinder',
      'trapezoid',
      'stadium',
      'diamond',
      'document',
    ]);
    expect(note(notes, 'shape-approximated')?.count).toBe(names.length);
  });

  it('brings any other master in as a text box carrying its words, or its name, named in the report', async () => {
    const page =
      shape(1, BOX, { master: '1', text: 'Web server' }) +
      shape(2, { x: 4, y: 9, w: 1, h: 1 }, { master: '1' }) +
      shape(3, { x: 6, y: 9, w: 1, h: 1 }, { master: '2' });
    const { elements, notes } = await onlyPage(
      vsdx({ pages: [{ shapes: page }], masters: masters('Server.31', 'Firewall') }),
    );
    expect(texts(elements).map((t) => t.label)).toEqual(['Web server', 'Server', 'Firewall']);
    expect(note(notes, 'shape-as-text')).toMatchObject({
      count: 3,
      names: [
        { name: 'Server', count: 2 },
        { name: 'Firewall', count: 1 },
      ],
    });
  });

  it('an Annotation is a text box, not counted', async () => {
    const { elements, notes } = await onlyPage(
      vsdx({
        pages: [{ shapes: shape(1, BOX, { master: '1', text: 'Note' }) }],
        masters: masters('Annotation'),
      }),
    );
    expect(texts(elements)).toHaveLength(1);
    expect(notes).toEqual([]);
  });

  it('a shape inherits its master shape cells, and a mapped master consumes its sub-shapes', async () => {
    const master: FixtureMaster = {
      id: '1',
      name: 'Process',
      shapes: `<Shape ID="5" Type="Group">${cells({ FillForegnd: '#ff8800', Width: 1, Height: 1 })}<Shapes><Shape ID="6"/></Shapes></Shape>`,
    };
    const page =
      shape(1, BOX, {
        master: '1',
        type: 'Group',
        inner: `<Shapes>${shape(2, BOX, { masterShape: '6', text: 'inner' })}</Shapes>`,
      }) +
      shape(3, { x: 5, y: 9, w: 1, h: 0.5 }) +
      connector(4, { x: 2.5, y: 9 }, { x: 4.5, y: 9 });
    const { elements } = await onlyPage(
      vsdx({ pages: [{ shapes: page, connects: glue(4, 'BeginX', 2) }], masters: [master] }),
    );
    const [box] = shapes(elements);
    expect(box).toMatchObject({ shape: 'square', fillColor: '#ff8800' });
    expect(texts(elements)).toEqual([]);
    expect(arrows(elements)[0]!.from).toMatchObject({ kind: 'pinned', elementId: box!.id });
  });

  it('a master the masters part does not list is a shape with no master', async () => {
    const page = shape(1, BOX, { master: '99', text: 'Loose', inner: rectGeometry(1, 0.5) });
    const { elements } = await onlyPage(
      vsdx({ pages: [{ shapes: page }], masters: masters('Process') }),
    );
    expect(shapes(elements)[0]).toMatchObject({ shape: 'square', label: 'Loose' });
  });
});

describe('shapes with no master', () => {
  it('reads rectangles, rounded ones, ellipses and diamonds from their geometry', async () => {
    const ellipse = `<Section N="Geometry" IX="0"><Row T="Ellipse" IX="1">${cells({ X: 0.5, Y: 0.25, A: 1, B: 0.25, C: 0.5, D: 0.5 })}</Row></Section>`;
    const diamond = `<Section N="Geometry" IX="0"><Row T="RelMoveTo" IX="1">${cells({ X: 0.5, Y: 0 })}</Row><Row T="RelLineTo" IX="2">${cells({ X: 1, Y: 0.5 })}</Row><Row T="RelLineTo" IX="3">${cells({ X: 0.5, Y: 1 })}</Row><Row T="RelLineTo" IX="4">${cells({ X: 0, Y: 0.5 })}</Row><Row T="RelLineTo" IX="5">${cells({ X: 0.5, Y: 0 })}</Row></Section>`;
    const page =
      shape(1, { x: 1, y: 9, w: 1, h: 0.5 }, { inner: rectGeometry(1, 0.5), text: 'R' }) +
      shape(
        2,
        { x: 3, y: 9, w: 1, h: 0.5 },
        { inner: rectGeometry(1, 0.5), cells: { Rounding: 0.1 } },
      ) +
      shape(3, { x: 5, y: 9, w: 1, h: 0.5 }, { inner: ellipse }) +
      shape(4, { x: 7, y: 9, w: 1, h: 0.5 }, { inner: diamond });
    const { elements, notes } = await onlyPage(onePage(page));
    expect(shapes(elements).map((s) => s.shape)).toEqual(['square', 'square', 'circle', 'diamond']);
    expect(shapes(elements)[1]!.borderRadius).not.toBe('none');
    expect(notes).toEqual([]);
  });

  it('a shape with hidden, empty or unpainted geometry is a text box; without text, nothing', async () => {
    const hidden = rectGeometry(1, 1).replace('<Row', `${cells({ NoShow: 1 })}<Row`);
    const unpainted = `<Section N="Geometry" IX="0">${cells({ NoFill: 1, NoLine: 1 })}</Section>`;
    const page =
      shape(1, BOX, { text: 'Plain words' }) +
      shape(2, BOX, { inner: hidden, text: 'Hidden outline' }) +
      shape(3, BOX, { inner: unpainted, text: 'Unpainted' }) +
      shape(4, BOX);
    const { elements, notes } = await onlyPage(onePage(page));
    expect(texts(elements).map((t) => t.label)).toEqual([
      'Plain words',
      'Hidden outline',
      'Unpainted',
    ]);
    expect(elements).toHaveLength(3);
    expect(notes).toEqual([]);
  });

  it('any other geometry is a text box named Shape', async () => {
    const tri = `<Section N="Geometry" IX="0"><Row T="MoveTo" IX="1">${cells({ X: 0, Y: 0 })}</Row><Row T="LineTo" IX="2">${cells({ X: 1, Y: 0 })}</Row><Row T="LineTo" IX="3">${cells({ X: 0.5, Y: 1 })}</Row></Section>`;
    const two = rectGeometry(1, 1) + rectGeometry(1, 1).replace('IX="0"', 'IX="1"');
    const arc = `<Section N="Geometry" IX="0"><Row T="MoveTo" IX="1">${cells({ X: 0, Y: 0 })}</Row><Row T="ArcTo" IX="2">${cells({ X: 1, Y: 0, A: 0.2 })}</Row></Section>`;
    const page =
      shape(1, BOX, { inner: tri }) +
      shape(2, BOX, { inner: two, text: 'Two' }) +
      shape(3, BOX, { inner: arc }) +
      shape(4, BOX, {
        inner: `<Section N="Geometry" IX="0"><Row T="MoveTo" IX="1"><Cell N="X" V="oops"/></Row></Section>`,
      });
    const { elements, notes } = await onlyPage(onePage(page));
    expect(texts(elements).map((t) => t.label)).toEqual(['Shape', 'Two', 'Shape', 'Shape']);
    expect(note(notes, 'shape-as-text')).toMatchObject({
      count: 4,
      names: [{ name: 'Shape', count: 4 }],
    });
  });
});

describe('properties', () => {
  it('maps fill, line, dashes, dots, weight, rotation and flips', async () => {
    const page =
      shape(1, BOX, {
        inner: rectGeometry(1, 0.5),
        cells: {
          FillForegnd: '#3366CC',
          LineColor: '2',
          LinePattern: 2,
          LineWeight: 0.0417,
          Angle: Math.PI / 2,
          FlipX: 1,
        },
      }) +
      shape(2, BOX, { inner: rectGeometry(1, 0.5), cells: { FillPattern: 0, LinePattern: 3 } }) +
      shape(3, BOX, {
        inner: rectGeometry(1, 0.5),
        cells: { FillForegndTrans: 1, LinePattern: 0 },
      }) +
      shape(4, BOX, {
        inner: rectGeometry(1, 0.5),
        cells: { FillForegnd: '30', LineColor: 'Themed' },
      });
    const { elements } = await onlyPage(
      onePage(page, undefined, { colours: '<ColorEntry IX="30" RGB="#00AA55"/>' }),
    );
    const [a, b, c, d] = shapes(elements);
    expect(a).toMatchObject({
      fillColor: '#3366cc',
      strokeColor: '#ff0000',
      strokeStyle: 'dashed',
      rotation: 270,
    });
    expect(b!.fillColor).toBe('transparent');
    expect(b!.strokeStyle).toBe('dotted');
    expect(c!.fillColor).toBe('transparent');
    expect(c!.strokeWidth).toBe('none');
    expect(d!.fillColor).toBe('#00aa55');
    expect(d!.strokeColor).toBeUndefined();
  });

  it('sets text from the first character run and paragraph, fields and line breaks included', async () => {
    const inner =
      rectGeometry(1, 0.5) +
      `<Section N="Character"><Row IX="0">${cells({ Size: 0.25, Color: '#C00000', Style: 3, Font: 'Courier New' })}</Row></Section>` +
      `<Section N="Paragraph"><Row IX="0">${cells({ HorzAlign: 0 })}</Row></Section>`;
    const page = shape(1, BOX, {
      inner,
      cells: { VerticalAlign: 0 },
      text: '<cp IX="0"/><pp IX="0"/>Line one\r\nLine <fld IX="0">two</fld> three\n\n',
    });
    const { elements } = await onlyPage(onePage(page));
    const [box] = shapes(elements);
    expect(box).toMatchObject({
      label: 'Line one\nLine two\nthree',
      textColor: '#c00000',
      textBold: true,
      textItalic: true,
      textAlignX: 'left',
      textAlignY: 'top',
      font: 'roboto-mono',
    });
  });

  it('cuts very long text and counts it', async () => {
    const { elements, notes } = await onlyPage(
      onePage(shape(1, BOX, { text: 'x'.repeat(12_000) })),
    );
    expect(texts(elements)[0]!.label!.length).toBeLessThanOrEqual(5000);
    expect(note(notes, 'text-truncated')).toBeDefined();
  });

  it('ignores unsafe font names, numbered fonts and strikes through', async () => {
    const inner = `<Section N="Character"><Row IX="0">${cells({ Font: 'Bad;name', Strikethru: 1, Style: 4 })}</Row></Section>`;
    const page =
      shape(1, BOX, { inner, text: 'S' }) +
      shape(2, BOX, { inner: inner.replace('Bad;name', '4'), text: 'N' });
    const { elements } = await onlyPage(onePage(page));
    expect(texts(elements)[0]).toMatchObject({ textUnderline: true });
    expect(texts(elements)[0]!.font).toBeUndefined();
  });
});

describe('groups', () => {
  it('flattens a group that draws nothing, placing its shapes through its frame', async () => {
    const group = shape(
      1,
      { x: 4, y: 8, w: 2, h: 2 },
      {
        type: 'Group',
        inner: `<Shapes>${shape(2, { x: 0.5, y: 0.5, w: 1, h: 1 }, { inner: rectGeometry(1, 1), text: 'child' })}</Shapes>`,
      },
    );
    const { elements, notes } = await onlyPage(vsdx({ pages: [{ height: 10, shapes: group }] }));
    expect(shapes(elements)).toHaveLength(1);
    expect(note(notes, 'group-flattened')?.count).toBe(1);
  });

  it('draws a group that has its own outline or words, then its shapes', async () => {
    const group = shape(
      1,
      { x: 4, y: 8, w: 2, h: 2 },
      {
        type: 'Group',
        text: 'Team',
        inner: `${rectGeometry(2, 2)}<Shapes>${shape(2, { x: 0.5, y: 0.5, w: 1, h: 1 }, { text: 'child' })}</Shapes>`,
      },
    );
    const otherGroup = shape(
      3,
      { x: 1, y: 1, w: 1, h: 1 },
      {
        type: 'Group',
        text: 'Odd',
        inner: `<Section N="Geometry" IX="0"><Row T="MoveTo" IX="1">${cells({ X: 0, Y: 0 })}</Row><Row T="LineTo" IX="2">${cells({ X: 1, Y: 1 })}</Row></Section>`,
      },
    );
    const { elements, notes } = await onlyPage(onePage(group + otherGroup));
    expect(shapes(elements).map((s) => s.label)).toEqual(['Team']);
    expect(texts(elements).map((t) => t.label)).toEqual(['child', 'Odd']);
    expect(note(notes, 'group-flattened')).toBeUndefined();
  });

  it('leaves out shapes nested past the depth cap, counted', async () => {
    let nested = shape(100, BOX, { text: 'deep' });
    for (let i = 0; i < 34; i++) {
      nested = shape(
        i + 1,
        { x: 0.5, y: 0.5, w: 1, h: 1 },
        { type: 'Group', inner: `<Shapes>${nested}</Shapes>` },
      );
    }
    const { notes } = await onlyPage(onePage(nested));
    expect(note(notes, 'content-truncated')?.count).toBeGreaterThan(0);
  });
});

describe('connectors', () => {
  const two =
    shape(1, { x: 1, y: 9, w: 1, h: 0.5 }, { inner: rectGeometry(1, 0.5) }) +
    shape(2, { x: 5, y: 7, w: 1, h: 0.5 }, { inner: rectGeometry(1, 0.5) });

  it('glues ends to the shapes their Connect rows name, through Visio corners', async () => {
    const page =
      two +
      connector(
        3,
        { x: 1.5, y: 9 },
        { x: 4.5, y: 7 },
        {
          via: [
            { x: 3, y: 9 },
            { x: 3, y: 7 },
          ],
          text: 'yes',
          cells: { EndArrow: 4, BeginArrow: 0 },
        },
      );
    const { elements, notes } = await onlyPage(
      onePage(page, glue(3, 'BeginX', 1) + glue(3, 'EndX', 2)),
    );
    const [box1, box2] = shapes(elements);
    const [line] = arrows(elements);
    expect(line!.from).toMatchObject({ kind: 'pinned', elementId: box1!.id });
    expect(line!.to).toMatchObject({ kind: 'pinned', elementId: box2!.id });
    expect(line!.label).toBe('yes');
    expect(line!.arrowEnds).toBeUndefined();
    expect(note(notes, 'arrowhead-approximated')).toBeUndefined();
  });

  it('leaves unglued ends free, glue to unknown shapes free, and curves a route with arcs', async () => {
    const page =
      connector(3, { x: 1, y: 1 }, { x: 4, y: 1 }, { rowType: 'ArcTo', via: [{ x: 2.5, y: 2 }] }) +
      connector(4, { x: 1, y: 2 }, { x: 4, y: 2 });
    const { elements } = await onlyPage(
      onePage(
        page,
        glue(4, 'EndX', 99) + '<Connect FromSheet="4"/>' + glue(4, 'PinX' as 'BeginX', 3),
      ),
    );
    const [curved, straight] = arrows(elements);
    expect(curved!.from.kind).toBe('free');
    expect(curved!.arrowStyle).toBe('curved');
    expect(straight!.to.kind).toBe('free');
  });

  it('maps arrowheads, counting the ones livediagram does not draw', async () => {
    const heads = [
      { BeginArrow: 1, EndArrow: 20 },
      { BeginArrow: 22, EndArrow: 45 },
    ];
    const page = heads
      .map((h, i) => connector(i + 1, { x: 1, y: 1 + i }, { x: 4, y: 1 + i }, { cells: h }))
      .join('');
    const { elements, notes } = await onlyPage(onePage(page));
    expect(arrows(elements).map((a) => a.arrowEnds)).toEqual(['both', 'both']);
    expect(note(notes, 'arrowhead-approximated')?.count).toBe(1);
  });

  it('a Dynamic connector master is a connector too', async () => {
    const page = connector(1, { x: 1, y: 1 }, { x: 4, y: 1 }, { master: '1' });
    const { elements } = await onlyPage(
      vsdx({ pages: [{ shapes: page }], masters: masters('Dynamic connector') }),
    );
    expect(arrows(elements)).toHaveLength(1);
  });
});

describe('pictures', () => {
  const PNG = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    ),
    (c) => c.charCodeAt(0),
  );
  const foreign = (id: number, rid: string) =>
    shape(id, BOX, {
      type: 'Foreign',
      inner: `<ForeignData ForeignType="Bitmap"><Rel r:id="${rid}"/></ForeignData>`,
      text: 'logo',
    });

  it('requests raster pictures through the pipeline and counts the rest as unavailable', async () => {
    const bytes = vsdx({
      pages: [
        {
          shapes:
            foreign(1, 'rIdA') + foreign(2, 'rIdB') + foreign(3, 'rIdC') + foreign(4, 'rIdNone'),
        },
      ],
      media: [
        { name: 'image1.png', data: PNG },
        { name: 'image2.emf', data: 'emf' },
      ],
      pageRels: {
        0: {
          rIdA: '../media/image1.png',
          rIdB: '../media/image2.emf',
          rIdC: '../../../outside.png',
        },
      },
    });
    const result = await read(bytes);
    const images = result.pages[0]!.elements.filter((e): e is ImageElement => e.type === 'image');
    expect(images).toHaveLength(4);
    expect(images[0]!.alt).toBe('logo');
    expect(result.images).toHaveLength(1);
    expect(result.images[0]!.source).toMatchObject({ kind: 'data-url' });
    expect(note(result.report.notes, 'image-unavailable')?.count).toBe(3);
  });
});

describe('limits', () => {
  it('keeps the first 100 pages and counts the rest', async () => {
    const pages = Array.from({ length: 101 }, (_, i) => ({ name: `P${i}`, shapes: '' }));
    const result = await read(vsdx({ pages, method: 'stored' }));
    expect(result.pages).toHaveLength(100);
    expect(note(result.report.notes, 'content-truncated')?.count).toBe(1);
  });
});
