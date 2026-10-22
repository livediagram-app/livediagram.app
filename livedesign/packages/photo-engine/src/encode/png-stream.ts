// A PNG encoder for pictures larger than a canvas may hold (docs/specs/031-photo/photo-pages.md
// "Exports and other views": an 8192 px photo is past Safari's canvas area): RGBA, 8 bits, written
// row band by row band and deflated with the platform's CompressionStream, so the whole picture is
// never one canvas.
import type { Raster } from '../raster/raster';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(parts: readonly Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts)
    for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array<ArrayBuffer> {
  const head = new Uint8Array(8);
  const view = new DataView(head.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) head[4 + i] = type.charCodeAt(i);
  const typeBytes = head.subarray(4, 8);
  const tail = new Uint8Array(4);
  new DataView(tail.buffer).setUint32(0, crc32([typeBytes, body]));
  const out = new Uint8Array(12 + body.length);
  out.set(head, 0);
  out.set(body, 8);
  out.set(tail, 8 + body.length);
  return out;
}

const SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads one band of rows (top-left at y, `rows` high) as straight RGBA. */
export type BandReader = (y: number, rows: number) => Raster | Promise<Raster>;

/** A PNG of a `width` x `height` picture read band by band. */
export async function encodePngStream(
  width: number,
  height: number,
  read: BandReader,
  band = 256,
): Promise<Blob> {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  const collected: Uint8Array[] = [];
  const reading = (async () => {
    const reader = cs.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      collected.push(value);
    }
  })();
  for (let y = 0; y < height; y += band) {
    const rows = Math.min(band, height - y);
    const r = await read(y, rows);
    const raw = new Uint8Array(rows * (width * 4 + 1));
    for (let j = 0; j < rows; j++) {
      // Filter type 1 (Sub): each byte less the one four before it, which deflates photos well.
      const o = j * (width * 4 + 1);
      raw[o] = 1;
      const row = j * width * 4;
      for (let i = 0; i < width * 4; i++)
        raw[o + 1 + i] = (r.data[row + i]! - (i >= 4 ? r.data[row + i - 4]! : 0)) & 255;
    }
    await writer.write(raw);
  }
  await writer.close();
  await reading;
  let total = 0;
  for (const c of collected) total += c.length;
  const idat = new Uint8Array(total);
  let at = 0;
  for (const c of collected) {
    idat.set(c, at);
    at += c.length;
  }
  return new Blob(
    [SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))],
    {
      type: 'image/png',
    },
  );
}
