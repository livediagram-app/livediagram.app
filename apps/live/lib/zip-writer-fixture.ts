// A minimal Zip writer for tests (never shipped): stored and deflated entries. Node only.

import { crc32, deflateRawSync } from 'node:zlib';

export type ZipInput = {
  name: string;
  data: Uint8Array | string;
  method?: 'stored' | 'deflate';
  encrypted?: boolean;
};

const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

export function writeZip(entries: ZipInput[]): Uint8Array<ArrayBuffer> {
  const locals: number[] = [];
  const central: number[] = [];
  for (const entry of entries) {
    const raw = typeof entry.data === 'string' ? new TextEncoder().encode(entry.data) : entry.data;
    const deflate = entry.method === 'deflate';
    const body = deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const name = new TextEncoder().encode(entry.name);
    const flags = 0x0800 | (entry.encrypted ? 1 : 0);
    const method = deflate ? 8 : 0;
    const crc = crc32(raw);
    const offset = locals.length;
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
    locals.push(...u32(0x04034b50), ...common, ...u16(0), ...name, ...body);
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...common,
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...name,
    );
  }
  const end = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(central.length),
    ...u32(locals.length),
    ...u16(0),
  ];
  return new Uint8Array([...locals, ...central, ...end]);
}
