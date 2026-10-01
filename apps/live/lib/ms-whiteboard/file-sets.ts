// What the card reads from (docs/specs/020-import-export/whiteboard-import.md "Importing in the
// dialog"): a .zip, or a folder's files, as one file set read on demand.
import { ByteBudget, listZip, readZipEntry, type ZipRefusal } from '@/lib/zip-reader';
import type { ExportFileSet } from './board-export';

// One pick's cap: the real 83-board export is 245 MB.
export const MAX_IMPORT_BYTES = 512 * 1024 * 1024;

export type FileSetRejection = ZipRefusal | 'too-large';

/** Thrown by a lazy read that fails; the import turns it into the board's rejection. */
export class FileSetReadError extends Error {
  constructor(readonly refusal: ZipRefusal) {
    super(`Zip entry unreadable: ${refusal}`);
    this.name = 'FileSetReadError';
  }
}

const normalise = (path: string) => path.replace(/\\/g, '/').replace(/^\/+/, '');

/** A Zip's file entries; inflation is budgeted across the whole import. */
export function fileSetFromZip(
  bytes: Uint8Array<ArrayBuffer>,
): { ok: true; files: ExportFileSet } | { ok: false; rejection: FileSetRejection } {
  if (bytes.byteLength > MAX_IMPORT_BYTES) return { ok: false, rejection: 'too-large' };
  const listed = listZip(bytes);
  if (!listed.ok) return { ok: false, rejection: listed.refusal };
  const budget = new ByteBudget(MAX_IMPORT_BYTES);
  const files: ExportFileSet = new Map();
  for (const entry of listed.entries) {
    if (entry.name.endsWith('/')) continue;
    files.set(normalise(entry.name), async () => {
      const read = await readZipEntry(bytes, entry, budget);
      if (!read.ok) throw new FileSetReadError(read.refusal);
      return read.bytes;
    });
  }
  return { ok: true, files };
}

export type PickedFile = { path: string; file: Blob };

/** A folder's files (a directory pick or a drop), by their relative paths. */
export function fileSetFromFiles(
  picked: PickedFile[],
): { ok: true; files: ExportFileSet } | { ok: false; rejection: FileSetRejection } {
  let total = 0;
  const files: ExportFileSet = new Map();
  for (const { path, file } of picked) {
    // Only what a board import reads counts towards the cap; sync frames and screenshots don't.
    if (!/\.(json|png|jpe?g|gif|webp)$/i.test(path) || /screenshot\.png$/i.test(path)) continue;
    total += file.size;
    files.set(normalise(path), async () => new Uint8Array(await file.arrayBuffer()));
  }
  if (total > MAX_IMPORT_BYTES) return { ok: false, rejection: 'too-large' };
  return { ok: true, files };
}
