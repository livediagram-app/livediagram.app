// A picked folder or `.zip` as the engine's archive (docs/specs/020-import-export/blueprints/knowledgebase-import.md
// "Archive sources"): listed without reading, each file read only when asked for.

import { planImport } from '@liveknowledge/knowledge-import';
import { describe, expect, it, vi } from 'vitest';
import { makeZip } from '@/lib/office-import/test-fixtures';
import {
  droppedArchive,
  folderArchive,
  inputFolderArchive,
  isZipFile,
  zipArchive,
} from './archive-sources';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

function countingFile(name: string, content: string, reads: string[]): File {
  const file = new File([content], name);
  const read = file.arrayBuffer.bind(file);
  file.arrayBuffer = vi.fn(async () => {
    reads.push(name);
    return read();
  });
  return file;
}

describe('zipArchive', () => {
  it('lists a zip from the file with names as written and declared sizes, reading an entry only when asked', async () => {
    const bytes = await makeZip({ 'Docs/README.md': '# Home', 'Docs/Guide/Setup.md': 'Steps' });
    const file = new File([bytes as BlobPart], 'Team Docs.zip');
    const slices: [number, number][] = [];
    const slice = file.slice.bind(file);
    file.slice = (start?: number, end?: number) => {
      slices.push([start ?? 0, end ?? file.size]);
      return slice(start, end);
    };
    const archive = zipArchive(file);
    expect(archive).toMatchObject({ name: 'Team Docs', kind: 'zip', bytes: bytes.byteLength });
    const entries = await archive.open();
    expect(entries.map((e) => [e.path, e.size])).toEqual([
      ['Docs/README.md', 6],
      ['Docs/Guide/Setup.md', 5],
    ]);
    // Opening read the end of the file only (its directory), not the entries.
    expect(slices).toHaveLength(1);
    expect(text(await entries[1]!.read())).toBe('Steps');
    // One entry: its local header, then its packed bytes.
    expect(slices).toHaveLength(3);
  });

  it('feeds the engine: titles keep the case the files were written in', async () => {
    const bytes = await makeZip({ 'Docs/Getting Started.md': 'Hello', 'Docs/API.md': 'Calls' });
    const archive = zipArchive(new File([bytes as BlobPart], 'docs.zip'));
    const plan = await planImport('markdown-folder', await archive.open(), {
      archiveBytes: archive.bytes ?? undefined,
    });
    expect(plan.pages.map((p) => p.title)).toEqual(['API', 'Getting Started']);
  });

  it('rejects a file that is no zip when it is opened', async () => {
    await expect(
      zipArchive(new File(['not a zip at all, just text'], 'x.zip')).open(),
    ).rejects.toThrow();
  });

  it('knows a zip by its name or its type', () => {
    expect(isZipFile({ name: 'a.ZIP', type: '' })).toBe(true);
    expect(isZipFile({ name: 'a', type: 'application/zip' })).toBe(true);
    expect(isZipFile({ name: 'a.md', type: 'text/markdown' })).toBe(false);
  });
});

describe('folderArchive', () => {
  it('lists a folder by its files under the folder itself, sizes known, and reads one file at a time', async () => {
    const reads: string[] = [];
    const archive = folderArchive([
      { path: 'handbook/a.md', file: countingFile('a.md', 'A', reads) },
      { path: 'handbook/img/b.png', file: countingFile('b.png', 'PNG', reads) },
    ]);
    expect(archive).toMatchObject({ name: 'handbook', kind: 'folder', bytes: null });
    const entries = await archive.open();
    expect(entries.map((e) => [e.path, e.size])).toEqual([
      ['a.md', 1],
      ['img/b.png', 3],
    ]);
    expect(reads).toEqual([]);
    expect(text(await entries[0]!.read())).toBe('A');
    expect(reads).toEqual(['a.md']);
  });

  it("takes a folder input's files by their path in the folder", async () => {
    const file = new File(['x'], 'a.md');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'notes/deep/a.md' });
    const archive = inputFolderArchive([file]);
    expect(archive.name).toBe('notes');
    expect((await archive.open())[0]!.path).toBe('deep/a.md');
  });
});

describe('droppedArchive', () => {
  const fileEntry = (fullPath: string, content = 'x') => ({
    isFile: true,
    isDirectory: false,
    name: fullPath.split('/').pop()!,
    fullPath,
    file: (ok: (file: File) => void) => ok(new File([content], fullPath.split('/').pop()!)),
  });
  // A directory whose reader answers its children two at a time, then an empty page.
  const dirEntry = (fullPath: string, children: unknown[]) => ({
    isFile: false,
    isDirectory: true,
    name: fullPath.split('/').pop()!,
    fullPath,
    createReader: () => {
      let at = 0;
      return {
        readEntries: (ok: (entries: unknown[]) => void) => {
          ok(children.slice(at, at + 2));
          at += 2;
        },
      };
    },
  });
  const transfer = (entries: unknown[], files: File[] = []) =>
    ({
      files,
      items: entries.map((entry) => ({ webkitGetAsEntry: () => entry })),
    }) as unknown as DataTransfer;

  it('walks a dropped folder into its files, each under its path', async () => {
    const tree = dirEntry('/kb', [
      fileEntry('/kb/README.md'),
      dirEntry('/kb/guides', [
        fileEntry('/kb/guides/a.md'),
        fileEntry('/kb/guides/b.md'),
        fileEntry('/kb/guides/c.md'),
      ]),
      fileEntry('/kb/z.md'),
    ]);
    const archive = await droppedArchive(transfer([tree]));
    expect(archive).toMatchObject({ name: 'kb', kind: 'folder' });
    expect((await archive!.open()).map((e) => e.path).sort()).toEqual([
      'README.md',
      'guides/a.md',
      'guides/b.md',
      'guides/c.md',
      'z.md',
    ]);
  });

  it('takes one dropped .zip as a zip, loose files as a folder, and nothing as nothing', async () => {
    const zip = new File(['x'], 'export.zip');
    expect(await droppedArchive(transfer([], [zip]))).toMatchObject({
      kind: 'zip',
      name: 'export',
    });
    const loose = await droppedArchive({
      files: [new File(['a'], 'a.md')],
    } as unknown as DataTransfer);
    expect(loose).toMatchObject({ kind: 'folder', name: 'Imported' });
    expect(await droppedArchive({ files: [], items: [] } as unknown as DataTransfer)).toBeNull();
    expect(await droppedArchive(transfer([dirEntry('/empty', [])]))).toBeNull();
  });
});
