// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readDrawioPages } from './envelope';
import { ByteBudget } from './inflate';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name));
const text = (t: string) => ({ kind: 'text' as const, text: t });
const bytes = (b: Uint8Array) => ({ kind: 'bytes' as const, bytes: new Uint8Array(b) });
const budget = () => new ByteBudget(10_000_000);
const cellCount = (model: Element | null) => model?.getElementsByTagName('mxCell').length ?? 0;

describe('readDrawioPages', () => {
  it('reads an uncompressed mxfile', async () => {
    const pages = await readDrawioPages(text(fixture('flowchart.drawio').toString()), budget());
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ id: 'flow-page-1', name: 'Order flow' });
    expect(pages[0]!.model?.localName).toBe('mxGraphModel');
    expect(cellCount(pages[0]!.model)).toBeGreaterThan(10);
  });

  it('reads compressed pages to the same models', async () => {
    const plain = await readDrawioPages(text(fixture('multi-page.drawio').toString()), budget());
    const packed = await readDrawioPages(bytes(fixture('multi-page.compressed.drawio')), budget());
    expect(packed.map((p) => p.name)).toEqual(['Overview', 'Detail', 'Scratch']);
    expect(packed.map((p) => cellCount(p.model))).toEqual(plain.map((p) => cellCount(p.model)));
  });

  it('reads a bare mxGraphModel as one unnamed page', async () => {
    const pages = await readDrawioPages(bytes(fixture('flowchart.mxgraphmodel.xml')), budget());
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ id: 'page-1', name: '' });
  });

  it('reads the mxfile inside a .drawio.svg', async () => {
    const pages = await readDrawioPages(bytes(fixture('cloud-architecture.drawio.svg')), budget());
    expect(pages[0]!.name).toBe('Architecture');
    expect(cellCount(pages[0]!.model)).toBeGreaterThan(10);
  });

  it('reads a base64 content attribute on an SVG', async () => {
    const mxfile = fixture('flowchart.drawio').toString();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" content="${btoa(unescape(encodeURIComponent(mxfile)))}"/>`;
    const pages = await readDrawioPages(text(svg), budget());
    expect(pages[0]!.name).toBe('Order flow');
  });

  it('reads the tEXt and zTXt forms of a .drawio.png', async () => {
    const flow = await readDrawioPages(bytes(fixture('flowchart.drawio.png')), budget());
    expect(flow[0]!.name).toBe('Order flow');
    const lanes = await readDrawioPages(bytes(fixture('swimlanes.drawio.png')), budget());
    expect(lanes[0]!.name).toBe('Hiring process');
  });

  it('numbers pages without ids and treats an empty diagram as an empty page', async () => {
    const pages = await readDrawioPages(
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
    expect(await refusal(readDrawioPages(text('   '), budget()))).toBe('not-xml');
    expect(await refusal(readDrawioPages(text('{"type":"excalidraw"}'), budget()))).toBe('not-xml');
    expect(await refusal(readDrawioPages(text('<mxfile><diagram>'), budget()))).toBe('not-xml');
    expect(await refusal(readDrawioPages(text('<html/>'), budget()))).toBe('not-drawio');
    expect(await refusal(readDrawioPages(text('<mxfile/>'), budget()))).toBe('no-pages');
    expect(await refusal(readDrawioPages(bytes(fixture('no-diagram.png')), budget()))).toBe(
      'png-without-diagram',
    );
    expect(
      await refusal(readDrawioPages(text('<svg xmlns="http://www.w3.org/2000/svg"/>'), budget())),
    ).toBe('svg-without-diagram');
    expect(await refusal(readDrawioPages(text('<svg content="bm90IHhtbA=="/>'), budget()))).toBe(
      'svg-without-diagram',
    );
  });

  it('names the page it could not decode', async () => {
    const error = await readDrawioPages(
      text('<mxfile><diagram name="Network">!!!notbase64</diagram></mxfile>'),
      budget(),
    ).catch((e) => e);
    expect(error).toMatchObject({ reason: 'page-unreadable', detail: 'Network' });
  });

  it('refuses a decompressed page that is not a model', async () => {
    const payload = deflateRawSync(Buffer.from(encodeURIComponent('<nope/>'))).toString('base64');
    const error = await readDrawioPages(
      text(`<mxfile><diagram>${payload}</diagram></mxfile>`),
      budget(),
    ).catch((e) => e);
    expect(error).toMatchObject({ reason: 'page-unreadable', detail: 'Page 1' });
  });

  it('refuses a page that inflates beyond the budget as too large', async () => {
    const payload = deflateRawSync(
      Buffer.from(encodeURIComponent(`<mxGraphModel>${'x'.repeat(10_000)}</mxGraphModel>`)),
    ).toString('base64');
    const error = await readDrawioPages(
      text(`<mxfile><diagram>${payload}</diagram></mxfile>`),
      new ByteBudget(1_000),
    ).catch((e) => e);
    expect(error).toMatchObject({ reason: 'too-large' });
  });
});
