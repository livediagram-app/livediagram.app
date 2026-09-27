// Reading the Full export Zip (docs/specs/020-import-export/blueprints/whiteboard-import.md "Zip").
// Whiteboard writes stored entries (fflate at level 0); a user's re-zip may
// deflate them, which `DecompressionStream('deflate-raw')` inflates under a
// byte budget shared by the whole import. Every offset is bounds-checked: the
// file is untrusted.

export type ZipEntry = {
  name: string;
  method: number;
  encrypted: boolean;
  compressedSize: number;
  size: number;
  localHeaderOffset: number;
};

export type ZipRefusal = 'zip-damaged' | 'zip-encrypted' | 'too-large';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_BYTES = 22;
// The end record plus the longest comment it can carry.
const EOCD_SEARCH_BYTES = EOCD_MIN_BYTES + 0xffff;
const ZIP64_U16 = 0xffff;
const ZIP64_U32 = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_UTF8 = 0x0800;

/** What one import may still inflate; `take` throws `BudgetExceeded` past it. */
export class ByteBudget {
  #remaining: number;
  constructor(bytes: number) {
    this.#remaining = bytes;
  }
  take(bytes: number): void {
    this.#remaining -= bytes;
    if (this.#remaining < 0) throw new BudgetExceeded();
  }
}

export class BudgetExceeded extends Error {
  constructor() {
    super('Inflate budget exceeded');
    this.name = 'BudgetExceeded';
  }
}

const damaged = { ok: false, refusal: 'zip-damaged' } as const;

function findEndRecord(view: DataView): number {
  const stop = Math.max(0, view.byteLength - EOCD_SEARCH_BYTES);
  for (let at = view.byteLength - EOCD_MIN_BYTES; at >= stop; at--) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) return at;
  }
  return -1;
}

const decodeName = (bytes: Uint8Array, utf8: boolean) =>
  new TextDecoder(utf8 ? 'utf-8' : 'latin1').decode(bytes);

/** The Zip's entries from its central directory, or a named refusal. */
export function listZip(
  bytes: Uint8Array,
): { ok: true; entries: ZipEntry[] } | { ok: false; refusal: ZipRefusal } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndRecord(view);
  if (end < 0) return damaged;
  const count = view.getUint16(end + 10, true);
  const dirSize = view.getUint32(end + 12, true);
  const dirOffset = view.getUint32(end + 16, true);
  if (count === ZIP64_U16 || dirSize === ZIP64_U32 || dirOffset === ZIP64_U32) return damaged;
  if (dirOffset + dirSize > end) return damaged;

  const entries: ZipEntry[] = [];
  let at = dirOffset;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== CENTRAL_SIGNATURE) return damaged;
    const flags = view.getUint16(at + 8, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localHeaderOffset = view.getUint32(at + 42, true);
    if ([compressedSize, size, localHeaderOffset].includes(ZIP64_U32)) return damaged;
    const nameEnd = at + 46 + nameLength;
    if (nameEnd > end) return damaged;
    entries.push({
      name: decodeName(bytes.subarray(at + 46, nameEnd), (flags & FLAG_UTF8) !== 0),
      method: view.getUint16(at + 10, true),
      encrypted: (flags & FLAG_ENCRYPTED) !== 0,
      compressedSize,
      size,
      localHeaderOffset,
    });
    at = nameEnd + extraLength + commentLength;
  }
  return { ok: true, entries };
}

async function inflateRaw(
  data: Uint8Array<ArrayBuffer>,
  budget: ByteBudget,
): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  }).pipeThrough(new DecompressionStream('deflate-raw'));
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      budget.take(value.byteLength);
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    // Stop inflating the moment the budget runs out; the rest is never read.
    reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** One entry's bytes, inflated if deflated, or a named refusal. */
export async function readZipEntry(
  bytes: Uint8Array<ArrayBuffer>,
  entry: ZipEntry,
  budget: ByteBudget,
): Promise<{ ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false; refusal: ZipRefusal }> {
  if (entry.encrypted) return { ok: false, refusal: 'zip-encrypted' };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localHeaderOffset;
  if (at + 30 > bytes.byteLength || view.getUint32(at, true) !== LOCAL_SIGNATURE) return damaged;
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (start + entry.compressedSize > bytes.byteLength) return damaged;

  if (entry.method === METHOD_STORED) {
    try {
      budget.take(data.byteLength);
    } catch {
      return { ok: false, refusal: 'too-large' };
    }
    return { ok: true, bytes: data };
  }
  if (entry.method !== METHOD_DEFLATE) return damaged;
  try {
    return { ok: true, bytes: await inflateRaw(data, budget) };
  } catch (error) {
    return error instanceof BudgetExceeded ? { ok: false, refusal: 'too-large' } : damaged;
  }
}
