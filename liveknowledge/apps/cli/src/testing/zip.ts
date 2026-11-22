// A zip file in memory for the suites: each file stored or deflated, with the flags and method a test asks for.
// Not a `.test.ts` file, so vitest collects no suite from it.
import { deflateRawSync } from 'node:zlib';

export function zipOf(
  files: Record<string, string>,
  options: { deflate?: boolean; flags?: number; method?: number } = {},
): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = encoder.encode(text);
    const packed = options.deflate ? new Uint8Array(deflateRawSync(data)) : data;
    const method = options.method ?? (options.deflate ? 8 : 0);
    const nameBytes = encoder.encode(name);
    const local = new Uint8Array(30 + nameBytes.length + packed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(6, options.flags ?? 0, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, packed.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(packed, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(8, options.flags ?? 0, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, packed.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const directory = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, directory, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + directory + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
