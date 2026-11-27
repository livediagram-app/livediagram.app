// Markdown Folder export (docs/specs/020-import-export/knowledgebase-export.md): a whole knowledgebase as one .zip of
// Markdown files, a page at a time. The pages, their writing and their pictures come from a `MarkdownFolderSource`
// (markdown-folder-source.ts builds the editor's), so this is pure over it: the tree in, the zip out.
//
// Streamed: pages are read PAGE_READS_AT_ONCE ahead and written in tree order, each turned into its file and let go;
// a picture is read once, the first time a page shows it, and added at once. The zip's entries are Blob parts
// (ZipBlobWriter), so the page's memory holds a few pages and one picture at a time, never the whole export.
import {
  pageByTitleIn,
  pageFileMarkdown,
  pageFilePaths,
  pageFilePictures,
  pageOfAddress,
  type ExportPageFacts,
  type Tab,
} from '@liveknowledge/document';
import { ZipBlobWriter } from '@liveworkspace/workbench/lib/zip-writer';

/** One page of the tree, as the export names it. */
export type FolderPage = {
  id: string;
  title: string;
  parent?: string;
  facts?: ExportPageFacts;
};

/** A picture's bytes and its media type. */
export type FolderPicture = { bytes: Uint8Array; type: string };

export type MarkdownFolderSource = {
  /** The knowledgebase, whose page addresses in the writing become links to files. */
  documentId: string;
  /** Every page the person may read, in tree order (no connected file). */
  pages: readonly FolderPage[];
  /** A page's writing; null when it is no longer there. Throws when it cannot be read. */
  readPage(id: string): Promise<Tab | null>;
  /** A picture's bytes; null when it cannot be read. */
  readPicture(imageId: string): Promise<FolderPicture | null>;
};

export type MarkdownFolderResult = {
  blob: Blob;
  /** Pages written. */
  pages: number;
  /** Pictures written. */
  pictures: number;
  /** Pictures that could not be read: their descriptions stand in their place. */
  missingPictures: number;
  /** Pages gone by the time they were read. */
  missingPages: number;
};

/** How many pages are read ahead of the one being written. */
export const PAGE_READS_AT_ONCE = 4;
/** The folder pictures are written to, at the zip's root. */
export const PICTURES_FOLDER = 'pictures';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

/** The cancel the panel's Cancel and closing the dialog make. */
export class ExportCancelled extends Error {
  constructor() {
    super('The export was cancelled.');
    this.name = 'ExportCancelled';
  }
}

/** A picture's file name: its id where that is a short safe name, else `picture-<n>` (an Offline picture's id is
 *  its whole data URL). */
export function pictureFileName(imageId: string, type: string, index: number): string | null {
  const extension = EXTENSIONS[type.split(';')[0]!.trim().toLowerCase()];
  if (!extension) return null;
  const safe = imageId.replace(/[^\w.-]/g, '-');
  const stem = !imageId.startsWith('data:') && safe.length <= 64 ? safe : `picture-${index}`;
  return `${PICTURES_FOLDER}/${stem}.${extension}`;
}

/** The zip of every page. `onProgress(done, total)` after each page; `signal` cancels between pages. */
export async function buildMarkdownFolder(
  source: MarkdownFolderSource,
  options: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<MarkdownFolderResult> {
  const { pages } = source;
  const tree = pages.map((p) => ({
    id: p.id,
    name: p.title,
    ...(p.parent ? { parent: p.parent } : {}),
  }));
  const files = pageFilePaths(tree);
  const titles = new Map(tree.map((p) => [p.id, p.name]));
  const links = {
    pageByTitle: pageByTitleIn(tree),
    pageOfHref: pageOfAddress(source.documentId),
    titleOf: (tab: string) => titles.get(tab),
  };
  const zip = new ZipBlobWriter();
  const encoder = new TextEncoder();
  // Where each picture was written, or null when it could not be: read once an export.
  const pictures = new Map<string, string | null>();
  let missingPictures = 0;
  let missingPages = 0;
  let written = 0;

  const checkCancel = () => {
    if (options.signal?.aborted) throw new ExportCancelled();
  };
  const readPicture = async (imageId: string): Promise<string | null> => {
    const picture = await source.readPicture(imageId).catch(() => null);
    const name = picture ? pictureFileName(imageId, picture.type, pictures.size + 1) : null;
    if (!picture || !name) {
      missingPictures += 1;
      return null;
    }
    zip.add(name, picture.bytes);
    return name;
  };

  const reads = new Map<number, Promise<Tab | null>>();
  const ahead = (from: number) => {
    for (let i = from; i < Math.min(pages.length, from + PAGE_READS_AT_ONCE); i++) {
      if (!reads.has(i)) {
        const read = source.readPage(pages[i]!.id);
        // A read ahead that fails is reported when its turn comes, never as an unhandled rejection.
        read.catch(() => undefined);
        reads.set(i, read);
      }
    }
  };

  for (let i = 0; i < pages.length; i++) {
    checkCancel();
    ahead(i);
    const page = pages[i]!;
    const tab = await reads.get(i)!;
    reads.delete(i);
    checkCancel();
    if (!tab) {
      missingPages += 1;
    } else {
      for (const imageId of pageFilePictures(tab)) {
        if (!pictures.has(imageId)) pictures.set(imageId, await readPicture(imageId));
      }
      const file = files.get(page.id)!;
      const markdown = pageFileMarkdown(tab, file, files, (id) => pictures.get(id) ?? null, {
        ...links,
        title: page.title,
        ...(page.facts ? { facts: page.facts } : {}),
      });
      zip.add(file, encoder.encode(markdown));
      written += 1;
    }
    options.onProgress?.(i + 1, pages.length);
  }
  return {
    blob: zip.finish(),
    pages: written,
    pictures: [...pictures.values()].filter(Boolean).length,
    missingPictures,
    missingPages,
  };
}
