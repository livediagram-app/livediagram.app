import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractExcalidrawScene } from './excalidraw-embedded';

const SCENE = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [{ id: 'a', type: 'text', text: 'Grüße ✓' }],
  files: {},
});

// Excalidraw's encoding (packages/excalidraw/data/encode.ts), rebuilt here so the
// fixtures are exactly what its exporter writes.
const toByteString = (bytes: Uint8Array) => String.fromCharCode(...bytes);
const utf8 = (s: string) => new TextEncoder().encode(s);

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function wrapper(text: string, compressed: boolean): Promise<string> {
  const encoded = compressed ? toByteString(await deflate(utf8(text))) : toByteString(utf8(text));
  return JSON.stringify({ version: '1', encoding: 'bstring', compressed, encoded });
}

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(latin1(type), 4);
  out.set(data, 8);
  // CRC is not checked by the reader; zeros keep the fixture simple.
  return out;
}

function png(chunks: Uint8Array[]): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = chunk('IHDR', new Uint8Array(13));
  const iend = chunk('IEND', new Uint8Array(0));
  const parts = [new Uint8Array(sig), ihdr, ...chunks, iend];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const tEXt = (keyword: string, text: string) =>
  chunk('tEXt', new Uint8Array([...latin1(keyword), 0, ...latin1(text)]));

const KEYWORD = 'application/vnd.excalidraw+json';

function svg(payload: string, version?: number) {
  return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><!-- svg-source:excalidraw --><metadata><!-- payload-type:application/vnd.excalidraw+json -->${
    version ? `<!-- payload-version:${version} -->` : ''
  }<!-- payload-start -->${payload}<!-- payload-end --></metadata><rect/></svg>`;
}

describe('extractExcalidrawScene', () => {
  describe('PNG', () => {
    it('reads a compressed embedded scene', async () => {
      const file = png([tEXt('Software', 'x'), tEXt(KEYWORD, await wrapper(SCENE, true))]);
      expect(await extractExcalidrawScene(file)).toEqual({
        ok: true,
        text: SCENE,
        container: 'png',
      });
    });

    it('reads an uncompressed embedded scene', async () => {
      const file = png([tEXt(KEYWORD, await wrapper(SCENE, false))]);
      expect(await extractExcalidrawScene(file)).toEqual({
        ok: true,
        text: SCENE,
        container: 'png',
      });
    });

    it('reads the oldest un-encoded scene JSON', async () => {
      const ascii = JSON.stringify({ type: 'excalidraw', elements: [] });
      const file = png([tEXt(KEYWORD, ascii)]);
      expect(await extractExcalidrawScene(file)).toEqual({
        ok: true,
        text: ascii,
        container: 'png',
      });
    });

    it('says so when the PNG carries no scene', async () => {
      const r = await extractExcalidrawScene(png([tEXt('Software', 'x')]));
      expect(r).toEqual({
        ok: false,
        error:
          "This image doesn't contain an Excalidraw scene. In Excalidraw, export it with Embed scene switched on.",
      });
    });

    it('reports a corrupt payload', async () => {
      const bad = JSON.stringify({
        version: '1',
        encoding: 'bstring',
        compressed: true,
        encoded: 'zz',
      });
      const r = await extractExcalidrawScene(png([tEXt(KEYWORD, bad)]));
      expect(r).toEqual({
        ok: false,
        error: "The Excalidraw scene inside this image couldn't be read.",
      });
    });

    it('reports a truncated file', async () => {
      const file = png([tEXt(KEYWORD, await wrapper(SCENE, true))]);
      const r = await extractExcalidrawScene(file.subarray(0, 40));
      expect(r.ok).toBe(false);
    });

    it('reports an unknown encoding', async () => {
      const bad = JSON.stringify({ encoding: 'rot13', compressed: false, encoded: 'x' });
      expect((await extractExcalidrawScene(png([tEXt(KEYWORD, bad)]))).ok).toBe(false);
    });
  });

  describe('SVG', () => {
    it('reads a version 2 payload (a base64 byte string)', async () => {
      const payload = btoa(await wrapper(SCENE, true));
      expect(await extractExcalidrawScene(svg(payload, 2))).toEqual({
        ok: true,
        text: SCENE,
        container: 'svg',
      });
    });

    it('reads a version 1 payload (base64 UTF-8 JSON)', async () => {
      const json = await wrapper(SCENE, false);
      const payload = btoa(toByteString(utf8(json)));
      expect(await extractExcalidrawScene(svg(payload))).toEqual({
        ok: true,
        text: SCENE,
        container: 'svg',
      });
    });

    it('reads SVG given as bytes, as a picked file is', async () => {
      const payload = btoa(await wrapper(SCENE, true));
      expect(await extractExcalidrawScene(utf8(svg(payload, 2)))).toMatchObject({
        ok: true,
        container: 'svg',
      });
    });

    it('says so when an SVG is not an Excalidraw export', async () => {
      const r = await extractExcalidrawScene('<?xml version="1.0"?>\n<svg xmlns="x"><rect/></svg>');
      expect(r.ok === false && r.error).toMatch(/doesn't contain an Excalidraw scene/);
    });

    it('reports a payload marker without a payload', async () => {
      const r = await extractExcalidrawScene(
        '<svg><!-- payload-type:application/vnd.excalidraw+json --></svg>',
      );
      expect(r.ok === false && r.error).toMatch(/couldn't be read/);
    });

    it('reports broken base64', async () => {
      expect((await extractExcalidrawScene(svg('@@@not base64@@@', 2))).ok).toBe(false);
    });
  });

  it('passes plain scene JSON straight through', async () => {
    expect(await extractExcalidrawScene(`  ${SCENE}`)).toEqual({
      ok: true,
      text: `  ${SCENE}`,
      container: 'json',
    });
    expect(await extractExcalidrawScene(utf8(SCENE))).toEqual({
      ok: true,
      text: SCENE,
      container: 'json',
    });
  });
});

// Real exports from excalidraw.com ("Embed scene" on), a text and a rectangle;
// provenance in docs/specs/020-import-export/blueprints/excalidraw-import.md.
describe('real Excalidraw exports', () => {
  const fixture = (name: string) =>
    new Uint8Array(readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url))));

  it.each([
    ['excalidraw-export.excalidraw.png', 'png'],
    ['excalidraw-export.excalidraw.svg', 'svg'],
  ] as const)('reads the scene inside %s', async (name, container) => {
    const r = await extractExcalidrawScene(fixture(name));
    if (!r.ok) throw new Error(r.error);
    expect(r.container).toBe(container);
    const scene = JSON.parse(r.text) as {
      type: string;
      elements: { type: string; text?: string }[];
    };
    expect(scene.type).toBe('excalidraw');
    expect(scene.elements.map((e) => e.type).sort()).toEqual(['rectangle', 'text']);
    expect(scene.elements.find((e) => e.type === 'text')?.text).toBe('Imported from Excalidraw');
  });
});
