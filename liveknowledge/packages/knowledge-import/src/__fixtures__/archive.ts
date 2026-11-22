// Test support: an archive built from strings, which counts what is read.

import type { ArchiveEntry } from '../types';

const utf8 = new TextEncoder();

export type TestArchive = ArchiveEntry[] & { reads: string[] };

/** An archive of `files`: a string is UTF-8 text, a number a file of that many zero bytes. */
export function archiveOf(files: Record<string, string | number>): TestArchive {
  const reads: string[] = [];
  const entries = Object.entries(files).map(([path, content]) => {
    const bytes = typeof content === 'number' ? new Uint8Array(content) : utf8.encode(content);
    return {
      path,
      size: bytes.byteLength,
      read: async () => {
        reads.push(path);
        return bytes;
      },
    };
  });
  return Object.assign(entries, { reads });
}
