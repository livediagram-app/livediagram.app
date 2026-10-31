import { describe, expect, it } from 'vitest';
import {
  createShape,
  createText,
  layOutPages,
  newSlidePage,
  type Element,
  type Tab,
} from '@livedocuments/document';
import { openOfficePackage } from '../office-import/package';
import { readPptx } from '../office-import/pptx';
import { openZip } from '../office-import/zip';
import { parseXml } from '../office-import/xml';
import { buildDeck, cutTo, deckSize, placementFor, backgroundKind } from './pptx-build';
import { writePptx } from './pptx-write';
import { everyKindDeck, fakeDrawer, ONE_PIXEL_PNG } from './test-tabs';

// docs/specs/020-import-export/office-export.md "PowerPoint: one slide a page": the deck read back through the
// PowerPoint import, every part well-formed XML.

async function everyPart(bytes: Uint8Array): Promise<Map<string, string>> {
  const zip = openZip(bytes);
  const out = new Map<string, string>();
  for (const name of zip.names()) {
    const data = await zip.read(name, 64 * 1024 * 1024);
    if (/\.(xml|rels)$/.test(name)) out.set(name, new TextDecoder().decode(data!));
  }
  return out;
}

function slideTab(
  elements: (page: { x: number; y: number }) => Element[],
  extra: Partial<Tab> = {},
) {
  const pages = [newSlidePage('p1')];
  const laid = layOutPages(pages);
  const tab: Tab = {
    id: 't',
    name: 'T',
    elements: elements(laid[0]!.rect),
    pages,
    templateChosen: true,
    ...extra,
  };
  return { tab, pages: laid };
}

describe('PowerPoint export', () => {
  it('writes a slide a page, every element kind, as a deck the import reads back', async () => {
    const { tab, pages, deck } = everyKindDeck();
    const drawer = fakeDrawer();
    const progress: number[] = [];
    const built = await buildDeck({ tab, pages, deck, title: 'Doc' }, drawer, {
      onProgress: (p) => progress.push(p),
    });
    expect(progress.at(-1)).toBe(1);
    expect(progress).toHaveLength(pages.length);
    const bytes = writePptx(built, new Date('2026-10-31T12:00:00Z'));

    // Every part parses (the import's reader refuses anything malformed).
    const parts = await everyPart(bytes);
    for (const [name, xml] of parts) expect(() => parseXml(xml), name).not.toThrow();
    expect(parts.get('[content_types].xml')).toContain('presentation.main+xml');

    const read = await readPptx(await openOfficePackage(bytes, 'powerpoint'));
    expect(read.slides).toHaveLength(pages.length);
    expect(read.cx).toBe(12_192_000);
    expect(read.cy).toBe(6_858_000);
    expect(read.slides[0]!.notes).toBe('Open with the numbers.');
    expect(read.slides[1]!.hidden).toBe(true);
    // The basic shapes came back as text (their labels), the rest as pictures.
    const labels = read.slides.flatMap((s) =>
      s.items.flatMap((i) => (i.kind === 'text' ? [i.label] : [])),
    );
    for (const kind of [
      'square',
      'circle',
      'diamond',
      'triangle',
      'hexagon',
      'star',
      'cloud',
      'stadium',
    ])
      expect(labels).toContain(kind);
    expect(labels.some((l) => l.startsWith('Every word'))).toBe(true);
    // A chart or a table is a picture, drawn alone and cut to the page.
    const pictured = new Set(drawer.regions.flatMap((r) => r.ids));
    for (const id of tab.elements
      .filter((e) => e.type === 'table' || e.type === 'arrow')
      .map((e) => e.id))
      expect(pictured.has(id)).toBe(true);
    expect(read.pictures.length).toBe(drawer.regions.length);
  });

  it('keeps a text box’s font, size, colour, weight and alignment', async () => {
    const { tab, pages } = slideTab((r) => [
      {
        ...createText(0, 0),
        id: 'title',
        x: r.x + 100,
        y: r.y + 100,
        width: 800,
        height: 120,
        label: 'Big title',
        textSize: 48,
        textBold: true,
        textItalic: true,
        textUnderline: true,
        textAlignX: 'left',
        textAlignY: 'top',
        textColor: '#dc2626',
        font: 'poppins',
        rotation: 30,
      },
      { ...createText(0, 0), id: 'blank', x: r.x, y: r.y, label: '   ' },
    ]);
    const built = await buildDeck({ tab, pages, title: 'T' }, fakeDrawer(), {});
    const shape = built.slides[0]!.items[0]!;
    expect(built.slides[0]!.items).toHaveLength(1);
    if (shape.kind !== 'shape') throw new Error('not native');
    expect(shape.txBox).toBe(true);
    expect(shape.rotation).toBe(30);
    expect(shape.box).toEqual({ x: 635_000, y: 635_000, cx: 5_080_000, cy: 762_000 });
    const run = shape.body!.paragraphs[0]!.runs[0]!;
    expect(run).toMatchObject({
      sizePt: 24,
      bold: true,
      italic: true,
      underline: true,
      font: 'Poppins',
    });
    expect(run.colour).toEqual({ hex: 'DC2626', alpha: 1 });
    expect(shape.body!.paragraphs[0]!.align).toBe('l');
    expect(shape.body!.anchor).toBe('t');

    const read = await readPptx(await openOfficePackage(writePptx(built), 'powerpoint'));
    const item = read.slides[0]!.items[0]!;
    expect(item).toMatchObject({
      kind: 'text',
      label: 'Big title',
      sizePt: 24,
      bold: true,
      italic: true,
      alignX: 'left',
      alignY: 'top',
    });
  });

  it('draws a shape natively with its fill, border and corner, or as a picture when it cannot', async () => {
    const { tab, pages } = slideTab((r) => [
      {
        ...createShape('square', 0, 0),
        id: 'rounded',
        x: r.x + 100,
        y: r.y + 100,
        width: 200,
        height: 100,
        label: 'Go',
        fillColor: '#fde68a',
        strokeColor: 'rgb(37, 99, 235)',
        strokeWidth: 'thick',
        strokeStyle: 'dotted',
        borderRadius: 'lg',
      },
      {
        ...createShape('hexagon', 0, 0),
        id: 'hex',
        x: r.x + 400,
        y: r.y + 100,
        strokeStyle: 'dashed',
      },
      {
        ...createShape('square', 0, 0),
        id: 'shadowed',
        x: r.x + 700,
        y: r.y + 100,
        shadow: { offsetX: 2, offsetY: 4, blur: 8, opacity: 0.3 },
      },
      {
        ...createShape('square', 0, 0),
        id: 'iconed',
        x: r.x + 900,
        y: r.y + 100,
        iconId: 'server',
      },
      {
        ...createShape('square', 0, 0),
        id: 'sketch',
        x: r.x + 1100,
        y: r.y + 100,
        finish: 'sketch',
      },
      {
        ...createShape('square', 0, 0),
        id: 'odd',
        x: r.x + 1300,
        y: r.y + 100,
        fillColor: 'hsl(10 50% 50%)',
      },
      {
        ...createShape('square', 0, 0),
        id: 'clear',
        x: r.x + 1500,
        y: r.y + 100,
        fillColor: 'transparent',
        strokeColor: 'none',
      },
    ]);
    const drawer = fakeDrawer();
    const built = await buildDeck({ tab, pages, title: 'T' }, drawer, {});
    const [rounded, hex, shadowed, iconed, sketch, odd, clear] = built.slides[0]!.items;
    if (rounded?.kind !== 'shape' || hex?.kind !== 'shape' || clear?.kind !== 'shape')
      throw new Error('not native');
    expect(rounded.geometry).toBe('roundRect');
    expect(rounded.adjust).toBeGreaterThan(0);
    expect(rounded.fill).toEqual({ hex: 'FDE68A', alpha: 1 });
    expect(rounded.line).toMatchObject({ colour: { hex: '2563EB' }, dash: 'sysDot' });
    expect(hex.geometry).toBe('custom');
    expect(hex.outline?.match(/L/g)).toHaveLength(5);
    expect(hex.line?.dash).toBe('dash');
    expect(clear.fill).toBeNull();
    expect(clear.line).toBeNull();
    for (const item of [shadowed, iconed, sketch, odd]) expect(item?.kind).toBe('picture');
    expect(drawer.regions.map((r) => r.ids[0])).toEqual(['shadowed', 'iconed', 'sketch', 'odd']);
    const xml = new TextDecoder().decode(writePptx(built));
    expect(xml).toContain('<a:custGeom>');
    expect(xml).toContain('prst="roundRect"');
  });

  it('paints a solid page as the slide colour and anything else as a background picture', async () => {
    const pages = [
      newSlidePage('plain'),
      {
        ...newSlidePage('solid'),
        background: { fill: { kind: 'solid' as const, color: '#0f172a' } },
      },
      {
        ...newSlidePage('grad'),
        background: {
          fill: { kind: 'gradient' as const, from: '#000000', to: '#ffffff', angle: 90 },
        },
      },
      { ...newSlidePage('dots'), background: { pattern: 'dots' as const } },
    ];
    const laid = layOutPages(pages);
    expect(laid.map(backgroundKind)).toEqual(['none', 'solid', 'picture', 'picture']);
    const tab: Tab = { id: 't', name: 'T', elements: [], pages, templateChosen: true };
    const drawer = fakeDrawer();
    const built = await buildDeck({ tab, pages: laid, title: 'T' }, drawer, {});
    expect(built.slides.map((s) => s.background?.kind ?? null)).toEqual([
      null,
      'solid',
      'picture',
      'picture',
    ]);
    expect(drawer.backgrounds).toEqual(['grad', 'dots']);
    const parts = await everyPart(writePptx(built));
    expect(parts.get('ppt/slides/slide2.xml')).toContain(
      '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="0F172A">',
    );
    expect(parts.get('ppt/slides/_rels/slide3.xml.rels')).toContain('../media/image1.png');
  });

  it('fits a page of another shape inside the deck’s slide, centred', () => {
    const [wide, classic] = layOutPages([newSlidePage('a'), newSlidePage('b', 'slide-classic')]);
    expect(deckSize([wide!])).toEqual({ cx: 12_192_000, cy: 6_858_000 });
    expect(deckSize([classic!])).toEqual({ cx: 9_144_000, cy: 6_858_000 });
    const place = placementFor(classic!, 12_192_000, 6_858_000);
    expect(place.emuPerPx).toBe(6350);
    expect(place.ox + classic!.rect.x * place.emuPerPx).toBe((12_192_000 - 9_144_000) / 2);
    expect(deckSize([])).toEqual({ cx: 12_192_000, cy: 6_858_000 });
  });

  it('cuts a picture to the page and leaves out one wholly off it', () => {
    const page = { x: 0, y: 0, width: 100, height: 100 };
    expect(cutTo({ x: -10.5, y: 50.2, width: 40, height: 80 }, page)).toEqual({
      x: 0,
      y: 50,
      width: 30,
      height: 50,
    });
    expect(cutTo({ x: 200, y: 0, width: 10, height: 10 }, page)).toBeNull();
  });

  it('stops when cancelled', async () => {
    const { tab, pages } = everyKindDeck();
    const controller = new AbortController();
    controller.abort();
    await expect(
      buildDeck({ tab, pages, title: 'T' }, fakeDrawer(), { signal: controller.signal }),
    ).rejects.toThrow('cancelled');
  });

  it('writes every slide’s notes as their own lines, in a notes slide that names its slide', async () => {
    const xml = new TextDecoder().decode(
      writePptx({
        title: 'A & B',
        cx: 12_192_000,
        cy: 6_858_000,
        slides: [
          {
            background: null,
            items: [
              {
                kind: 'picture',
                name: 'P',
                box: { x: 0, y: 0, cx: 10, cy: 10 },
                png: ONE_PIXEL_PNG,
              },
            ],
            notes: 'One\n\nThree <b>',
          },
        ],
      }),
    );
    expect(xml).toContain('<dc:title>A &amp; B</dc:title>');
    expect(xml).toContain('<a:t>Three &lt;b&gt;</a:t>');
    expect(xml).toContain('../notesSlides/notesSlide1.xml');
  });
});
