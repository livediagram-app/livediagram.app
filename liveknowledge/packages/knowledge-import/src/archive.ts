// The archive, listed once (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Listing"): every
// file's path and how to read it, never its bytes. A page's text is read when its turn comes and a picture's only
// when the plan's reader asks, so the import never holds every file at once.

import type { ImportLimits } from './limits';
import { baseOf, keyOf, normalisePath } from './paths';
import type { ArchiveEntry, ImportArchive, SkippedItem } from './types';

export type ArchiveFile = {
  path: string;
  size: number | null;
  read(): Promise<Uint8Array>;
};

export type ArchiveListing = {
  /** By `keyOf(path)`, in the archive's order. */
  files: Map<string, ArchiveFile>;
  skipped: SkippedItem[];
  /** True when the archive declares more bytes or files than an import takes. */
  tooLarge: boolean;
};

// What macOS adds to a folder and its zips: never content.
const isJunk = (path: string): boolean =>
  path.startsWith('__MACOSX/') || baseOf(path) === '.DS_Store';

export async function listArchive(
  archive: ImportArchive,
  limits: ImportLimits,
): Promise<ArchiveListing> {
  const files = new Map<string, ArchiveFile>();
  const skipped: SkippedItem[] = [];
  let bytes = 0;
  for await (const entry of archive) {
    // A folder's own entry: its files name it again.
    if (/[\\/]$/.test(entry.path)) continue;
    const path = normalisePath(entry.path);
    if (path === null) {
      skipped.push({
        path: entry.path,
        reason: 'outside-archive',
        detail: 'Its path leads outside the archive.',
      });
      continue;
    }
    const key = keyOf(path);
    if (isJunk(path) || files.has(key)) continue;
    bytes += entry.size ?? 0;
    if (bytes > limits.archiveBytes || files.size >= limits.entries) {
      return { files, skipped, tooLarge: true };
    }
    files.set(key, { path, size: entry.size ?? null, read: () => entry.read() });
  }
  return { files, skipped, tooLarge: false };
}

export class ImportSizeError extends Error {
  constructor(path: string, limit: number) {
    super(`${path} is larger than ${Math.round(limit / (1024 * 1024))} MB`);
    this.name = 'ImportSizeError';
  }
}

const utf8 = new TextDecoder('utf-8');

/** A file's text (UTF-8, its byte order mark dropped); throws `ImportSizeError` past `maxBytes`. */
export async function readText(file: ArchiveFile, maxBytes: number): Promise<string> {
  if ((file.size ?? 0) > maxBytes) throw new ImportSizeError(file.path, maxBytes);
  const bytes = await file.read();
  if (bytes.byteLength > maxBytes) throw new ImportSizeError(file.path, maxBytes);
  return utf8.decode(bytes);
}

/** What a zip reader has to offer: the shape of the editor's own (`apps/editor/lib/office-import/zip.ts`). */
export type ZipReader = {
  names(): string[];
  read(name: string, max: number): Promise<Uint8Array | null>;
  /** The unpacked size the zip declares for an entry, when the reader knows it. */
  size?(name: string): number | null;
};

/** A zip reader's entries as an archive. Each read is capped at `maxEntryBytes`, by the reader. */
export function zipEntries(zip: ZipReader, maxEntryBytes: number): ArchiveEntry[] {
  return zip.names().map((name) => {
    const size = zip.size?.(name) ?? null;
    return {
      path: name,
      ...(size === null ? {} : { size }),
      read: async () => (await zip.read(name, maxEntryBytes)) ?? new Uint8Array(),
    };
  });
}
