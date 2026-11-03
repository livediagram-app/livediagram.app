// The zip format, written a file at a time (liveworkspace/docs/specs/003-accounts/data-export.md "Bounded memory"): each
// file's local header and data are appended to the upload as soon as the file is made, and the central directory,
// kept in the object's storage, is written last. Plain zip (no Zip64): an export stays under 4 GiB and 65,535 files
// (`EXPORT_MAX_BYTES`, `EXPORT_MAX_ENTRIES`). Names are UTF-8 (flag bit 11). A file is deflated, or stored when it is
// already compressed (a PNG, an uploaded image) or deflating would not make it smaller.

const encoder = new TextEncoder();

// ---------- CRC-32 (IEEE 802.3, as zip uses) -------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------- Times ----------------------------------------------------------------------------------------------

/** An epoch time as MS-DOS's date and time words (UTC, two-second steps; before 1980 is 1980). */
export function dosDateTime(at: number): { time: number; date: number } {
  const d = new Date(Math.max(at, Date.UTC(1980, 0, 1)));
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    date: ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

// ---------- Entries --------------------------------------------------------------------------------------------

export const STORED = 0;
export const DEFLATED = 8;
// Version 2.0 (deflate), and bit 11: the name is UTF-8.
const VERSION = 20;
const UTF8_FLAG = 0x0800;

/** One file as the directory records it. */
export type ZipEntry = {
  name: string;
  method: typeof STORED | typeof DEFLATED;
  crc: number;
  compressedSize: number;
  size: number;
  offset: number;
  time: number;
  date: number;
};

export async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A file ready to append: its local header and data, and its directory entry once its offset is known. */
export type ZipFile = { bytes: Uint8Array[]; length: number; entry: Omit<ZipEntry, 'offset'> };

/**
 * One file as the zip holds it. `store` keeps it as it is (a picture); otherwise it is deflated, unless that would
 * not make it smaller. `at` is its modified time.
 */
export async function zipFile(
  name: string,
  data: Uint8Array,
  options: { store?: boolean; at: number },
): Promise<ZipFile> {
  const crc = crc32(data);
  let method: ZipEntry['method'] = STORED;
  let body = data;
  if (!options.store && data.length > 0) {
    const deflated = await deflateRaw(data);
    if (deflated.length < data.length) {
      method = DEFLATED;
      body = deflated;
    }
  }
  const { time, date } = dosDateTime(options.at);
  const entry = { name, method, crc, compressedSize: body.length, size: data.length, time, date };
  const header = localHeader(entry);
  return { bytes: [header, body], length: header.length + body.length, entry };
}

function localHeader(entry: Omit<ZipEntry, 'offset'>): Uint8Array {
  const name = encoder.encode(entry.name);
  const out = new Uint8Array(30 + name.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, VERSION, true);
  v.setUint16(6, UTF8_FLAG, true);
  v.setUint16(8, entry.method, true);
  v.setUint16(10, entry.time, true);
  v.setUint16(12, entry.date, true);
  v.setUint32(14, entry.crc, true);
  v.setUint32(18, entry.compressedSize, true);
  v.setUint32(22, entry.size, true);
  v.setUint16(26, name.length, true);
  v.setUint16(28, 0, true);
  out.set(name, 30);
  return out;
}

/** One file's record in the central directory. */
export function centralHeader(entry: ZipEntry): Uint8Array {
  const name = encoder.encode(entry.name);
  const out = new Uint8Array(46 + name.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, VERSION, true);
  v.setUint16(6, VERSION, true);
  v.setUint16(8, UTF8_FLAG, true);
  v.setUint16(10, entry.method, true);
  v.setUint16(12, entry.time, true);
  v.setUint16(14, entry.date, true);
  v.setUint32(16, entry.crc, true);
  v.setUint32(20, entry.compressedSize, true);
  v.setUint32(24, entry.size, true);
  v.setUint16(28, name.length, true);
  // Extra field, comment, disk number, internal and external attributes: none.
  v.setUint32(42, entry.offset, true);
  out.set(name, 46);
  return out;
}

/** The end of central directory record. */
export function endRecord(
  count: number,
  directorySize: number,
  directoryOffset: number,
): Uint8Array {
  const out = new Uint8Array(22);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, directorySize, true);
  v.setUint32(16, directoryOffset, true);
  return out;
}

/** The directory's size for these names: what the finish adds after the last file, for the size cap. */
export function directoryBytes(names: readonly string[]): number {
  return names.reduce((sum, name) => sum + 46 + encoder.encode(name).length, 22);
}
