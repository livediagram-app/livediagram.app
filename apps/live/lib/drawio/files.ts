// draw.io files picked in the Explorer, read by content (docs/specs/020-import-export/drawio-import.md
// "Import as new documents"): each diagram named and dated for its own document, each library for
// its own shape library, everything else listed with its reason. Never throws.

import type { DrawioMeta } from './envelope';
import { sniffDrawio } from './envelope';
import { importDrawio } from './import';
import { importDrawioLibrary, type ImportedLibraryItem } from './library';
import type { DrawioDocumentFile } from './new-document';
import type { DrawioReport } from './notes';
import type { ImportImageRequest } from '@/lib/import-images';
import { debugLog } from '@/lib/debug-log';

/** The names draw.io files carry, longest first so `.drawio.png` is not read as `.png`. */
export const DRAWIO_EXTENSIONS = [
  '.drawio.svg',
  '.drawio.png',
  '.drawio',
  '.xml',
  '.json',
  '.svg',
  '.png',
] as const;

/** draw.io's default diagram names, with an optional copy number (` (2)`, `-2`). */
export const DRAWIO_GENERIC_NAME =
  /^(?:untitled(?: diagram)?|diagram|drawing)?(?: \(\d+\)|-\d+)?$/i;

/** draw.io's default library name, with an optional copy number. */
export const DRAWIO_GENERIC_LIBRARY_NAME = /^(?:untitled library)?(?: \(\d+\)|-\d+)?$/i;

export const DRAWIO_DIAGRAM_NAME = 'draw.io diagram';
export const DRAWIO_LIBRARY_NAME = 'draw.io library';
export const DRAWIO_NOT_DRAWIO = "This file isn't a draw.io diagram or library.";
const UNREADABLE_FILE = "This file couldn't be read.";

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function stripDrawioExtension(name: string): string {
  const lower = name.toLowerCase();
  const ext = DRAWIO_EXTENSIONS.find((e) => lower.endsWith(e));
  return (ext ? name.slice(0, -ext.length) : name).trim();
}

const isGeneric = (name: string) => DRAWIO_GENERIC_NAME.test(name.trim());
const isNumberedPage = (name: string) => /^page[- ]?\d+$/i.test(name.trim());

/**
 * A diagram's document name: the file name without its extension; past a generic one, the name
 * the file gives itself, then its first page's (unless draw.io's `Page-n`), then its date.
 */
export function drawioFileTitle(
  fileName: string,
  meta: DrawioMeta,
  firstPageName: string,
  modified: string | undefined,
): string {
  const stem = stripDrawioExtension(fileName);
  if (!isGeneric(stem)) return stem;
  if (meta.name && !isGeneric(stripDrawioExtension(meta.name))) {
    return stripDrawioExtension(meta.name);
  }
  if (firstPageName.trim() && !isNumberedPage(firstPageName)) return firstPageName.trim();
  const at = modified ? new Date(modified) : null;
  return at && Number.isFinite(at.getTime())
    ? `${DRAWIO_DIAGRAM_NAME}, ${DATE_FORMAT.format(at)}`
    : DRAWIO_DIAGRAM_NAME;
}

/** A library's name: the file name without its extension, or "draw.io library" for a generic one. */
export function drawioLibraryTitle(fileName: string): string {
  const stem = stripDrawioExtension(fileName);
  return DRAWIO_GENERIC_LIBRARY_NAME.test(stem) ? DRAWIO_LIBRARY_NAME : stem;
}

/**
 * A diagram's dates (ISO 8601): last modified is the file's own `modified` attribute when it
 * parses, else the file's last-modified time; created is the same moment.
 */
export function drawioFileDates(
  modified: string | undefined,
  lastModified: number,
): { createdAt?: string; modifiedAt?: string } {
  const attr = modified ? new Date(modified) : null;
  const at =
    attr && Number.isFinite(attr.getTime())
      ? attr
      : Number.isFinite(lastModified) && lastModified > 0
        ? new Date(lastModified)
        : null;
  if (!at) return {};
  const iso = at.toISOString();
  return { createdAt: iso, modifiedAt: iso };
}

/** A library file, read and named. */
export type DrawioLibraryFile = {
  name: string;
  items: ImportedLibraryItem[];
  images: ImportImageRequest[];
  report: DrawioReport;
};

export type DrawioFiles = {
  diagrams: DrawioDocumentFile[];
  libraries: DrawioLibraryFile[];
  failures: { title: string; message: string }[];
};

async function inputOf(file: File) {
  return { kind: 'bytes' as const, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** Every picked file as a named, dated diagram or a named library, in pick order. */
export async function readDrawioFiles(files: readonly File[]): Promise<DrawioFiles> {
  const out: DrawioFiles = { diagrams: [], libraries: [], failures: [] };
  for (const file of files) {
    const title = stripDrawioExtension(file.name) || file.name;
    try {
      const input = await inputOf(file);
      const kind = sniffDrawio(input);
      if (kind === null) {
        out.failures.push({ title: file.name, message: DRAWIO_NOT_DRAWIO });
        continue;
      }
      if (kind === 'library') {
        const read = await importDrawioLibrary(input);
        if (!read.ok) out.failures.push({ title, message: read.error });
        else out.libraries.push({ name: drawioLibraryTitle(file.name), ...read });
        continue;
      }
      const read = await importDrawio(input, { tabIdForPage: () => crypto.randomUUID() });
      if (!read.ok) {
        out.failures.push({ title, message: read.error });
        continue;
      }
      const dates = drawioFileDates(read.meta.modified, file.lastModified);
      out.diagrams.push({
        name: drawioFileTitle(file.name, read.meta, read.pages[0]?.name ?? '', dates.modifiedAt),
        ...dates,
        pages: read.pages,
        images: read.images,
        report: read.report,
      });
    } catch (error) {
      console.warn('[drawio-import] file unreadable', { error: String(error) });
      out.failures.push({ title, message: UNREADABLE_FILE });
    }
  }
  debugLog('[drawio-import] files', {
    files: files.length,
    diagrams: out.diagrams.length,
    libraries: out.libraries.length,
    failures: out.failures.length,
  });
  return out;
}
