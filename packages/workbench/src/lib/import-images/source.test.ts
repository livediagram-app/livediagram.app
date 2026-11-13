import { describe, expect, it } from 'vitest';
import { readImportImageSource } from './source';
import { IMPORT_IMAGE_MAX_SOURCE_BYTES } from './constants';

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2];
const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

describe('readImportImageSource', () => {
  it('decodes a base64 data URL and sniffs its real type', async () => {
    const out = await readImportImageSource({
      kind: 'data-url',
      // Declared wrongly on purpose: the bytes win.
      dataUrl: `data:image/jpeg;base64,${b64(PNG_BYTES)}`,
    });
    expect(out).toEqual({ ok: true, bytes: new Uint8Array(PNG_BYTES), mimeType: 'image/png' });
  });

  it('tolerates whitespace inside a base64 payload', async () => {
    const payload = b64(PNG_BYTES);
    const out = await readImportImageSource({
      kind: 'data-url',
      dataUrl: `data:image/png;base64,${payload.slice(0, 6)}\n  ${payload.slice(6)}`,
    });
    expect(out.ok && out.bytes).toEqual(new Uint8Array(PNG_BYTES));
  });

  it('decodes a percent-encoded SVG data URL', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
    const out = await readImportImageSource({
      kind: 'data-url',
      dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    });
    expect(out.ok && out.mimeType).toBe('image/svg+xml');
    expect(out.ok && new TextDecoder().decode(out.bytes)).toBe(svg);
  });

  it('recognises SVG bytes without a declared type', async () => {
    const svg = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const out = await readImportImageSource({
      kind: 'blob',
      blob: new Blob([svg]),
    });
    expect(out.ok && out.mimeType).toBe('image/svg+xml');
  });

  it('falls back to the declared type for bytes it cannot sniff', async () => {
    const out = await readImportImageSource({
      kind: 'blob',
      blob: new Blob([new Uint8Array([0x42, 0x4d, 1, 2, 3])], { type: 'image/bmp' }),
    });
    expect(out.ok && out.mimeType).toBe('image/bmp');
  });

  it('labels unknown undeclared bytes as octet-stream', async () => {
    const out = await readImportImageSource({
      kind: 'blob',
      blob: new Blob([new Uint8Array([1])]),
    });
    expect(out.ok && out.mimeType).toBe('application/octet-stream');
  });

  it('refuses a string that is not a data URL', async () => {
    expect(await readImportImageSource({ kind: 'data-url', dataUrl: 'https://x/y.png' })).toEqual({
      ok: false,
      failure: 'unsupported',
    });
  });

  it('refuses broken base64', async () => {
    expect(
      await readImportImageSource({ kind: 'data-url', dataUrl: 'data:image/png;base64,@@@' }),
    ).toEqual({ ok: false, failure: 'unsupported' });
  });

  it('refuses a broken percent-encoding', async () => {
    expect(
      await readImportImageSource({ kind: 'data-url', dataUrl: 'data:image/svg+xml,%E0%A4%A' }),
    ).toEqual({ ok: false, failure: 'unsupported' });
  });

  it('treats an empty payload as missing bytes', async () => {
    expect(
      await readImportImageSource({ kind: 'data-url', dataUrl: 'data:image/png;base64,' }),
    ).toEqual({
      ok: false,
      failure: 'missing-bytes',
    });
    expect(await readImportImageSource({ kind: 'blob', blob: new Blob([]) })).toEqual({
      ok: false,
      failure: 'missing-bytes',
    });
  });

  it('refuses a data URL over the source cap before decoding it', async () => {
    const huge = 'A'.repeat(Math.ceil((IMPORT_IMAGE_MAX_SOURCE_BYTES * 4) / 3) + 8);
    expect(
      await readImportImageSource({ kind: 'data-url', dataUrl: `data:image/png;base64,${huge}` }),
    ).toEqual({ ok: false, failure: 'too-large' });
  });

  it('refuses a blob over the source cap without reading it', async () => {
    const blob = { size: IMPORT_IMAGE_MAX_SOURCE_BYTES + 1, type: 'image/png' } as Blob;
    expect(await readImportImageSource({ kind: 'blob', blob })).toEqual({
      ok: false,
      failure: 'too-large',
    });
  });
});
