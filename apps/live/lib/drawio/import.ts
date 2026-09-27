// draw.io import (docs/specs/020-import-export/drawio-import.md): a .drawio /
// .xml file (compressed or not), a .drawio.svg or .drawio.png, or pasted XML,
// to one imported page per draw.io page, plus the pending images and the
// report of what changed on the way in. Pure with respect to the editor:
// applying the pages to tabs is the hook's job, which is what lets a future
// bulk import reuse this unchanged. Never throws.

import type { Element, Layer } from '@livediagram/diagram';
import { ReportTally, type ImportReport, type PendingImage } from '@/lib/import-report';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { readDrawioPages, type DrawioInput } from './envelope';
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
  | { ok: true; pages: ImportedPage[]; images: PendingImage[]; report: ImportReport }
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
    const budget = new ByteBudget(DRAWIO_MAX_INFLATED_BYTES);
    const sources = await readDrawioPages(input, budget);
    const tally = new ReportTally(DRAWIO_REPORT_NAMES_MAX);
    tally.add('content-truncated', Math.max(0, sources.length - DRAWIO_MAX_PAGES));
    const kept = sources.slice(0, DRAWIO_MAX_PAGES);
    const tabIds = kept.map((_, i) => options.tabIdForPage(i));
    const pageIdToTab = new Map(kept.map((p, i) => [p.id, tabIds[i]!]));
    const images: PendingImage[] = [];
    const imageKeys = new Map<string, string>();
    const pages: ImportedPage[] = [];

    for (const [index, source] of kept.entries()) {
      if (index > 0) await yieldToEventLoop();
      const graph = readGraph(source.model);
      const converted = convertPage(graph, {
        tally,
        pageIdToTab,
        tabId: tabIds[index]!,
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

    const report: ImportReport = {
      source: 'drawio',
      pages: pages.length,
      elements: pages.reduce((n, p) => n + p.elements.length, 0),
      notes: tally.notes(),
    };
    return { ok: true, pages, images, report };
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
