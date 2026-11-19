// A minimal Zip writer for tests (never shipped): stored and deflated entries. Node only. Parts are joined as
// byte arrays, never spread into an argument list, so a test can build a package of many megabytes.

import { crc32, deflateRawSync } from 'node:zlib';

type ZipInput = {
  name: string;
  data: Uint8Array | string;
  method?: 'stored' | 'deflate';
  encrypted?: boolean;
};

const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function writeZip(entries: ZipInput[]): Uint8Array<ArrayBuffer> {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let centralSize = 0;
  for (const entry of entries) {
    const raw = typeof entry.data === 'string' ? new TextEncoder().encode(entry.data) : entry.data;
    const deflate = entry.method === 'deflate';
    const body = deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const name = new TextEncoder().encode(entry.name);
    const flags = 0x0800 | (entry.encrypted ? 1 : 0);
    const method = deflate ? 8 : 0;
    const crc = crc32(raw);
    const common = [
      ...u16(20),
      ...u16(flags),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(body.length),
      ...u32(raw.length),
      ...u16(name.length),
    ];
    const local = concat([new Uint8Array([...u32(0x04034b50), ...common, ...u16(0)]), name, body]);
    const record = concat([
      new Uint8Array([
        ...u32(0x02014b50),
        ...u16(20),
        ...common,
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
      ]),
      name,
    ]);
    locals.push(local);
    central.push(record);
    offset += local.length;
    centralSize += record.length;
  }
  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ]);
  return concat([...locals, ...central, end]);
}
