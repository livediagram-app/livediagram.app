// A minimal Zip writer for downloads (docs/specs/007-editor/illustrate-pages.md "Export": every
// page as PNG or SVG in one file). Stored entries only: images are already compressed, so
// deflating them again would cost time for nothing. Pure and browser-safe; the counterpart of
// zip-reader.ts.

export type ZipFile = { name: string; data: Uint8Array };

// The CRC-32 (IEEE) table, built once.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A date as the Zip format keeps it (MS-DOS: two-second resolution, years from 1980).
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** One .zip of the entries, in order (names UTF-8, flagged as such), each dated `when`. */
export function writeZip(
  entries: readonly ZipFile[],
  when: Date = new Date(),
): Uint8Array<ArrayBuffer> {
  const { time, date } = dosDateTime(when);
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const header = (size: number) => {
    const buf = new Uint8Array(size);
    return { buf, view: new DataView(buf.buffer) };
  };
  for (const entry of entries) {
    const name = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    // Local file header.
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true); // version needed
    local.view.setUint16(6, 0x0800, true); // UTF-8 names
    local.view.setUint16(8, 0, true); // stored
    local.view.setUint16(10, time, true);
    local.view.setUint16(12, date, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, size, true);
    local.view.setUint32(22, size, true);
    local.view.setUint16(26, name.length, true);
    chunks.push(local.buf, name, entry.data);
    // Its central directory record.
    const dir = header(46);
    dir.view.setUint32(0, 0x02014b50, true);
    dir.view.setUint16(4, 20, true); // version made by
    dir.view.setUint16(6, 20, true); // version needed
    dir.view.setUint16(8, 0x0800, true);
    dir.view.setUint16(10, 0, true); // stored
    dir.view.setUint16(12, time, true);
    dir.view.setUint16(14, date, true);
    dir.view.setUint32(16, crc, true);
    dir.view.setUint32(20, size, true);
    dir.view.setUint32(24, size, true);
    dir.view.setUint16(28, name.length, true);
    dir.view.setUint32(42, offset, true);
    central.push(dir.buf, name);
    offset += 30 + name.length + size;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, entries.length, true);
  end.view.setUint16(10, entries.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, offset, true);
  const all = [...chunks, ...central, end.buf];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of all) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
