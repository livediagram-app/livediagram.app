// A `.zip` as the import engine reads one (@liveknowledge/knowledge-import `ZipReader`), on Node: the central
// directory read once, bounds-checked at every step, and an entry unpacked only when it is asked for. The sizes the
// file declares are never trusted: an entry is inflated with the cap as its limit, so a zip bomb costs at most the
// cap. Every read counts the bytes it really unpacked: past `maxUnpackedBytes` in all, any further read is missing, so
// an archive of many small bombs costs the budget at most, never one cap an entry. Stored and deflated entries only;
// an encrypted one, or one packed another way, reads as missing.
import { inflateRawSync } from 'node:zlib';
import type { ZipReader } from '@liveknowledge/knowledge-import';

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
// The end record is 22 bytes plus a comment of at most 65,535.
const EOCD_MIN = 22;
const EOCD_SEARCH = EOCD_MIN + 0xffff;

type Entry = { method: number; flags: number; packed: number; size: number; offset: number };

export class ZipFormatError extends Error {}

export function openZip(
  bytes: Uint8Array,
  maxEntries: number,
  maxUnpackedBytes = Number.POSITIVE_INFINITY,
): ZipReader {
  let unpacked = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let at = bytes.length - EOCD_MIN; at >= Math.max(0, bytes.length - EOCD_SEARCH); at -= 1)
    if (view.getUint32(at, true) === EOCD_SIG) {
      eocd = at;
      break;
    }
  if (eocd < 0) throw new ZipFormatError('not a zip file');
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  if (count > maxEntries) throw new ZipFormatError(`more than ${maxEntries} files`);
  const entries = new Map<string, Entry>();
  const utf8 = new TextDecoder();
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL_SIG)
      throw new ZipFormatError('a damaged zip file');
    const nameLength = view.getUint16(at + 28, true);
    const name = utf8.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    entries.set(name, {
      flags: view.getUint16(at + 8, true),
      method: view.getUint16(at + 10, true),
      packed: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      offset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return {
    names: () => [...entries.keys()],
    size: (name) => entries.get(name)?.size ?? null,
    read: async (name, max) => {
      const entry = entries.get(name);
      // Bit 0: encrypted. Methods: 0 stored, 8 deflated.
      if (!entry || entry.flags & 1 || (entry.method !== 0 && entry.method !== 8)) return null;
      const local = entry.offset;
      if (local + 30 > bytes.length || view.getUint32(local, true) !== LOCAL_SIG) return null;
      const start =
        local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const packed = bytes.subarray(start, start + entry.packed);
      if (packed.length !== entry.packed) return null;
      const budget = Math.min(max, maxUnpackedBytes - unpacked);
      if (budget <= 0) return null;
      if (entry.method === 0) {
        if (packed.length > budget) return null;
        unpacked += packed.length;
        return packed;
      }
      try {
        const out = new Uint8Array(inflateRawSync(packed, { maxOutputLength: budget }));
        unpacked += out.length;
        return out;
      } catch {
        // Inflated to the limit and stopped: those bytes were spent all the same.
        unpacked += budget;
        return null;
      }
    },
  };
}
