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
  localOffset: number;
};

export type ZipArchive = {
  /** The entries' names, as normalised. */
  names(): string[];
  has(name: string): boolean;
  /** The entry's bytes, at most `max` of them; throws `unpacks-too-large` past it. Null when there is no such entry. */
  read(name: string, max: number): Promise<Uint8Array | null>;
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

export function openZip(bytes: Uint8Array): ZipArchive {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < EOCD_MIN) throw broken();
  const end = findEnd(view);
  const count = view.getUint16(end + 10, true);
  const cdSize = view.getUint32(end + 12, true);
  const cdOffset = view.getUint32(end + 16, true);
  // ZIP64 (D62): a file under the 50 MB cap never needs it.
  if (count === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) throw broken();
  if (count > OFFICE_MAX_ZIP_ENTRIES) throw tooLarge();
  if (cdOffset + cdSize > end) throw broken();

  const entries = new Map<string, ZipEntry>();
  let at = cdOffset;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== CENTRAL_SIG) throw broken();
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const nameEnd = at + 46 + nameLen;
    if (nameEnd > end) throw broken();
    const raw = bytes.subarray(at + 46, nameEnd);
    // Bit 11: the name is UTF-8; otherwise the old code page, read byte for byte.
    const name = (flags & 0x800 ? utf8 : latin1).decode(raw);
    const key = zipKey(name);
    if (key && !key.endsWith('/') && !entries.has(key)) {
      entries.set(key, { name, method, flags, compressedSize, localOffset });
    }
    at = nameEnd + extraLen + commentLen;
  }

  let unpacked = 0;

  const dataOf = (entry: ZipEntry): Uint8Array => {
    const off = entry.localOffset;
    if (off + 30 > bytes.byteLength || view.getUint32(off, true) !== LOCAL_SIG) throw broken();
    const start = off + 30 + view.getUint16(off + 26, true) + view.getUint16(off + 28, true);
    const stop = start + entry.compressedSize;
    if (stop > bytes.byteLength) throw broken();
    return bytes.subarray(start, stop);
  };

  return {
    names: () => [...entries.keys()],
    has: (name) => entries.has(zipKey(name)),
    async read(name, max) {
      const entry = entries.get(zipKey(name));
      if (!entry) return null;
      // An encrypted entry: nothing in an Office package is, and we would not open it if it were.
      if (entry.flags & 0x1) throw broken();
      const data = dataOf(entry);
      const budget = Math.min(max, OFFICE_MAX_UNPACKED_BYTES - unpacked);
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
