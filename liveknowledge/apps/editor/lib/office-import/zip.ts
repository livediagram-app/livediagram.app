// A small zip reader for Office packages (docs/specs/020-import-export/blueprints/office-import.md "openZip"). Reads
// the central directory once, bounds-checked at every step, and unpacks an entry only when it is asked for, through
// the platform's own DecompressionStream. The sizes the file declares are never trusted: output is counted as it
// arrives and the read stops at its cap, so a zip bomb costs at most one slice's worth of unpacking past it.

import { OfficeImportError } from './errors';
import {
  OFFICE_INFLATE_SLICE_BYTES,
  OFFICE_MAX_UNPACKED_BYTES,
  OFFICE_MAX_ZIP_ENTRIES,
} from './limits';

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
// The end record is 22 bytes plus a comment of at most 65,535.
const EOCD_MIN = 22;
const EOCD_SEARCH = EOCD_MIN + 0xffff;

type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  declaredSize: number;
  localOffset: number;
};

export type ZipArchive = {
  /** The entries' names, as normalised. */
  names(): string[];
  has(name: string): boolean;
  /** The entry's bytes, at most `max` of them; throws `unpacks-too-large` past it. Null when there is no such entry. */
  read(name: string, max: number): Promise<Uint8Array | null>;
  /** The unpacked size the archive declares for the entry (never trusted: a read still counts what arrives). Null
   *  when there is no such entry. */
  size(name: string): number | null;
};

/** How an archive is opened. Absent, it is an Office package: names folded, Office's own caps. */
export type ZipOptions = {
  /** `folded` compares names without case and answers them lower-cased (OPC part names are case-insensitive);
   *  `as-written` keeps each name as the archive spells it, slashes forward, for an import that titles pages by
   *  their file names (docs/specs/020-import-export/blueprints/knowledgebase-import.md "The zip reader"). */
  names?: 'folded' | 'as-written';
  /** The most entries the archive may list. */
  maxEntries?: number;
  /** The most every read of this archive may unpack, added up. */
  maxUnpackedBytes?: number;
};

const broken = () => new OfficeImportError('not-a-package');
const tooLarge = () => new OfficeImportError('unpacks-too-large');

/** A part name as compared: forward slashes, no leading slash, case-folded (OPC names are case-insensitive). */
export function zipKey(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function findEnd(view: DataView): number {
  const stop = Math.max(0, view.byteLength - EOCD_SEARCH);
  for (let at = view.byteLength - EOCD_MIN; at >= stop; at--) {
    if (view.getUint32(at, true) === EOCD_SIG) return at;
  }
  throw broken();
}

const utf8 = new TextDecoder('utf-8');
const latin1 = new TextDecoder('latin1');

/** A name as an archive spells it, slashes forward and none leading: what `as-written` compares and answers. */
const writtenKey = (name: string): string => name.replace(/\\/g, '/').replace(/^\/+/, '');

type Directory = { count: number; cdOffset: number; end: number };

// The end record, found in `tail` (the file's last bytes, which start at `tailStart` in the file).
function locateDirectory(tail: DataView, tailStart: number, maxEntries: number): Directory {
  if (tail.byteLength < EOCD_MIN) throw broken();
  const at = findEnd(tail);
  const count = tail.getUint16(at + 10, true);
  const cdSize = tail.getUint32(at + 12, true);
  const cdOffset = tail.getUint32(at + 16, true);
  // ZIP64 (D62): a file under the 50 MB cap never needs it.
  if (count === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) throw broken();
  if (count > maxEntries) throw tooLarge();
  const end = tailStart + at;
  if (cdOffset + cdSize > end) throw broken();
  return { count, cdOffset, end };
}

// The central directory's entries, read from `cd`: the file's bytes from the directory's start to the end record.
function readDirectory(
  cd: Uint8Array,
  count: number,
  keyOf: (name: string) => string,
): Map<string, ZipEntry> {
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const end = cd.byteLength;
  const entries = new Map<string, ZipEntry>();
  let at = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== CENTRAL_SIG) throw broken();
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const declaredSize = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const nameEnd = at + 46 + nameLen;
    if (nameEnd > end) throw broken();
    const raw = cd.subarray(at + 46, nameEnd);
    // Bit 11: the name is UTF-8; otherwise the old code page, read byte for byte.
    const name = (flags & 0x800 ? utf8 : latin1).decode(raw);
    const key = keyOf(name);
    if (key && !key.endsWith('/') && !entries.has(key)) {
      entries.set(key, { name, method, flags, compressedSize, declaredSize, localOffset });
    }
    at = nameEnd + extraLen + commentLen;
  }
  return entries;
}

// The archive over its entries. `dataOf` answers one entry's packed bytes, from memory or from the file.
function archiveOf(
  entries: Map<string, ZipEntry>,
  keyOf: (name: string) => string,
  maxUnpacked: number,
  dataOf: (entry: ZipEntry) => Uint8Array | Promise<Uint8Array>,
): ZipArchive {
  let unpacked = 0;
  return {
    names: () => [...entries.keys()],
    has: (name) => entries.has(keyOf(name)),
    size: (name) => entries.get(keyOf(name))?.declaredSize ?? null,
    async read(name, max) {
      const entry = entries.get(keyOf(name));
      if (!entry) return null;
      // An encrypted entry: nothing in an Office package is, and we would not open it if it were.
      if (entry.flags & 0x1) throw broken();
      const data = await dataOf(entry);
      const budget = Math.min(max, maxUnpacked - unpacked);
      let out: Uint8Array;
      if (entry.method === 0) {
        if (data.byteLength > budget) throw tooLarge();
        out = data.slice();
      } else if (entry.method === 8) {
        out = await inflateCapped(data, budget);
      } else {
        throw broken();
      }
      unpacked += out.byteLength;
      return out;
    },
  };
}

// Where an entry's packed bytes sit, from its local header (30 bytes at its offset), within a file `size` long.
function dataRange(
  header: DataView,
  entry: ZipEntry,
  size: number,
): { start: number; stop: number } {
  if (header.byteLength < 30 || header.getUint32(0, true) !== LOCAL_SIG) throw broken();
  const start = entry.localOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const stop = start + entry.compressedSize;
  if (stop > size) throw broken();
  return { start, stop };
}

const keyFor = (options: ZipOptions) => (options.names === 'as-written' ? writtenKey : zipKey);

export function openZip(bytes: Uint8Array, options: ZipOptions = {}): ZipArchive {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { count, cdOffset, end } = locateDirectory(
    view,
    0,
    options.maxEntries ?? OFFICE_MAX_ZIP_ENTRIES,
  );
  const keyOf = keyFor(options);
  const entries = readDirectory(bytes.subarray(cdOffset, end), count, keyOf);
  return archiveOf(
    entries,
    keyOf,
    options.maxUnpackedBytes ?? OFFICE_MAX_UNPACKED_BYTES,
    (entry) => {
      const off = entry.localOffset;
      if (off + 30 > bytes.byteLength) throw broken();
      const { start, stop } = dataRange(
        new DataView(bytes.buffer, bytes.byteOffset + off, 30),
        entry,
        bytes.byteLength,
      );
      return bytes.subarray(start, stop);
    },
  );
}

const sliceOf = async (file: Blob, start: number, stop: number): Promise<Uint8Array> =>
  new Uint8Array(await file.slice(start, stop).arrayBuffer());

/**
 * A zip opened from the file itself, never read whole: the end record and the directory are read once (the
 * directory is a few dozen bytes an entry), and an entry's packed bytes only when it is asked for. For an archive
 * too large to hold in memory beside what is unpacked from it (a knowledgebase import's 200 MB).
 */
export async function openZipFile(file: Blob, options: ZipOptions = {}): Promise<ZipArchive> {
  const tailStart = Math.max(0, file.size - EOCD_SEARCH);
  const tail = await sliceOf(file, tailStart, file.size);
  const { count, cdOffset, end } = locateDirectory(
    new DataView(tail.buffer, tail.byteOffset, tail.byteLength),
    tailStart,
    options.maxEntries ?? OFFICE_MAX_ZIP_ENTRIES,
  );
  const keyOf = keyFor(options);
  const cd =
    cdOffset >= tailStart
      ? tail.subarray(cdOffset - tailStart, end - tailStart)
      : await sliceOf(file, cdOffset, end);
  const entries = readDirectory(cd, count, keyOf);
  return archiveOf(
    entries,
    keyOf,
    options.maxUnpackedBytes ?? OFFICE_MAX_UNPACKED_BYTES,
    async (entry) => {
      const header = await sliceOf(file, entry.localOffset, entry.localOffset + 30);
      const { start, stop } = dataRange(
        new DataView(header.buffer, header.byteOffset, header.byteLength),
        entry,
        file.size,
      );
      return sliceOf(file, start, stop);
    },
  );
}

/** Raw deflate unpacked through DecompressionStream, counted as it arrives: past `max` both sides are cancelled
 *  and it throws `unpacks-too-large`. Fed a slice at a time, so the stream never runs far past the count. */
export async function inflateCapped(data: Uint8Array, max: number): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  let stopped = false;
  const feed = (async () => {
    try {
      for (let at = 0; at < data.byteLength && !stopped; at += OFFICE_INFLATE_SLICE_BYTES) {
        await writer.write(
          data.subarray(at, at + OFFICE_INFLATE_SLICE_BYTES) as Uint8Array<ArrayBuffer>,
        );
      }
      if (!stopped) await writer.close();
    } catch {
      // The read side reports the failure; a cancelled stream rejects pending writes too.
    }
  })();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        stopped = true;
        await Promise.allSettled([reader.cancel(), writer.abort()]);
        throw tooLarge();
      }
      chunks.push(value);
    }
  } catch (error) {
    stopped = true;
    if (error instanceof OfficeImportError) throw error;
    await Promise.allSettled([writer.abort()]);
    throw broken();
  } finally {
    await feed;
  }
  if (chunks.length === 1) return chunks[0]!;
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
