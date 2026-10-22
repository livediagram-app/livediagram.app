// Picking or dropping a folder (or a .zip) for an import that reads many files
// (docs/specs/020-import-export/whiteboard-import.md "Importing in the dialog"). Browser only.
import type { PickedFile } from '@/lib/ms-whiteboard/file-sets';

export type PickedExport = { kind: 'zip'; file: File } | { kind: 'files'; files: PickedFile[] };

// `change` fires just after focus returns when a file WAS chosen; past this, it was a cancel.
const CANCEL_GRACE_MS = 500;

/** Opens the picker for a .zip or a folder; null when the user cancels. Always settles. */
export function pickExport(kind: 'zip' | 'folder'): Promise<PickedExport | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (kind === 'zip') input.accept = '.zip,application/zip';
    else input.setAttribute('webkitdirectory', '');
    let settled = false;
    let picked = false;
    const finish = (value: PickedExport | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      resolve(value);
    };
    function onFocus() {
      window.removeEventListener('focus', onFocus);
      window.setTimeout(() => {
        if (!picked) finish(null);
      }, CANCEL_GRACE_MS);
    }
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      picked = files.length > 0;
      if (!picked) return finish(null);
      if (kind === 'zip') return finish({ kind: 'zip', file: files[0]! });
      finish({
        kind: 'files',
        files: files.map((file) => ({ path: file.webkitRelativePath || file.name, file })),
      });
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

const readEntries = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
const fileOf = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject));

async function walk(entry: FileSystemEntry, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    out.push({
      path: entry.fullPath.replace(/^\//, ''),
      file: await fileOf(entry as FileSystemFileEntry),
    });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns a batch at a time; an empty batch is the end.
  for (let batch = await readEntries(reader); batch.length > 0; batch = await readEntries(reader)) {
    for (const child of batch) await walk(child, out);
  }
}

/** What was dropped: one .zip, or every file under the dropped folders; null when neither. */
export async function readDrop(data: DataTransfer): Promise<PickedExport | null> {
  const entries = [...data.items]
    .map((item) => (item.kind === 'file' ? item.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e !== null);
  if (entries.length === 1 && entries[0]!.isFile && /\.zip$/i.test(entries[0]!.name)) {
    return { kind: 'zip', file: await fileOf(entries[0] as FileSystemFileEntry) };
  }
  const files: PickedFile[] = [];
  for (const entry of entries) await walk(entry, files);
  return files.length > 0 ? { kind: 'files', files } : null;
}
