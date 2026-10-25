// The photo blob store's upload body (docs/specs/031-photo/photo-store.md "The routes"): a 4-byte
// big-endian length, that many bytes of JSON listing each blob (`[{ id, type, size }]`), then the
// blobs' bytes back to back in that order. Shared by the editor (which frames) and the api (which
// reads, bounding every length by the body before trusting it).
import { isBlobId, PHOTO_BATCH_BLOBS, PHOTO_BLOB_MAX_BYTES } from '@livedesign/photo-engine';

export const PHOTO_BLOB_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type PhotoBlobType = (typeof PHOTO_BLOB_TYPES)[number];

export type PhotoBlobEntry = { id: string; type: PhotoBlobType; bytes: Uint8Array };

/** One body holding the blobs. */
export function encodeBlobBatch(entries: readonly PhotoBlobEntry[]): Uint8Array {
  const head = new TextEncoder().encode(
    JSON.stringify(entries.map((e) => ({ id: e.id, type: e.type, size: e.bytes.length }))),
  );
  const total = 4 + head.length + entries.reduce((n, e) => n + e.bytes.length, 0);
  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, head.length);
  out.set(head, 4);
  let at = 4 + head.length;
  for (const e of entries) {
    out.set(e.bytes, at);
    at += e.bytes.length;
  }
  return out;
}

// The most bytes the JSON index may take: 64 entries of a few dozen characters.
const HEAD_MAX = 16 * 1024;

/** The blobs a body holds, or 'bad_batch' when it is malformed in any way. */
export function decodeBlobBatch(body: Uint8Array): PhotoBlobEntry[] | 'bad_batch' {
  if (body.length < 4) return 'bad_batch';
  const headLength = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(0);
  if (headLength === 0 || headLength > HEAD_MAX || 4 + headLength > body.length) return 'bad_batch';
  let list: unknown;
  try {
    list = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
        body.subarray(4, 4 + headLength),
      ),
    );
  } catch {
    return 'bad_batch';
  }
  if (!Array.isArray(list) || list.length === 0 || list.length > PHOTO_BATCH_BLOBS)
    return 'bad_batch';
  const out: PhotoBlobEntry[] = [];
  let at = 4 + headLength;
  for (const raw of list) {
    if (typeof raw !== 'object' || raw === null) return 'bad_batch';
    const { id, type, size } = raw as Record<string, unknown>;
    if (!isBlobId(id) || !PHOTO_BLOB_TYPES.includes(type as PhotoBlobType)) return 'bad_batch';
    if (
      typeof size !== 'number' ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > PHOTO_BLOB_MAX_BYTES
    )
      return 'bad_batch';
    if (at + size > body.length) return 'bad_batch';
    out.push({ id, type: type as PhotoBlobType, bytes: body.subarray(at, at + size) });
    at += size;
  }
  return at === body.length ? out : 'bad_batch';
}

/** Whether `bytes` start with `type`'s magic number. */
export function sniffsAs(bytes: Uint8Array, type: PhotoBlobType): boolean {
  const b = bytes;
  if (type === 'image/png')
    return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  return (
    b.length > 12 &&
    b[0] === 0x52 && // RIFF
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 && // WEBP
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  );
}

// The routes' refusals.
export type PhotoBlobsError =
  | 'bad_batch'
  | 'blob_mismatch'
  | 'unsupported-type'
  | 'photo_full'
  | 'photos_unavailable'
  | 'too_many';
