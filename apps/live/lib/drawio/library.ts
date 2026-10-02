// A draw.io library (`<mxlibrary>`, docs/specs/020-import-export/drawio-import.md "Shape
// libraries"): a JSON array of reusable shapes, each `{ xml, w, h, aspect, title }` (its `xml` a
// mxGraphModel snippet, usually compressed) or `{ data, w, h, title }` (an image). Each item
// converts through the same mapping as a page, its elements moved to start at (0, 0). Never throws.

import {
  contentBounds,
  duplicateElements,
  type Element,
  type ImageElement,
} from '@livediagram/document';
import type { ImportImageRequest } from '@/lib/import-images';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { requestDataUrlImage } from './images';
import type { DrawioInput } from './envelope';
import { ByteBudget, decompressDiagram } from './inflate';
import {
  DRAWIO_MAX_FILE_BYTES,
  DRAWIO_MAX_INFLATED_BYTES,
  DRAWIO_MAX_LIBRARY_ITEMS,
  DRAWIO_REPORT_NAMES_MAX,
} from './limits';
import { ReportTally, type DrawioReport } from './notes';
import { refusalMessage } from './refusals';
import { debugLog } from '@/lib/debug-log';

/** One library shape, its elements placed from its top-left corner at (0, 0). */
export type ImportedLibraryItem = {
  title: string;
  width: number;
  height: number;
  elements: Element[];
};

export type DrawioLibraryResult =
  | {
      ok: true;
      items: ImportedLibraryItem[];
      images: ImportImageRequest[];
      report: DrawioReport;
    }
  | { ok: false; error: string };

type RawItem = { xml?: unknown; data?: unknown; w?: unknown; h?: unknown; title?: unknown };

const size = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;

const OPEN = '<mxlibrary';
const CLOSE = '</mxlibrary>';

/** The JSON between `<mxlibrary ...>` and `</mxlibrary>`, the whole text otherwise blank. Linear. */
function libraryBody(text: string): string | null {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed.startsWith(OPEN) || !trimmed.endsWith(CLOSE)) return null;
  const after = trimmed[OPEN.length];
  if (after !== '>' && after !== ' ' && after !== '\t' && after !== '\n' && after !== '\r')
    return null;
  const open = trimmed.indexOf('>', OPEN.length);
  const close = trimmed.length - CLOSE.length;
  return open >= 0 && open < close ? trimmed.slice(open + 1, close) : null;
}

function readItems(text: string): RawItem[] | null {
  const body = libraryBody(text);
  if (body === null) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return Array.isArray(parsed)
      ? (parsed.filter((x) => x && typeof x === 'object') as RawItem[])
      : null;
  } catch {
    return null;
  }
}

// Every element moved so the item's content starts at (0, 0); fresh ids, connections kept.
function fromOrigin(elements: Element[]): Element[] {
  if (elements.length === 0) return elements;
  const bounds = contentBounds(elements);
  const { newElements } = duplicateElements(
    elements,
    new Set(elements.map((e) => e.id)),
    -bounds.x,
    -bounds.y,
  );
  return newElements;
}

async function snippetModel(xml: string, budget: ByteBudget): Promise<globalThis.Element> {
  const text = xml.trimStart().startsWith('<') ? xml : await decompressDiagram(xml.trim(), budget);
  const doc = new DOMParser().parseFromString(text.trim(), 'application/xml');
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length > 0 || root.localName !== 'mxGraphModel') {
    throw new Error('not a model');
  }
  return root;
}

export async function importDrawioLibrary(input: DrawioInput): Promise<DrawioLibraryResult> {
  const length = input.kind === 'bytes' ? input.bytes.length : input.text.length;
  if (length > DRAWIO_MAX_FILE_BYTES) return { ok: false, error: refusalMessage('too-large') };
  const text = input.kind === 'text' ? input.text : new TextDecoder('utf-8').decode(input.bytes);
  const raw = readItems(text);
  if (!raw) {
    console.warn('[drawio-import] library refused', { reason: 'not-library' });
    return { ok: false, error: refusalMessage('not-library') };
  }
  const tally = new ReportTally(DRAWIO_REPORT_NAMES_MAX);
  tally.add('content-truncated', Math.max(0, raw.length - DRAWIO_MAX_LIBRARY_ITEMS));
  const budget = new ByteBudget(DRAWIO_MAX_INFLATED_BYTES);
  const images: ImportImageRequest[] = [];
  const imageKeys = new Map<string, string>();
  const items: ImportedLibraryItem[] = [];

  for (const item of raw.slice(0, DRAWIO_MAX_LIBRARY_ITEMS)) {
    const title = typeof item.title === 'string' ? item.title : '';
    const width = size(item.w, 80);
    const height = size(item.h, 80);
    try {
      if (typeof item.data === 'string' && item.data.startsWith('data:')) {
        const image: ImageElement = {
          id: crypto.randomUUID(),
          type: 'image',
          x: 0,
          y: 0,
          width,
          height,
          imageId: null,
        };
        requestDataUrlImage({ images, imageKeys }, image.id, item.data, { width, height });
        items.push({ title, width, height, elements: [image] });
        continue;
      }
      if (typeof item.xml !== 'string' || item.xml.trim() === '') throw new Error('no shape');
      const graph = readGraph(await snippetModel(item.xml, budget));
      const converted = convertPage(graph, {
        tally,
        pageIdToTab: new Map(),
        images,
        imageKeys,
      });
      if (converted.elements.length === 0) throw new Error('empty');
      items.push({ title, width, height, elements: fromOrigin(converted.elements) });
    } catch (error) {
      tally.add('library-item-unreadable');
      debugLog('[drawio-import] library item unreadable', { cause: String(error) });
    }
  }

  if (items.length === 0) {
    console.warn('[drawio-import] library refused', { reason: 'empty-library', items: raw.length });
    return { ok: false, error: refusalMessage('empty-library') };
  }
  const report: DrawioReport = {
    pages: 0,
    elements: items.reduce((n, i) => n + i.elements.length, 0),
    notes: tally.notes(),
  };
  debugLog('[drawio-import] library read', {
    items: items.length,
    unreadable: raw.length - items.length,
  });
  return { ok: true, items, images, report };
}
