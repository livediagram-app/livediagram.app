// draw.io import (docs/specs/020-import-export/drawio-import.md): a .drawio /
// .xml file (compressed or not), a .drawio.svg or .drawio.png, or pasted XML,
// to one imported page per draw.io page, plus the pending images and the
// report of what changed on the way in. Pure with respect to the editor:
// applying the pages to tabs is the hook's job, which is what lets a future
// bulk import reuse this unchanged. Never throws.

import type { Element, Layer } from '@livediagram/document';
import type { ImportImageRequest } from '@/lib/import-images';
import { ReportTally, type DrawioReport } from './notes';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { readDrawioSource, sniffDrawio, type DrawioInput, type DrawioMeta } from './envelope';
import { jsonPageElements, readJsonExport, type JsonExportPage } from './json-export';
import { ByteBudget } from './inflate';
import {
  DRAWIO_MAX_FILE_BYTES,
  DRAWIO_MAX_INFLATED_BYTES,
  DRAWIO_MAX_PAGES,
  DRAWIO_REPORT_NAMES_MAX,
} from './limits';
import { DrawioRefused, refusalMessage } from './refusals';

export type { DrawioInput } from './envelope';

export type ImportedPage = {
  tabId: string;
  name: string;
  elements: Element[];
  layers?: Layer[];
  backgroundColor?: string;
};

export type DrawioImportResult =
  | {
      ok: true;
      pages: ImportedPage[];
      images: ImportImageRequest[];
      report: DrawioReport;
      /** What the file says about itself (an mxfile's name and modified time). */
      meta: DrawioMeta;
    }
  | { ok: false; error: string };

export type DrawioImportOptions = {
  /** The tab id each page becomes, by page index. */
  tabIdForPage: (index: number) => string;
};

const inputSize = (input: DrawioInput) =>
  input.kind === 'bytes' ? input.bytes.length : input.text.length;

// Let the browser breathe between pages, so a many-page import does not hold
// input for its whole length.
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function importDrawio(
  input: DrawioInput,
  options: DrawioImportOptions,
): Promise<DrawioImportResult> {
  try {
    if (inputSize(input) > DRAWIO_MAX_FILE_BYTES) throw new DrawioRefused('too-large');
    if (sniffDrawio(input) === 'library') throw new DrawioRefused('library');
    const json = jsonText(input);
    if (json !== null) {
      const exported = readJsonExport(json);
      // The full diagram the export carries: imported exactly, as the file it is.
      if (exported.kind === 'xml') {
        return importDrawio({ kind: 'text', text: exported.text }, options);
      }
      return graphPages(exported.pages, options);
    }
    const budget = new ByteBudget(DRAWIO_MAX_INFLATED_BYTES);
    const { pages: sources, meta } = await readDrawioSource(input, budget);
    const tally = new ReportTally(DRAWIO_REPORT_NAMES_MAX);
    tally.add('content-truncated', Math.max(0, sources.length - DRAWIO_MAX_PAGES));
    const kept = sources.slice(0, DRAWIO_MAX_PAGES);
    const tabIds = kept.map((_, i) => options.tabIdForPage(i));
    const pageIdToTab = new Map(kept.map((p, i) => [p.id, tabIds[i]!]));
    const images: ImportImageRequest[] = [];
    const imageKeys = new Map<string, string>();
    const pages: ImportedPage[] = [];

    for (const [index, source] of kept.entries()) {
      if (index > 0) await yieldToEventLoop();
      const graph = readGraph(source.model);
      const converted = convertPage(graph, {
        tally,
        pageIdToTab,
        images,
        imageKeys,
      });
      pages.push({ tabId: tabIds[index]!, name: source.name, ...converted });
      console.debug('[drawio-import] page', {
        index,
        cells: graph.cells.size,
        elements: converted.elements.length,
      });
    }

    const report: DrawioReport = {
      pages: pages.length,
      elements: pages.reduce((n, p) => n + p.elements.length, 0),
      notes: tally.notes(),
    };
    return { ok: true, pages, images, report, meta };
  } catch (error) {
    const refusal = error instanceof DrawioRefused ? error : new DrawioRefused('unreadable');
    console.warn('[drawio-import] refused', {
      reason: refusal.reason,
      ...(refusal.detail ? { detail: refusal.detail } : {}),
      ...(error instanceof DrawioRefused ? {} : { cause: String(error) }),
    });
    return { ok: false, error: refusalMessage(refusal.reason, refusal.detail) };
  }
}

// A JSON export's text, or null for every other input (XML, an SVG, a PNG).
function jsonText(input: DrawioInput): string | null {
  if (input.kind === 'bytes' && input.bytes[0] === 0x89) return null;
  const text = input.kind === 'text' ? input.text : new TextDecoder('utf-8').decode(input.bytes);
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  return trimmed.startsWith('{') ? trimmed : null;
}

// A graph-only JSON export: each page laid out automatically (docs/specs/020-import-export/
// drawio-import.md "The JSON export"). No images and no meta: the export records neither.
function graphPages(sources: JsonExportPage[], options: DrawioImportOptions): DrawioImportResult {
  const tally = new ReportTally(DRAWIO_REPORT_NAMES_MAX);
  tally.add('content-truncated', Math.max(0, sources.length - DRAWIO_MAX_PAGES));
  const pages: ImportedPage[] = sources.slice(0, DRAWIO_MAX_PAGES).map((source, index) => ({
    tabId: options.tabIdForPage(index),
    name: source.name,
    elements: jsonPageElements(source, tally),
  }));
  const report: DrawioReport = {
    pages: pages.length,
    elements: pages.reduce((n, p) => n + p.elements.length, 0),
    notes: tally.notes(),
  };
  console.debug('[drawio-import] json export laid out', { pages: pages.length });
  return { ok: true, pages, images: [], report, meta: {} };
}
