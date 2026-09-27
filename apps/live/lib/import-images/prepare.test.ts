import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES } from '@livediagram/api-schema';
import { prepareImportImage } from './prepare';
import { fakeCodec, fakeImageBlob } from './test-fakes';

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

describe('prepareImportImage', () => {
  it('encodes a large PNG to a 2048 WebP', async () => {
    const { codec, calls } = fakeCodec({ size: { width: 4096, height: 2048 } });
    const src = await bytesOf(fakeImageBlob('image/png', 5000));
    const out = await prepareImportImage(src, 'image/png', undefined, codec);
    expect(out).toMatchObject({ ok: true, mimeType: 'image/webp', width: 2048, height: 1024 });
    expect(calls.encode).toEqual([{ type: 'image/webp', width: 2048, height: 1024 }]);
    expect(calls.closed).toBe(1);
  });

  it('keeps a small PNG when the WebP would be larger', async () => {
    const { codec } = fakeCodec({ size: { width: 64, height: 64 }, encodedSize: () => 900 });
    const src = await bytesOf(fakeImageBlob('image/png', 400));
    const out = await prepareImportImage(src, 'image/png', undefined, codec);
    expect(out).toMatchObject({ ok: true, mimeType: 'image/png', width: 64, height: 64 });
    expect(out.ok && out.blob.size).toBe(400);
  });

  it('takes the WebP when it is smaller than a small PNG', async () => {
    const { codec } = fakeCodec({ size: { width: 800, height: 600 }, encodedSize: () => 300 });
    const src = await bytesOf(fakeImageBlob('image/png', 400));
    const out = await prepareImportImage(src, 'image/png', undefined, codec);
    expect(out).toMatchObject({ ok: true, mimeType: 'image/webp' });
  });

  it('keeps a fitting GIF untouched', async () => {
    const { codec, calls } = fakeCodec({ size: { width: 320, height: 240 } });
    const src = await bytesOf(fakeImageBlob('image/gif', 2000));
    const out = await prepareImportImage(src, 'image/gif', undefined, codec);
    expect(out).toMatchObject({ ok: true, mimeType: 'image/gif', width: 320, height: 240 });
    expect(calls.encode).toEqual([]);
  });

  it('falls back to PNG when the browser cannot encode WebP', async () => {
    const { codec, calls } = fakeCodec({
      size: { width: 3000, height: 3000 },
      encodable: ['image/png', 'image/jpeg'],
    });
    const src = await bytesOf(fakeImageBlob('image/png', 5000));
    const out = await prepareImportImage(src, 'image/png', undefined, codec);
    expect(out).toMatchObject({ ok: true, mimeType: 'image/png', width: 2048 });
    expect(calls.encode.map((c) => c.type)).toEqual(['image/webp', 'image/png']);
  });

  it('falls back to JPEG for a JPEG source', async () => {
    const { codec } = fakeCodec({ size: { width: 3000, height: 1500 }, encodable: ['image/jpeg'] });
    const src = await bytesOf(fakeImageBlob('image/jpeg', 5000));
    const out = await prepareImportImage(src, 'image/jpeg', undefined, codec);
    expect(out).toMatchObject({ ok: true, mimeType: 'image/jpeg' });
  });

  it('rasterises an SVG with the display hint', async () => {
    const { codec, calls } = fakeCodec({ size: { width: 0, height: 0 } });
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const out = await prepareImportImage(svg, 'image/svg+xml', { width: 300, height: 100 }, codec);
    expect(out).toMatchObject({ ok: true, mimeType: 'image/webp', width: 600, height: 200 });
    expect(calls.encode[0]).toEqual({ type: 'image/webp', width: 600, height: 200 });
  });

  it('reports bytes the browser cannot decode as unsupported', async () => {
    const { codec } = fakeCodec({ size: null });
    const out = await prepareImportImage(new Uint8Array([1, 2, 3]), 'image/heic', undefined, codec);
    expect(out).toEqual({ ok: false, failure: 'unsupported' });
  });

  it('reports a failed encode (a tainted canvas) as unsupported and still closes', async () => {
    const { codec, calls } = fakeCodec({ encodedSize: () => null });
    const src = await bytesOf(fakeImageBlob('image/png', 5000));
    const out = await prepareImportImage(src, 'image/bmp', undefined, codec);
    expect(out).toEqual({ ok: false, failure: 'unsupported' });
    expect(calls.closed).toBe(1);
  });

  it('reports a decoder that throws as unsupported', async () => {
    const { codec } = fakeCodec();
    codec.decode = async () => {
      throw new Error('boom');
    };
    const out = await prepareImportImage(new Uint8Array([1]), 'image/png', undefined, codec);
    expect(out).toEqual({ ok: false, failure: 'unsupported' });
  });

  it('refuses an encoded result over the per-file cap', async () => {
    const { codec } = fakeCodec({ encodedSize: () => MAX_IMAGE_BYTES + 1 });
    const src = await bytesOf(fakeImageBlob('image/png', 5000));
    const out = await prepareImportImage(src, 'image/bmp', undefined, codec);
    expect(out).toEqual({ ok: false, failure: 'too-large' });
  });

  it('refuses an encoded result that is not an accepted type', async () => {
    const { codec } = fakeCodec();
    codec.encode = async () => new Blob([new Uint8Array(20)], { type: 'image/webp' });
    const src = await bytesOf(fakeImageBlob('image/png', 5000));
    const out = await prepareImportImage(src, 'image/bmp', undefined, codec);
    expect(out).toEqual({ ok: false, failure: 'unsupported' });
  });
});
