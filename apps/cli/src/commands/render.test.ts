import { describe, expect, it } from 'vitest';
import { run } from '../main';
import { fakeIo, NOW, TOKEN, type FakeIo, type Route } from '../testing/fake-io';
import { svgSize } from '../render/png';

// `tab render`, `graph render` and `export --format png` (docs/specs/015-api/blueprints/cli.md "Previews", CLI30,
// CLI31): real PNGs from the shared renderer, on a fake host.

const DOC = 'aaaa1111-0000-4000-8000-000000000001';
const HOST = 'https://livediagram.app';
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#fff"/><text x="20" y="60">Web app</text></svg>';
const PNG = [0x89, 0x50, 0x4e, 0x47];

const host: Route = (_r, url) => {
  const path = url.pathname;
  if (path === '/api/capabilities')
    return Response.json({ apiBase: `${HOST}/api`, authEnabled: true, documentFormat: 2 });
  if (path === '/api/teams') return Response.json({ teams: [] });
  if (path === '/api/documents')
    return Response.json({ documents: [{ id: DOC, name: 'Shop', savedAt: NOW, ownerId: 'u' }] });
  if (path === `/api/documents/${DOC}`)
    return Response.json({
      document: {
        id: DOC,
        name: 'Shop',
        presentation: null,
        tabs: [{ id: 'main', name: 'Main', orderIndex: 0 }],
      },
    });
  if (path === `/api/documents/${DOC}/tabs/main/render.svg`) return new Response(SVG);
  if (path === `/api/documents/${DOC}/tabs/main`)
    return new Response(JSON.stringify({ tab: { id: 'main', name: 'Main', elements: [] } }), {
      headers: { ETag: 'W/"2"' },
    });
  return undefined;
};

async function cli(
  argv: string[],
  io: FakeIo = fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [host] }),
) {
  const code = await run(argv, io);
  return { code, io, out: io.out(), err: io.err() };
}

describe('tab render', () => {
  it('writes the tab as a PNG at scale 1, and as SVG as served', async () => {
    const png = await cli(['tab', 'render', DOC, '--png', 'shop.png']);
    expect(png.code).toBe(0);
    expect(png.out).toMatch(/^shop\.png {2}240×120 · \d+ KB\n$/);
    expect([...png.io.byteMap.get('shop.png')!.slice(0, 4)]).toEqual(PNG);
    const svg = await cli(['tab', 'render', DOC, '--svg', 'shop.svg']);
    expect(svg.out).toBe('shop.svg  240×120 · 1 KB\n');
    expect(svg.io.fileMap.get('shop.svg')!.data).toBe(SVG);
  });

  it('needs exactly one of --png and --svg', async () => {
    for (const argv of [
      ['tab', 'render', DOC],
      ['tab', 'render', DOC, '--png', 'a.png', '--svg', 'a.svg'],
    ]) {
      const { code, err } = await cli(argv);
      expect([code, err]).toEqual([
        2,
        expect.stringContaining('give --png <file> or --svg <file>, one of them'),
      ]);
    }
  });

  it('says which asset is missing beside the CLI', async () => {
    const io = fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [host] });
    io.readAsset = async (name) => {
      throw new Error(`ENOENT ${name}`);
    };
    const { code, err } = await cli(['tab', 'render', DOC, '--png', 'x.png'], io);
    expect([code, err]).toEqual([
      7,
      expect.stringMatching(/(resvg\.wasm|Inter-Regular\.ttf) is missing beside the CLI/),
    ]);
  });
});

describe('graph render', () => {
  it('draws a Mermaid file offline as the api would lay it out', async () => {
    const io = fakeIo({ files: { '/work/flow.mmd': 'flowchart LR\n  web[Web app] --> api[API]' } });
    const png = await cli(['graph', 'render', 'flow.mmd', '--png', 'flow.png'], io);
    expect(png.code).toBe(0);
    expect([...io.byteMap.get('flow.png')!.slice(0, 4)]).toEqual(PNG);
    await cli(['graph', 'render', 'flow.mmd', '--png', 'again.png'], io);
    expect(io.byteMap.has('again.png')).toBe(true);
    await cli(['graph', 'render', 'flow.mmd', '--svg', 'flow.svg'], io);
    const svg = io.fileMap.get('flow.svg')!.data;
    expect(svg).toContain('Web app');
    expect(io.requests).toEqual([]);
  });

  it('reads the graph from stdin', async () => {
    const io = fakeIo({ stdin: 'flowchart TD\n  a --> b' });
    const { code, out } = await cli(['graph', 'render', '-', '--svg', 'g.svg'], io);
    expect([code, out]).toEqual([0, expect.stringMatching(/^g\.svg {2}\d+×\d+ · 1 KB\n$/)]);
  });

  it('refuses a file that holds no graph', async () => {
    const io = fakeIo({ files: { '/work/notes.txt': 'hello' } });
    const { code, err } = await cli(['graph', 'render', 'notes.txt', '--svg', 'x.svg'], io);
    expect([code, err]).toEqual([
      1,
      expect.stringContaining('notes.txt holds no graph or Mermaid'),
    ]);
  });
});

describe('export --format png', () => {
  it('writes each tab as a PNG beside the other formats', async () => {
    const { code, out, io } = await cli(['export', '--all', '--to', 'b', '--format', 'png,md']);
    expect(code).toBe(0);
    expect(out.trim().split('\n')).toEqual([
      'b/shop/main.png',
      'b/shop/main.md',
      '1 document · 2 files',
    ]);
    expect([...io.byteMap.get('b/shop/main.png')!.slice(0, 4)]).toEqual(PNG);
  });
});

describe('svgSize', () => {
  it('reads the root size, and zero for what it lacks', () => {
    expect(svgSize('<svg width="10.6" height="20">')).toEqual({ width: 11, height: 20 });
    expect(svgSize('<g/>')).toEqual({ width: 0, height: 0 });
  });
});
