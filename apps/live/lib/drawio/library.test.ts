// @vitest-environment jsdom
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { cpuMsOfAsync } from '@livediagram/vitest-config/cpu-time';
import { contentBounds, type ArrowElement, type ShapeElement } from '@livediagram/document';
import { importDrawio } from './import';
import { importDrawioLibrary } from './library';
import { PIXEL_PNG } from './library-test-support';

// docs/specs/020-import-export/drawio-import.md "Shape libraries": an <mxlibrary> is a list of
// reusable shapes, each a compressed mxGraphModel snippet. Libraries synthesised here.

const compress = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
const snippet = (cells: string) =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
const box = (id: string, label: string, x: number, y: number) =>
  `<mxCell id="${id}" value="${label}" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="120" height="60" as="geometry"/></mxCell>`;
const library = (items: object[]) => `<mxlibrary>${JSON.stringify(items)}</mxlibrary>`;
const text = (t: string) => ({ kind: 'text' as const, text: t });

describe('importDrawioLibrary', () => {
  it('reads every item into its own elements, from (0, 0), in library order', async () => {
    const r = await importDrawioLibrary(
      text(
        library([
          {
            xml: compress(snippet(box('a', 'Service', 200, 300))),
            w: 120,
            h: 60,
            aspect: 'fixed',
            title: 'Service',
          },
          {
            xml: compress(
              snippet(
                box('a', 'From', 40, 40) +
                  box('b', 'To', 240, 40) +
                  '<mxCell id="e" edge="1" parent="1" source="a" target="b" style="endArrow=classic;"><mxGeometry relative="1" as="geometry"/></mxCell>',
              ),
            ),
            w: 320,
            h: 60,
            title: '',
          },
        ]),
      ),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.items.map((i) => i.title)).toEqual(['Service', '']);
    // An item's size is its content as converted (the page scale included), never draw.io's w / h.
    for (const item of r.items) {
      const bounds = contentBounds(item.elements);
      expect([item.width, item.height]).toEqual([bounds.w, bounds.h]);
    }
    expect(r.items[0]!.width).toBeGreaterThan(120);
    const [one, pair] = r.items;
    expect((one!.elements[0] as ShapeElement).label).toBe('Service');
    expect(contentBounds(one!.elements)).toMatchObject({ x: 0, y: 0 });
    const arrow = pair!.elements.find((e): e is ArrowElement => e.type === 'arrow')!;
    const ids = new Set(pair!.elements.filter((e) => e.type === 'shape').map((e) => e.id));
    expect(arrow.from.kind === 'pinned' && ids.has(arrow.from.elementId)).toBe(true);
    expect(arrow.to.kind === 'pinned' && ids.has(arrow.to.elementId)).toBe(true);
    expect(r.report.notes).toEqual([]);
  });

  it('reads an uncompressed item as well', async () => {
    const r = await importDrawioLibrary(
      text(library([{ xml: snippet(box('a', 'Plain', 0, 0)), w: 120, h: 60, title: 'Plain' }])),
    );
    expect(r.ok && r.items.length).toBe(1);
  });

  it('makes an image item an image, its picture an image request', async () => {
    const r = await importDrawioLibrary(
      text(library([{ data: PIXEL_PNG, w: 32, h: 32, title: 'Logo' }])),
    );
    if (!r.ok) throw new Error(r.error);
    const [image] = r.items[0]!.elements;
    expect(image).toMatchObject({
      type: 'image',
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      imageId: null,
    });
    expect(r.images).toEqual([
      expect.objectContaining({
        elementId: image!.id,
        source: { kind: 'data-url', dataUrl: PIXEL_PNG },
      }),
    ]);
  });

  it('leaves out an item it cannot read, and counts it', async () => {
    const r = await importDrawioLibrary(
      text(
        library([
          { xml: '!!!not base64', w: 10, h: 10, title: 'Broken' },
          { xml: compress(snippet(box('a', 'Fine', 0, 0))), w: 120, h: 60, title: 'Fine' },
        ]),
      ),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.items.map((i) => i.title)).toEqual(['Fine']);
    expect(r.report.notes).toEqual([{ kind: 'library-item-unreadable', count: 1 }]);
  });

  it('refuses a library none of whose items can be read, and one that is not a library', async () => {
    expect(
      await importDrawioLibrary(text(library([{ xml: '!!!', w: 1, h: 1, title: 'x' }]))),
    ).toMatchObject({ ok: false, error: "None of this library's shapes could be read." });
    expect(await importDrawioLibrary(text('<mxlibrary>not json</mxlibrary>'))).toMatchObject({
      ok: false,
    });
    expect(await importDrawioLibrary(text('<mxfile/>'))).toMatchObject({ ok: false });
  });

  it('is refused by the tab import, which points to the Explorer', async () => {
    const r = await importDrawio(text(library([])), { tabIdForPage: () => 't' });
    expect(r).toEqual({
      ok: false,
      error:
        'This is a draw.io shape library. Import it with Import from draw.io on the Explorer page to add it to My shapes.',
    });
  });
});

describe('importDrawioLibrary on hostile text', () => {
  it.each([
    ['leading whitespace with no library', ' '.repeat(200_000) + 'x'],
    ['an unclosed library of spaces', '<mxlibrary>' + ' '.repeat(200_000)],
    ['many closing tags', '<mxlibrary>' + '</mxlibrary> x'.repeat(20_000)],
  ])('refuses %s in linear time', async (_, text) => {
    let read: Awaited<ReturnType<typeof importDrawioLibrary>> | undefined;
    const spent = await cpuMsOfAsync(async () => {
      read = await importDrawioLibrary({ kind: 'text', text });
    });
    expect(read).toMatchObject({ ok: false });
    expect(spent).toBeLessThan(50);
  });

  it('reads a library after a BOM and whitespace, with whitespace after it', async () => {
    const r = await importDrawioLibrary({
      kind: 'text',
      text: `\uFEFF  \n<mxlibrary title="x">[]</mxlibrary>\n  `,
    });
    // An empty list is a library with nothing readable: refused as empty, not as "not a library".
    expect(r).toEqual({ ok: false, error: "None of this library's shapes could be read." });
  });
});
