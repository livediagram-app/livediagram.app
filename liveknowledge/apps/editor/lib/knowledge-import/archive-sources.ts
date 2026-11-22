// What a person hands a Knowledgebase import, as the engine's archive
// (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Archive sources"): a folder picked or dropped, or
// a `.zip`. Nothing is read here: a folder is its files' handles, a zip its directory, and each entry's bytes come
// only when the engine or the write path asks for that one file.

import {
  MAX_ARCHIVE_BYTES,
  MAX_ARCHIVE_ENTRIES,
  MAX_PAGE_SOURCE_BYTES,
  MAX_PICTURE_BYTES,
  zipEntries,
  type ArchiveEntry,
} from '@liveknowledge/knowledge-import';
import { openZipFile } from '@/lib/office-import/zip';

/** A picked archive. `open` lists it afresh each time it is planned, so a plan can be made again for another
 *  destination; `bytes` is the size known before anything is opened, when there is one. */
export type PickedArchive = {
  /** The folder's or the file's name, without `.zip`: what a new knowledgebase is called. */
  name: string;
  kind: 'folder' | 'zip';
  bytes: number | null;
  open(): Promise<ArchiveEntry[]>;
};

// One entry's read: the larger of a page's and a picture's bound, which the engine then holds each to.
const MAX_ENTRY_BYTES = Math.max(MAX_PAGE_SOURCE_BYTES, MAX_PICTURE_BYTES);
// Every file is read at most once as a page and once as a picture.
const MAX_UNPACKED_BYTES = 2 * MAX_ARCHIVE_BYTES;

const withoutZip = (name: string) => name.replace(/\.zip$/i, '');

export const isZipFile = (file: Pick<File, 'name' | 'type'>): boolean =>
  /\.zip$/i.test(file.name) ||
  file.type === 'application/zip' ||
  file.type === 'application/x-zip-compressed';

/** A `.zip`, opened from the file: its directory now, each entry when asked for, names as written. */
export function zipArchive(file: File): PickedArchive {
  return {
    name: withoutZip(file.name) || 'Imported',
    kind: 'zip',
    bytes: file.size,
    open: async () =>
      zipEntries(
        await openZipFile(file, {
          names: 'as-written',
          // One past the import's own limit, so the engine's listing is what says the archive is too large.
          maxEntries: MAX_ARCHIVE_ENTRIES + 1,
          maxUnpackedBytes: MAX_UNPACKED_BYTES,
        }),
        MAX_ENTRY_BYTES,
      ),
  };
}

const entryOf = (path: string, file: File): ArchiveEntry => ({
  path,
  size: file.size,
  read: async () => new Uint8Array(await file.arrayBuffer()),
});

// The folder every path starts with, when they all start with one.
function sharedTopFolder(paths: readonly string[]): string | null {
  const first = paths[0]?.split('/')[0];
  if (!first || paths.some((p) => !p.startsWith(`${first}/`))) return null;
  return first;
}

/** A folder's files (a folder input's, or a dropped folder walked), each under its path inside the folder. The
 *  folder that was picked is the archive's root, not a folder inside it: its own name leaves every path, so its
 *  `README.md` is the top page listed first rather than the page everything else sits under. */
export function folderArchive(files: readonly { path: string; file: File }[]): PickedArchive {
  const top = sharedTopFolder(files.map((f) => f.path));
  const entries = files.map(({ path, file }) =>
    entryOf(top ? path.slice(top.length + 1) : path, file),
  );
  return {
    name: top ?? 'Imported',
    kind: 'folder',
    bytes: null,
    open: async () => entries,
  };
}

/** What `<input webkitdirectory>` chose. */
export function inputFolderArchive(list: Iterable<File>): PickedArchive {
  return folderArchive(
    [...list].map((file) => ({ path: file.webkitRelativePath || file.name, file })),
  );
}

// The slice of the File and Directory Entries API a drop hands over.
type DroppedEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (ok: (file: File) => void, fail: (error: unknown) => void) => void;
  createReader?: () => {
    readEntries: (ok: (entries: DroppedEntry[]) => void, fail: (error: unknown) => void) => void;
  };
};

const fileOf = (entry: DroppedEntry): Promise<File> =>
  new Promise((resolve, reject) => entry.file!(resolve, reject));

// A directory's children: `readEntries` answers them a page at a time, until an empty one.
async function childrenOf(entry: DroppedEntry): Promise<DroppedEntry[]> {
  const reader = entry.createReader!();
  const all: DroppedEntry[] = [];
  for (;;) {
    const page = await new Promise<DroppedEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (page.length === 0) return all;
    all.push(...page);
  }
}

// Every file under the dropped entries, breadth first with an explicit queue; stops one past the import's entry
// limit, so a huge folder is refused by the engine without being walked whole.
async function walk(roots: DroppedEntry[]): Promise<{ path: string; file: File }[]> {
  const files: { path: string; file: File }[] = [];
  const queue = [...roots];
  for (let at = 0; at < queue.length && files.length <= MAX_ARCHIVE_ENTRIES; at++) {
    const entry = queue[at]!;
    if (entry.isDirectory) queue.push(...(await childrenOf(entry)));
    else if (entry.isFile)
      files.push({ path: entry.fullPath.replace(/^\/+/, ''), file: await fileOf(entry) });
  }
  return files;
}

/**
 * What a drop holds: one `.zip`, or a folder (or loose files) walked into an archive. Null when nothing usable was
 * dropped. The entries are taken from the drop at once (they are gone when the event ends); the walk is the promise.
 */
export function droppedArchive(data: DataTransfer): Promise<PickedArchive | null> {
  const only = data.files.length === 1 ? data.files[0]! : null;
  if (only && isZipFile(only)) return Promise.resolve(zipArchive(only));
  const roots: DroppedEntry[] = [];
  for (const item of Array.from(data.items ?? [])) {
    const entry = (
      item as DataTransferItem & { webkitGetAsEntry?: () => DroppedEntry | null }
    ).webkitGetAsEntry?.();
    if (entry) roots.push(entry);
  }
  if (roots.length === 0) {
    // A browser without the entries API hands loose files only: a folder cannot be told from them.
    const loose = Array.from(data.files).map((file) => ({ path: file.name, file }));
    return Promise.resolve(loose.length > 0 ? folderArchive(loose) : null);
  }
  return walk(roots).then((files) => (files.length > 0 ? folderArchive(files) : null));
}
