// A minimal Zip writer for downloads (docs/specs/007-editor/pages-mode.md "Export": every
// page as PNG or SVG in one file). Stored entries only: images are already compressed, so
// deflating them again would cost time for nothing. Pure and browser-safe.
//
// `writeZip` builds the whole file in memory; `ZipBlobWriter` streams one entry at a time into Blob parts, for an
// export too large to hold whole (liveknowledge/docs/specs/020-import-export/knowledgebase-export.md "How it is
// built"): each entry's bytes are let go once added, and the browser keeps the parts as it keeps any Blob.

import { crc32 } from './crc32';

type ZipFile = { name: string; data: Uint8Array };

/** The plain zip format's limits: offsets and sizes are 32-bit, entry counts 16-bit (no ZIP64). */
export const ZIP_MAX_BYTES = 0xffffffff;
export const ZIP_MAX_ENTRIES = 0xffff;

/** A zip that would pass the plain format's limits. */
export class ZipTooLargeError extends Error {
  constructor() {
    super('The zip is larger than a zip file can be (4 GB or 65,535 files).');
    this.name = 'ZipTooLargeError';
  }
}

// A date as the Zip format keeps it (MS-DOS: two-second resolution, years from 1980).
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const header = (size: number) => {
  const buf = new Uint8Array(size);
  return { buf, view: new DataView(buf.buffer) };
};

// One entry's local file header and its central directory record, the entry starting at `offset`.
function entryRecords(
  name: Uint8Array,
  data: Uint8Array,
  stamp: { time: number; date: number },
  offset: number,
): { local: Uint8Array<ArrayBuffer>; dir: Uint8Array<ArrayBuffer> } {
  const crc = crc32(data);
  const size = data.length;
  const local = header(30);
  local.view.setUint32(0, 0x04034b50, true);
  local.view.setUint16(4, 20, true); // version needed
  local.view.setUint16(6, 0x0800, true); // UTF-8 names
  local.view.setUint16(8, 0, true); // stored
  local.view.setUint16(10, stamp.time, true);
  local.view.setUint16(12, stamp.date, true);
  local.view.setUint32(14, crc, true);
  local.view.setUint32(18, size, true);
  local.view.setUint32(22, size, true);
  local.view.setUint16(26, name.length, true);
  const dir = header(46);
  dir.view.setUint32(0, 0x02014b50, true);
  dir.view.setUint16(4, 20, true); // version made by
  dir.view.setUint16(6, 20, true); // version needed
  dir.view.setUint16(8, 0x0800, true);
  dir.view.setUint16(10, 0, true); // stored
  dir.view.setUint16(12, stamp.time, true);
  dir.view.setUint16(14, stamp.date, true);
  dir.view.setUint32(16, crc, true);
  dir.view.setUint32(20, size, true);
  dir.view.setUint32(24, size, true);
  dir.view.setUint16(28, name.length, true);
  dir.view.setUint32(42, offset, true);
  return { local: local.buf, dir: dir.buf };
}

function endRecord(
  entries: number,
  centralSize: number,
  centralOffset: number,
): Uint8Array<ArrayBuffer> {
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, entries, true);
  end.view.setUint16(10, entries, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, centralOffset, true);
  return end.buf;
}

/** One .zip of the entries, in order (names UTF-8, flagged as such), each dated `when`. */
export function writeZip(
  entries: readonly ZipFile[],
  when: Date = new Date(),
): Uint8Array<ArrayBuffer> {
  const stamp = dosDateTime(when);
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = enc.encode(entry.name);
    const { local, dir } = entryRecords(name, entry.data, stamp, offset);
    chunks.push(local, name, entry.data);
    central.push(dir, name);
    offset += 30 + name.length + entry.data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const all = [...chunks, ...central, endRecord(entries.length, centralSize, offset)];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of all) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/**
 * A .zip written an entry at a time into Blob parts: `add` each file (its bytes are copied into a Blob and may be
 * let go), then `finish` for the file. Throws `ZipTooLargeError` before an entry that would pass the format's limits.
 */
export class ZipBlobWriter {
  private readonly parts: Blob[] = [];
  private readonly central: Uint8Array<ArrayBuffer>[] = [];
  private readonly enc = new TextEncoder();
  private readonly stamp: { time: number; date: number };
  private offset = 0;
  private centralBytes = 0;
  private count = 0;

  constructor(when: Date = new Date()) {
    this.stamp = dosDateTime(when);
  }

  /** The bytes written so far, the central directory not yet counted. */
  get bytes(): number {
    return this.offset;
  }

  /** How many entries were added. */
  get entries(): number {
    return this.count;
  }

  add(name: string, data: Uint8Array): void {
    const encoded = this.enc.encode(name);
    const size = 30 + encoded.length + data.length;
    // The entry, its directory record and the end record must still fit the 32-bit offsets.
    const directory = this.centralBytes + 46 + encoded.length + 22;
    if (this.count + 1 > ZIP_MAX_ENTRIES || this.offset + size + directory > ZIP_MAX_BYTES)
      throw new ZipTooLargeError();
    const { local, dir } = entryRecords(encoded, data, this.stamp, this.offset);
    this.parts.push(new Blob([local, encoded, data as BlobPart]));
    this.central.push(dir, encoded);
    this.centralBytes += dir.length + encoded.length;
    this.offset += size;
    this.count += 1;
  }

  /** The whole .zip. */
  finish(type = 'application/zip'): Blob {
    return new Blob(
      [...this.parts, ...this.central, endRecord(this.count, this.centralBytes, this.offset)],
      { type },
    );
  }
}
