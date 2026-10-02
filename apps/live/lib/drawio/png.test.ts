import { crc32, deflateRawSync, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ByteBudget } from './inflate';
import { extractPngDiagram, isPng } from './png';

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = (...chunks: Buffer[]) =>
  new Uint8Array(
    Buffer.concat([
      SIGNATURE,
      chunk('IHDR', Buffer.alloc(13)),
      ...chunks,
      chunk('IDAT', Buffer.alloc(2)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
const text = (keyword: string, value: string) =>
  chunk('tEXt', Buffer.from(`${keyword}\0${value}`, 'latin1'));
const budget = () => new ByteBudget(1_000_000);
const XML = '<mxfile><diagram name="P"/></mxfile>';

describe('isPng', () => {
  it('recognises the signature', () => {
    expect(isPng(png())).toBe(true);
    expect(isPng(new TextEncoder().encode('<mxfile/>'))).toBe(false);
  });
});

describe('extractPngDiagram', () => {
  it('reads a URI-encoded tEXt chunk keyed mxfile', async () => {
    expect(await extractPngDiagram(png(text('mxfile', encodeURIComponent(XML))), budget())).toBe(
      XML,
    );
  });

  it('reads a tEXt chunk keyed mxGraphModel', async () => {
    const model = '<mxGraphModel/>';
    expect(await extractPngDiagram(png(text('mxGraphModel', model)), budget())).toBe(model);
  });

  it('decodes a double-encoded value', async () => {
    const twice = encodeURIComponent(encodeURIComponent(XML));
    expect(await extractPngDiagram(png(text('mxfile', twice)), budget())).toBe(XML);
  });

  it('inflates a zlib zTXt chunk and undoes Java plus-encoding', async () => {
    const payload = encodeURIComponent(XML).replace(/%20/g, '+');
    const z = chunk(
      'zTXt',
      Buffer.concat([Buffer.from('mxfile\0\0', 'latin1'), deflateSync(Buffer.from(payload))]),
    );
    expect(await extractPngDiagram(png(z), budget())).toBe(XML);
  });

  it('falls back to a raw deflate zTXt stream', async () => {
    const z = chunk(
      'zTXt',
      Buffer.concat([
        Buffer.from('mxfile\0\0', 'latin1'),
        deflateRawSync(Buffer.from(encodeURIComponent(XML))),
      ]),
    );
    expect(await extractPngDiagram(png(z), budget())).toBe(XML);
  });

  it('reads an iTXt chunk, compressed or not', async () => {
    const plain = chunk(
      'iTXt',
      Buffer.concat([Buffer.from('mxfile\0\0\0\0\0', 'latin1'), Buffer.from(XML, 'utf8')]),
    );
    expect(await extractPngDiagram(png(plain), budget())).toBe(XML);
    const packed = chunk(
      'iTXt',
      Buffer.concat([
        Buffer.from('mxfile\0\u0001\0\0\0', 'latin1'),
        deflateSync(Buffer.from(XML, 'utf8')),
      ]),
    );
    expect(await extractPngDiagram(png(packed), budget())).toBe(XML);
  });

  it('ignores other text chunks and returns null without a diagram', async () => {
    expect(await extractPngDiagram(png(text('Software', 'x')), budget())).toBeNull();
    expect(await extractPngDiagram(png(), budget())).toBeNull();
  });

  it('stops at a chunk running past the end', async () => {
    const bytes = png(text('mxfile', 'x'));
    expect(await extractPngDiagram(bytes.slice(0, 40), budget())).toBeNull();
  });

  it('returns null for bytes that are not a PNG', async () => {
    expect(await extractPngDiagram(new Uint8Array([1, 2, 3]), budget())).toBeNull();
  });
});
