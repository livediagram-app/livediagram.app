// Writing a PSD (Adobe Photoshop File Formats Specification, 2016): version 1, RGB, 8 bits a
// channel, every layer and the composite RLE-packed, groups as section dividers ('lsct'), names in
// Unicode ('luni') as well as Pascal, masks as user mask channels (-2).
import type { Raster } from '../raster/raster';
import { BLEND_KEYS } from './blend-keys';
import type { PsdDocument, PsdMask, PsdNode } from './model';
import { packBits } from './rle';

class Writer {
  private buf = new Uint8Array(1 << 16);
  private view = new DataView(this.buf.buffer);
  length = 0;

  private room(n: number): void {
    if (this.length + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }
  u8(v: number): void {
    this.room(1);
    this.buf[this.length++] = v & 255;
  }
  u16(v: number): void {
    this.room(2);
    this.view.setUint16(this.length, v);
    this.length += 2;
  }
  i16(v: number): void {
    this.room(2);
    this.view.setInt16(this.length, v);
    this.length += 2;
  }
  u32(v: number): void {
    this.room(4);
    this.view.setUint32(this.length, v);
    this.length += 4;
  }
  i32(v: number): void {
    this.room(4);
    this.view.setInt32(this.length, v);
    this.length += 4;
  }
  ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }
  bytes(b: Uint8Array): void {
    this.room(b.length);
    this.buf.set(b, this.length);
    this.length += b.length;
  }
  /** A u32 length placeholder; answers a function that fills it with the bytes written since. */
  lengthMark(pad = 1): () => void {
    const at = this.length;
    this.u32(0);
    return () => {
      while ((this.length - at - 4) % pad !== 0) this.u8(0);
      this.view.setUint32(at, this.length - at - 4);
    };
  }
  setU32(at: number, v: number): void {
    this.view.setUint32(at, v);
  }
  result(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

type Flat = {
  name: string;
  raster: Raster | null;
  x: number;
  y: number;
  opacity: number;
  blend: string;
  visible: boolean;
  clip: boolean;
  lockAlpha: boolean;
  mask?: PsdMask;
  // A group's folder (1 open, 2 closed) or the divider that ends one (3).
  section?: 1 | 2 | 3;
};

/** The tree as the file lists it, bottom first: a group's divider, its layers, then its folder. */
function flatten(nodes: readonly PsdNode[], out: Flat[] = []): Flat[] {
  for (const n of nodes) {
    if (n.kind === 'layer') {
      out.push({ ...n, blend: BLEND_KEYS[n.blend] });
      continue;
    }
    out.push({
      name: '</Layer group>',
      raster: null,
      x: 0,
      y: 0,
      opacity: 1,
      blend: 'norm',
      visible: true,
      clip: false,
      lockAlpha: false,
      section: 3,
    });
    flatten(n.children, out);
    out.push({
      name: n.name,
      raster: null,
      x: 0,
      y: 0,
      opacity: n.opacity,
      blend: BLEND_KEYS[n.blend],
      visible: n.visible,
      clip: false,
      lockAlpha: false,
      ...(n.mask ? { mask: n.mask } : {}),
      section: n.collapsed ? 2 : 1,
    });
  }
  return out;
}

/** One channel's rows packed, with its byte-count table, as the layer channel data takes it. */
function packedChannel(
  width: number,
  height: number,
  read: (x: number, y: number) => number,
): { counts: number[]; data: Uint8Array[] } {
  const counts: number[] = [];
  const data: Uint8Array[] = [];
  const row = new Uint8Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) row[x] = read(x, y);
    const p = packBits(row);
    counts.push(p.length);
    data.push(p);
  }
  return { counts, data };
}

function channelBlock(
  width: number,
  height: number,
  read: (x: number, y: number) => number,
): Uint8Array {
  const w = new Writer();
  w.u16(1);
  if (width === 0 || height === 0) return w.result();
  const { counts, data } = packedChannel(width, height, read);
  for (const c of counts) w.u16(c);
  for (const d of data) w.bytes(d);
  return w.result();
}

function pascal(w: Writer, name: string, pad: number): void {
  const bytes = [...name]
    .map((ch) => (ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 63))
    .slice(0, 255);
  const start = w.length;
  w.u8(bytes.length);
  for (const b of bytes) w.u8(b);
  while ((w.length - start) % pad !== 0) w.u8(0);
}

/** The PSD file of a document. */
export function writePsd(doc: PsdDocument): Uint8Array {
  const w = new Writer();
  w.ascii('8BPS');
  w.u16(1);
  for (let i = 0; i < 6; i++) w.u8(0);
  w.u16(4);
  w.u32(doc.height);
  w.u32(doc.width);
  w.u16(8);
  w.u16(3);
  w.u32(0); // colour mode data
  w.u32(0); // image resources

  const layers = flatten(doc.children);
  const doneMaskInfo = w.lengthMark();
  const doneLayerInfo = w.lengthMark(2);
  // Negative: the first alpha channel holds the merged picture's transparency.
  w.i16(-layers.length);
  const channelData: Uint8Array[][] = [];
  for (const l of layers) {
    const r = l.raster;
    const lw = r ? r.width : 0;
    const lh = r ? r.height : 0;
    w.i32(l.y);
    w.i32(l.x);
    w.i32(l.y + lh);
    w.i32(l.x + lw);
    const blocks: [number, Uint8Array][] = [];
    const px = (c: number) => (x: number, y: number) => r!.data[(y * lw + x) * 4 + c]!;
    blocks.push([-1, channelBlock(lw, lh, r ? px(3) : () => 0)]);
    blocks.push([0, channelBlock(lw, lh, r ? px(0) : () => 0)]);
    blocks.push([1, channelBlock(lw, lh, r ? px(1) : () => 0)]);
    blocks.push([2, channelBlock(lw, lh, r ? px(2) : () => 0)]);
    if (l.mask) {
      const m = l.mask;
      blocks.push([-2, channelBlock(m.width, m.height, (x, y) => m.data[y * m.width + x]!)]);
    }
    w.u16(blocks.length);
    for (const [id, data] of blocks) {
      w.i16(id);
      w.u32(data.length);
    }
    channelData.push(blocks.map((b) => b[1]));
    w.ascii('8BIM');
    w.ascii(l.blend);
    w.u8(Math.round(l.opacity * 255));
    w.u8(l.clip ? 1 : 0);
    // Flags: bit 0 transparency locked, bit 1 hidden, bit 3 bit 4 is meaningful, bit 4 pixels irrelevant
    // (a group's folder and divider).
    w.u8((l.lockAlpha ? 1 : 0) | (l.visible ? 0 : 2) | (l.section ? 8 | 16 : 0));
    w.u8(0);
    const doneExtra = w.lengthMark();
    if (l.mask) {
      const m = l.mask;
      w.u32(20);
      w.i32(m.y);
      w.i32(m.x);
      w.i32(m.y + m.height);
      w.i32(m.x + m.width);
      w.u8(m.outside);
      w.u8(m.enabled ? 0 : 2);
      w.u16(0);
    } else w.u32(0);
    w.u32(0); // blending ranges
    pascal(w, l.name, 4);
    // The name in full.
    w.ascii('8BIMluni');
    const doneLuni = w.lengthMark(4);
    const units = [...l.name].flatMap((ch) => {
      const c = ch.codePointAt(0)!;
      return c > 0xffff ? [0xd800 + ((c - 0x10000) >> 10), 0xdc00 + ((c - 0x10000) & 0x3ff)] : [c];
    });
    w.u32(units.length);
    for (const u of units) w.u16(u);
    doneLuni();
    if (l.section) {
      w.ascii('8BIMlsct');
      w.u32(12);
      w.u32(l.section);
      w.ascii('8BIM');
      w.ascii(l.blend);
    }
    doneExtra();
  }
  for (const blocks of channelData) for (const b of blocks) w.bytes(b);
  doneLayerInfo();
  w.u32(0); // global layer mask info
  doneMaskInfo();

  // The merged picture.
  const c = doc.composite;
  w.u16(1);
  const ch = [0, 1, 2, 3].map((k) =>
    packedChannel(
      doc.width,
      doc.height,
      c ? (x, y) => c.data[(y * c.width + x) * 4 + k]! : () => (k === 3 ? 0 : 255),
    ),
  );
  for (const p of ch) for (const n of p.counts) w.u16(n);
  for (const p of ch) for (const d of p.data) w.bytes(d);
  return w.result();
}
