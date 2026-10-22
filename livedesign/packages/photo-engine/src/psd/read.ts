// Reading a PSD (Adobe Photoshop File Formats Specification, 2016): version 1, RGB or greyscale,
// 8 bits a channel. Pixel layers with their names (Unicode where given), opacity, blend modes,
// visibility, clipping, locked transparency and masks; groups from their section dividers; the
// merged picture as a fallback when the file has no layers. Anything else is refused with a reason.
import { createRaster } from '../raster/raster';
import { blendFromKey } from './blend-keys';
import { PsdError, type PsdDocument, type PsdGroup, type PsdMask, type PsdNode } from './model';
import { unpackBits } from './rle';

class Reader {
  readonly b: Uint8Array;
  readonly v: DataView;
  at = 0;
  constructor(b: Uint8Array) {
    this.b = b;
    this.v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  }
  need(n: number): void {
    if (this.at + n > this.b.length) throw new PsdError('corrupt', 'The file ends early.');
  }
  u8(): number {
    this.need(1);
    return this.b[this.at++]!;
  }
  u16(): number {
    this.need(2);
    const v = this.v.getUint16(this.at);
    this.at += 2;
    return v;
  }
  i16(): number {
    this.need(2);
    const v = this.v.getInt16(this.at);
    this.at += 2;
    return v;
  }
  u32(): number {
    this.need(4);
    const v = this.v.getUint32(this.at);
    this.at += 4;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.v.getInt32(this.at);
    this.at += 4;
    return v;
  }
  ascii(n: number): string {
    this.need(n);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.b[this.at + i]!);
    this.at += n;
    return s;
  }
  skip(n: number): void {
    this.need(n);
    this.at += n;
  }
}

type ChannelInfo = { id: number; length: number };
type Record_ = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  channels: ChannelInfo[];
  blend: string;
  opacity: number;
  clip: boolean;
  flags: number;
  name: string;
  mask?: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    outside: number;
    flags: number;
  };
  section?: number;
};

/** One channel's pixels (width x height bytes), raw or RLE. */
function readChannel(r: Reader, width: number, height: number, length: number): Uint8Array {
  const start = r.at;
  const out = new Uint8Array(width * height);
  if (length < 2) return out;
  const compression = r.u16();
  if (width * height === 0) {
    r.at = start + length;
    return out;
  }
  if (compression === 0) {
    const n = Math.min(width * height, length - 2);
    r.need(n);
    out.set(r.b.subarray(r.at, r.at + n));
  } else if (compression === 1) {
    const counts: number[] = [];
    for (let y = 0; y < height; y++) counts.push(r.u16());
    let at = r.at;
    for (let y = 0; y < height; y++) {
      const { bytes } = unpackBits(r.b, at, width, counts[y]!);
      out.set(bytes, y * width);
      at += counts[y]!;
    }
  } else throw new PsdError('corrupt', 'This PSD uses a compression that is not supported.');
  r.at = start + length;
  return out;
}

// The most pixels a PSD's canvas may hold here, and a layer's.
const MAX_SIDE = 30000;

/** A PSD file's document, or a PsdError saying why it cannot be read. */
export function readPsd(bytes: Uint8Array, { maxSide = MAX_SIDE } = {}): PsdDocument {
  const r = new Reader(bytes);
  if (bytes.length < 26 || r.ascii(4) !== '8BPS')
    throw new PsdError('not-psd', 'This is not a PSD file.');
  const version = r.u16();
  if (version === 2)
    throw new PsdError('psb', 'Large Document Format (PSB) files are not supported.');
  if (version !== 1) throw new PsdError('corrupt', 'This PSD version is not supported.');
  r.skip(6);
  const channels = r.u16();
  const height = r.u32();
  const width = r.u32();
  const depth = r.u16();
  const mode = r.u16();
  if (depth !== 8)
    throw new PsdError('depth', `This PSD has ${depth} bits a channel; photos take 8.`);
  if (mode !== 3 && mode !== 1)
    throw new PsdError(
      'mode',
      mode === 4 ? 'CMYK PSDs are not supported.' : 'Only RGB and greyscale PSDs are supported.',
    );
  if (width < 1 || height < 1 || width > maxSide || height > maxSide)
    throw new PsdError('too-large', 'This PSD is too large.');
  const grey = mode === 1;
  r.skip(r.u32()); // colour mode data
  r.skip(r.u32()); // image resources
  const maskInfoLength = r.u32();
  const maskInfoEnd = r.at + maskInfoLength;
  const records: Record_[] = [];
  const pixels: Map<number, Uint8Array>[] = [];
  if (maskInfoLength > 0) {
    const layerInfoLength = r.u32();
    const layerInfoEnd = r.at + layerInfoLength;
    if (layerInfoLength > 0) {
      const count = Math.abs(r.i16());
      for (let i = 0; i < count; i++) {
        const top = r.i32();
        const left = r.i32();
        const bottom = r.i32();
        const right = r.i32();
        const n = r.u16();
        const chans: ChannelInfo[] = [];
        for (let k = 0; k < n; k++) chans.push({ id: r.i16(), length: r.u32() });
        if (r.ascii(4) !== '8BIM') throw new PsdError('corrupt', 'A layer record is damaged.');
        const blend = r.ascii(4);
        const opacity = r.u8() / 255;
        const clip = r.u8() === 1;
        const flags = r.u8();
        r.skip(1);
        const extraLength = r.u32();
        const extraEnd = r.at + extraLength;
        const rec: Record_ = {
          top,
          left,
          bottom,
          right,
          channels: chans,
          blend,
          opacity,
          clip,
          flags,
          name: '',
        };
        const maskLength = r.u32();
        if (maskLength >= 20) {
          const mt = r.i32();
          const ml = r.i32();
          const mb = r.i32();
          const mr = r.i32();
          const outside = r.u8();
          const mflags = r.u8();
          rec.mask = { top: mt, left: ml, bottom: mb, right: mr, outside, flags: mflags };
          r.skip(maskLength - 18);
        } else r.skip(maskLength);
        r.skip(r.u32()); // blending ranges
        const nameLength = r.u8();
        rec.name = r.ascii(nameLength);
        r.skip((4 - ((nameLength + 1) % 4)) % 4);
        while (r.at + 12 <= extraEnd) {
          const sig = r.ascii(4);
          if (sig !== '8BIM' && sig !== '8B64') break;
          const key = r.ascii(4);
          const len = r.u32();
          const end = r.at + len;
          if (key === 'luni') {
            const units = r.u32();
            const codes: number[] = [];
            for (let u = 0; u < units && r.at + 2 <= end; u++) codes.push(r.u16());
            rec.name = String.fromCharCode(...codes).replace(/\0+$/, '');
          } else if (key === 'lsct' || key === 'lsdk') {
            rec.section = r.u32();
          } else if (key === 'Lr16' || key === 'Lr32') {
            throw new PsdError('depth', 'This PSD has layers of more than 8 bits a channel.');
          }
          r.at = end;
        }
        r.at = extraEnd;
        records.push(rec);
      }
      for (const rec of records) {
        const map = new Map<number, Uint8Array>();
        const lw = Math.max(0, rec.right - rec.left);
        const lh = Math.max(0, rec.bottom - rec.top);
        if (lw > maxSide || lh > maxSide)
          throw new PsdError('too-large', 'A layer of this PSD is too large.');
        for (const ch of rec.channels) {
          if (ch.id === -2 && rec.mask) {
            const mw = Math.max(0, rec.mask.right - rec.mask.left);
            const mh = Math.max(0, rec.mask.bottom - rec.mask.top);
            map.set(-2, readChannel(r, mw, mh, ch.length));
          } else if (ch.id >= -1 && ch.id <= 2) map.set(ch.id, readChannel(r, lw, lh, ch.length));
          else r.skip(ch.length);
        }
        pixels.push(map);
      }
    }
    r.at = layerInfoEnd;
  }
  r.at = Math.min(bytes.length, maskInfoEnd);

  // The tree, bottom first: a divider opens a group, its folder closes it.
  const root: PsdNode[] = [];
  const stack: PsdNode[][] = [root];
  records.forEach((rec, i) => {
    const map = pixels[i]!;
    const mask = rec.mask && map.has(-2) ? toMask(rec.mask, map.get(-2)!) : undefined;
    if (rec.section === 3) {
      stack.push([]);
      return;
    }
    if (rec.section === 1 || rec.section === 2) {
      const children = stack.length > 1 ? stack.pop()! : [];
      const group: PsdGroup = {
        kind: 'group',
        name: rec.name || 'Group',
        opacity: rec.opacity,
        blend: blendFromKey(rec.blend),
        visible: (rec.flags & 2) === 0,
        collapsed: rec.section === 2,
        ...(mask ? { mask } : {}),
        children,
      };
      stack[stack.length - 1]!.push(group);
      return;
    }
    const lw = Math.max(0, rec.right - rec.left);
    const lh = Math.max(0, rec.bottom - rec.top);
    const raster = createRaster(lw, lh);
    const red = map.get(0);
    const green = grey ? red : map.get(1);
    const blue = grey ? red : map.get(2);
    const alpha = map.get(-1);
    for (let p = 0; p < lw * lh; p++) {
      raster.data[p * 4] = red?.[p] ?? 0;
      raster.data[p * 4 + 1] = green?.[p] ?? 0;
      raster.data[p * 4 + 2] = blue?.[p] ?? 0;
      raster.data[p * 4 + 3] = alpha ? alpha[p]! : 255;
    }
    stack[stack.length - 1]!.push({
      kind: 'layer',
      name: rec.name || `Layer ${i + 1}`,
      raster,
      x: rec.left,
      y: rec.top,
      opacity: rec.opacity,
      blend: blendFromKey(rec.blend),
      visible: (rec.flags & 2) === 0,
      clip: rec.clip,
      lockAlpha: (rec.flags & 1) === 1,
      ...(mask ? { mask } : {}),
    });
  });
  // An unclosed group (a damaged file) closes at the top.
  while (stack.length > 1) {
    const children = stack.pop()!;
    stack[stack.length - 1]!.push(...children);
  }

  // The merged picture: what a file without layers is.
  let composite;
  if (r.at + 2 <= bytes.length) {
    try {
      const compression = r.u16();
      const planes: Uint8Array[] = [];
      const count = Math.min(channels, grey ? 2 : 4);
      if (compression === 1) {
        const counts: number[] = [];
        for (let k = 0; k < channels * height; k++) counts.push(r.u16());
        let at = r.at;
        for (let k = 0; k < count; k++) {
          const plane = new Uint8Array(width * height);
          for (let y = 0; y < height; y++) {
            const c = counts[k * height + y]!;
            plane.set(unpackBits(r.b, at, width, c).bytes, y * width);
            at += c;
          }
          planes.push(plane);
        }
      } else if (compression === 0) {
        for (let k = 0; k < count; k++) {
          r.need(width * height);
          planes.push(r.b.slice(r.at, r.at + width * height));
          r.at += width * height;
        }
      }
      if (planes.length > 0) {
        composite = createRaster(width, height);
        const alphaPlane = grey ? planes[1] : planes[3];
        for (let p = 0; p < width * height; p++) {
          composite.data[p * 4] = planes[0]![p]!;
          composite.data[p * 4 + 1] = (grey ? planes[0] : planes[1])![p]!;
          composite.data[p * 4 + 2] = (grey ? planes[0] : planes[2])![p]!;
          composite.data[p * 4 + 3] = alphaPlane ? alphaPlane[p]! : 255;
        }
      }
    } catch {
      composite = undefined;
    }
  }
  return { width, height, children: root, ...(composite ? { composite } : {}) };
}

function toMask(m: NonNullable<Record_['mask']>, data: Uint8Array): PsdMask {
  return {
    data,
    x: m.left,
    y: m.top,
    width: Math.max(0, m.right - m.left),
    height: Math.max(0, m.bottom - m.top),
    outside: m.outside >= 128 ? 255 : 0,
    enabled: (m.flags & 2) === 0,
  };
}
