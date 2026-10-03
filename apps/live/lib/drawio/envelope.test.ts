// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { readDrawioSource, sniffDrawio } from './envelope';
import { ByteBudget } from './inflate';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name));
const text = (t: string) => ({ kind: 'text' as const, text: t });
const bytes = (b: Uint8Array) => ({ kind: 'bytes' as const, bytes: new Uint8Array(b) });
const budget = () => new ByteBudget(10_000_000);
const cellCount = (model: Element | null) => model?.getElementsByTagName('mxCell').length ?? 0;

describe('readDrawioSource', () => {
  it('reads an uncompressed mxfile', async () => {
    const { pages } = await readDrawioSource(
      text(fixture('flowchart.drawio').toString()),
      budget(),
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ id: 'flow-page-1', name: 'Order flow' });
    expect(pages[0]!.model?.localName).toBe('mxGraphModel');
    expect(cellCount(pages[0]!.model)).toBeGreaterThan(10);
  });

  it('reads compressed pages to the same models', async () => {
    const { pages: plain } = await readDrawioSource(
      text(fixture('multi-page.drawio').toString()),
      budget(),
    );
    const { pages: packed } = await readDrawioSource(
      bytes(fixture('multi-page.compressed.drawio')),
      budget(),
    );
    expect(packed.map((p) => p.name)).toEqual(['Overview', 'Detail', 'Scratch']);
    expect(packed.map((p) => cellCount(p.model))).toEqual(plain.map((p) => cellCount(p.model)));
  });

  it('reads a bare mxGraphModel as one unnamed page', async () => {
    const { pages } = await readDrawioSource(
      bytes(fixture('flowchart.mxgraphmodel.xml')),
      budget(),
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ id: 'page-1', name: '' });
  });

  it('reads the mxfile inside a .drawio.svg', async () => {
    const { pages } = await readDrawioSource(
      bytes(fixture('cloud-architecture.drawio.svg')),
      budget(),
    );
    expect(pages[0]!.name).toBe('Architecture');
    expect(cellCount(pages[0]!.model)).toBeGreaterThan(10);
  });

  it('reads a base64 content attribute on an SVG', async () => {
    const mxfile = fixture('flowchart.drawio').toString();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" content="${btoa(unescape(encodeURIComponent(mxfile)))}"/>`;
    const { pages } = await readDrawioSource(text(svg), budget());
    expect(pages[0]!.name).toBe('Order flow');
  });

  it('reads the tEXt and zTXt forms of a .drawio.png', async () => {
    const { pages: flow } = await readDrawioSource(
      bytes(fixture('flowchart.drawio.png')),
      budget(),
    );
    expect(flow[0]!.name).toBe('Order flow');
    const { pages: lanes } = await readDrawioSource(
      bytes(fixture('swimlanes.drawio.png')),
      budget(),
    );
    expect(lanes[0]!.name).toBe('Hiring process');
  });

  it('numbers pages without ids and treats an empty diagram as an empty page', async () => {
    const { pages } = await readDrawioSource(
      text('<mxfile><diagram name="A"></diagram><diagram/></mxfile>'),
      budget(),
    );
    expect(pages.map((p) => [p.id, p.name, p.model])).toEqual([
      ['page-1', 'A', null],
      ['page-2', '', null],
    ]);
  });

  it('refuses what it cannot read, by name', async () => {
    const refusal = (p: Promise<unknown>) =>
      p.then(
        () => 'accepted',
        (e) => e.reason,
      );
    expect(await refusal(readDrawioSource(text('   '), budget()))).toBe('not-xml');
    expect(await refusal(readDrawioSource(text('{"type":"excalidraw"}'), budget()))).toBe(
      'not-xml',
    );
    expect(await refusal(readDrawioSource(text('<mxfile><diagram>'), budget()))).toBe('not-xml');
    expect(await refusal(readDrawioSource(text('<html/>'), budget()))).toBe('not-drawio');
    expect(await refusal(readDrawioSource(text('<mxfile/>'), budget()))).toBe('no-pages');
    expect(await refusal(readDrawioSource(bytes(fixture('no-diagram.png')), budget()))).toBe(
      'png-without-diagram',
    );
    expect(
      await refusal(readDrawioSource(text('<svg xmlns="http://www.w3.org/2000/svg"/>'), budget())),
    ).toBe('svg-without-diagram');
    expect(await refusal(readDrawioSource(text('<svg content="bm90IHhtbA=="/>'), budget()))).toBe(
      'svg-without-diagram',
    );
  });

  it('names the page it could not decode', async () => {
    const error = await readDrawioSource(
      text('<mxfile><diagram name="Network">!!!notbase64</diagram></mxfile>'),
      budget(),
    ).catch((e) => e);
    expect(error).toMatchObject({ reason: 'page-unreadable', detail: 'Network' });
  });

  it('refuses a decompressed page that is not a model', async () => {
    const payload = deflateRawSync(Buffer.from(encodeURIComponent('<nope/>'))).toString('base64');
    const error = await readDrawioSource(
      text(`<mxfile><diagram>${payload}</diagram></mxfile>`),
      budget(),
    ).catch((e) => e);
    expect(error).toMatchObject({ reason: 'page-unreadable', detail: 'Page 1' });
  });

  it('refuses a page that inflates beyond the budget as too large', async () => {
    const payload = deflateRawSync(
      Buffer.from(encodeURIComponent(`<mxGraphModel>${'x'.repeat(10_000)}</mxGraphModel>`)),
    ).toString('base64');
    const error = await readDrawioSource(
      text(`<mxfile><diagram>${payload}</diagram></mxfile>`),
      new ByteBudget(1_000),
    ).catch((e) => e);
    expect(error).toMatchObject({ reason: 'too-large' });
  });
});

describe('readDrawioSource meta', () => {
  it("keeps the mxfile's name and modified time", async () => {
    const { meta } = await readDrawioSource(
      text(
        '<mxfile host="app.diagrams.net" modified="2026-03-12T10:00:00.000Z" name="Roadmap"><diagram name="One"><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>',
      ),
      budget(),
    );
    expect(meta).toEqual({ name: 'Roadmap', modified: '2026-03-12T10:00:00.000Z' });
  });

  it('has none for a bare model', async () => {
    const { meta } = await readDrawioSource(bytes(fixture('flowchart.mxgraphmodel.xml')), budget());
    expect(meta).toEqual({});
  });
});

describe('sniffDrawio', () => {
  const t = (s: string) => ({ kind: 'text' as const, text: s });
  it.each([
    ['an mxfile', '<mxfile host="x"><diagram/></mxfile>'],
    ['an mxfile after a BOM and an XML declaration', '\uFEFF<?xml version="1.0"?>\n<mxfile/>'],
    ['a bare model', '  <mxGraphModel><root/></mxGraphModel>'],
    ['a draw.io SVG', '<svg xmlns="http://www.w3.org/2000/svg" content="&lt;mxfile&gt;"></svg>'],
    ['a JSON export', '{"version":"31.7.0","pages":[]}'],
  ])('calls %s a diagram', (_, s) => {
    expect(sniffDrawio(t(s))).toBe('diagram');
  });

  it('calls a JSON export a diagram when its pages lie beyond the sniffed head', () => {
    const data = '<mxfile>' + 'x'.repeat(8000) + '</mxfile>';
    expect(sniffDrawio(t(JSON.stringify({ version: '31.7.0', data, pages: [] })))).toBe('diagram');
    // Without draw.io's leading version, a head that never reaches `pages` is not taken.
    expect(sniffDrawio(t(JSON.stringify({ data, pages: [] })))).toBeNull();
  });

  it('calls an mxlibrary a library', () => {
    expect(sniffDrawio(t('<mxlibrary>[]</mxlibrary>'))).toBe('library');
  });

  it('calls a PNG a diagram candidate by its signature, whatever its name', () => {
    expect(sniffDrawio(bytes(fixture('flowchart.drawio.png')))).toBe('diagram');
  });

  it.each([
    ['plain text', 'hello'],
    ['an SVG without content', '<svg xmlns="http://www.w3.org/2000/svg"/>'],
    ['other JSON', '{"type":"excalidraw","elements":[]}'],
    ['other XML', '<html/>'],
    ['nothing', ''],
  ])('turns away %s', (_, s) => {
    expect(sniffDrawio(t(s))).toBeNull();
  });
});

describe('sniffDrawio on hostile heads', () => {
  const t = (s: string) => ({ kind: 'text' as const, text: s });
  it.each([
    ['an unclosed comment of dashes', '<!--' + '-'.repeat(50_000)],
    ['many unclosed comments', '<!--'.repeat(20_000)],
    ['an unclosed declaration', '<?xml' + ' a'.repeat(30_000)],
    ['a tag name that never ends', '<' + 'a'.repeat(60_000)],
  ])('reads %s in linear time', (_, head) => {
    let sniffed: ReturnType<typeof sniffDrawio> | undefined;
    const spent = cpuMsOf(() => {
      sniffed = sniffDrawio(t(head));
    });
    expect(sniffed).toBeNull();
    expect(spent).toBeLessThan(20);
  });

  it('skips a doctype and closed comments before the root', () => {
    expect(
      sniffDrawio(t('<?xml version="1.0"?><!DOCTYPE x><!-- a -- b --><!--c--> <mxfile/>')),
    ).toBe('diagram');
  });
});
